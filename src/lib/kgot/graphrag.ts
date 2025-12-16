
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { KGotCore } from './core';
import { fuzzyResolve } from './search';
import * as tf from '@tensorflow/tfjs';
import { localGrunt } from '../../services/localMediaService'; // For summaries
import { openDB } from 'idb'; // Lightweight IDB wrapper (from 'idb' dep)
import { applyDecayMutation, triggerPeriodicDecay } from './decay-mut'; // Modular decay import
import { KGOT_CONFIG } from '@/config/behaviorTuning';

interface GraphRAGIndex {
  entities: Record<string, { label: string; features: number[] }>;
  relations: Array<{ source: string; target: string; type: string; weight: number }>;
  communities: Record<string, { summary: string; nodes: string[] }>;
  mutCount: number; // Track for incremental rebuilds
  timestamp: number; // For staleness checks in cache
  version: string; // e.g., 'v1' for schema migration
}

interface RetrievalResult {
  query: string;
  subgraph: { nodes: Record<string, any>; edges: Array<{ source: string; target: string; data: any }> };
  summary: string;
  evidencePaths: string[];
}

export class GraphRAGIndexer {
  private core: KGotCore;
  private index: GraphRAGIndex | null = null;
  private lastIndexTurn: number = 0;
  private mutCountSinceIndex: number = 0;
  private readonly REBUILD_THRESHOLD = KGOT_CONFIG.GRAPHRAG.REBUILD_THRESHOLD; 
  private readonly DB_NAME = 'KGoTDb'; // IndexedDB database name (local persistence)
  private readonly STORE_NAME = 'graphrag'; // Object store for indexes
  private readonly INDEX_VERSION = 'v1'; // Current schema version (migrate on change)
  private dbPromise: Promise<any> | null = null; // Lazy DB init (async, non-blocking)

  // Optional hook for decay integration (e.g., pre-index fade)
  private onDecayTrigger?: (event: 'low_grudge' | 'faded_cluster') => void;

  constructor(core: KGotCore) {
    this.core = core;
    // Catch initialisation errors to prevent unhandled promise rejections
    this.initDB().catch(e => console.warn("[GraphRAG] Background DB init warning:", e));
  }

  // Initialize IndexedDB: Create DB/store if needed (runs once)
  private async initDB(): Promise<any> {
    if (this.dbPromise) return this.dbPromise; // Cache promise to avoid re-init
    
    try {
      this.dbPromise = openDB(this.DB_NAME, 1, {
        upgrade(db) {
          // Create object store if missing (idempotent)
          if (!db.objectStoreNames.contains('graphrag')) {
            const store = db.createObjectStore('graphrag', { keyPath: 'key' }); // Keyed by 'latest'
            store.createIndex('timestamp', 'timestamp', { unique: false }); // For TTL queries
            store.createIndex('version', 'version', { unique: false }); // For schema validation
          }
        },
      });
      return await this.dbPromise;
    } catch (e) {
      console.warn("[GraphRAG] Failed to open IndexedDB:", e);
      this.dbPromise = null; // Reset so we can retry
      throw e;
    }
  }

  // Load cached index from IDB: Fetch latest valid (version + timestamp <1hr stale)
  private async loadFromCache(): Promise<GraphRAGIndex | null> {
    try {
      const db = await this.initDB();
      if (!db) return null; // Guard against failed init

      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      // Query by version and recent timestamp (TTL: 1hr to balance freshness/perf)
      const cached = await store.get('latest');
      if (cached && cached.version === this.INDEX_VERSION && Date.now() - cached.timestamp < (KGOT_CONFIG.GRAPHRAG.TTL_HOURS * 3600000)) { 
        console.log('[GraphRAG] Loaded cached index (fast path)');
        return cached.data as GraphRAGIndex; 
      }
    } catch (e) {
      console.warn('[GraphRAG] Cache load failed (fallback to rebuild):', e);
    }
    return null; // Miss: Trigger full build
  }

  // Save index to IDB: Overwrite latest (async, fire-and-forget)
  private async saveToCache(index: GraphRAGIndex): Promise<void> {
    try {
      const db = await this.initDB();
      if (!db) return; // Guard

      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      await store.put({ 
        key: 'latest', 
        data: index, 
        version: this.INDEX_VERSION, 
        timestamp: Date.now() 
      }); 
      // console.log('[GraphRAG] Cached index (persisted)');
    } catch (e) {
      console.warn('[GraphRAG] Cache save failed (non-critical):', e);
    }
  }

  // Optimized Index: Incremental + Cache (load first, then build if stale)
  // Pre: Optional decay pass for freshness
  public async buildIndex(forceRebuild: boolean = false, mutationDelta: number = 0): Promise<GraphRAGIndex> {
    const graph = this.core.getGraph();
    const turn = graph.global_state.turn_count;
    this.mutCountSinceIndex += mutationDelta; // Increment from caller (e.g., mutations.length)

    const graphSize = Object.keys(graph.nodes).length + graph.edges.length;
    const needsRebuild = forceRebuild || 
      (turn - this.lastIndexTurn >= 3) || // Turn throttle
      (graphSize > 0 && (this.mutCountSinceIndex / graphSize > this.REBUILD_THRESHOLD)); // Change threshold

    // Try cache first (async, non-blocking fast path)
    let cachedIndex = await this.loadFromCache();

    if (!needsRebuild && cachedIndex) {
      this.index = cachedIndex;
      return cachedIndex; // ~5ms hit
    }

    const start = performance.now();
    // console.time('[GraphRAG] Index Build');

    // Pre-build: Decay pass if aligned with config interval (integrates modular decay)
    if (turn > 0 && turn % KGOT_CONFIG.DECAY.INTERVAL === 0) {
      const decayConfig = { 
          rate: KGOT_CONFIG.DECAY.RATE, 
          minWeight: KGOT_CONFIG.DECAY.MIN_WEIGHT, 
          types: KGOT_CONFIG.DECAY.TYPES 
      };
      
      // Identify active agents to decay
      const agents = Object.values(graph.nodes)
        .filter(n => n.type === 'PREFECT' || n.type === 'FACULTY' || n.type === 'SUBJECT')
        .map(n => n.id);
        
      triggerPeriodicDecay(this.core.internalGraph, agents, decayConfig, turn); 
      this.onDecayTrigger?.('low_grudge'); // Hook for lore
    }

    // Extract entities: O(n) loop (fast)
    const entities: Record<string, { label: string; features: number[] }> = {};
    const internalGraph = this.core.internalGraph;
    
    internalGraph.forEachNode((nodeId, attrs) => {
      const pr = (attrs.pagerank as number) || 0;
      const dom = (attrs.attributes?.agent_state?.dominance as number) ?? 0;
      const par = (attrs.attributes?.currentEmotionalState?.paranoia as number) ?? 0;
      entities[nodeId] = { label: (attrs.label as string), features: [pr, dom, par] }; 
    });

    // Extract relations: Prune decayed (<0.1) + sample top 50% by weight (density control)
    const allRelations = internalGraph.edges().map((edge) => ({
      source: internalGraph.source(edge),
      target: internalGraph.target(edge),
      type: internalGraph.getEdgeAttribute(edge, 'type') as string,
      weight: (internalGraph.getEdgeAttribute(edge, 'weight') as number) || 0
    })).filter(r => r.weight >= 0.1); 

    const sortedRelations = allRelations.sort((a, b) => b.weight - a.weight); 
    const sampledRelations = sortedRelations.slice(0, Math.floor(sortedRelations.length * 0.7)); // Heavy-edge sample

    // Communities: Louvain on full graph
    const communities: Record<string, { summary: string; nodes: string[] }> = {};
    if (internalGraph.order > 0) {
        try {
            louvain.assign(internalGraph); // In-place assign (mutates 'community' attr)
            internalGraph.forEachNode((nodeId) => {
                const commId = `comm_${internalGraph.getNodeAttribute(nodeId, 'community')}`;
                if (!communities[commId]) communities[commId] = { summary: '', nodes: [] };
                communities[commId].nodes.push(nodeId); 
            });
        } catch (e) {
            console.warn("Louvain failed, skipping community detection", e);
        }
    }

    // Parallel summaries via Local LLM
    const summaryPromises = Object.entries(communities)
      .sort((a, b) => b[1].nodes.length - a[1].nodes.length) // Sort by size
      .slice(0, KGOT_CONFIG.GRAPHRAG.COMMUNITY_CAP) // Cap to dominant communities
      .map(async ([commId, comm]) => {
        const nodesList = comm.nodes.map(n => entities[n]?.label || n).join(', ');
        const edgesList = sampledRelations
          .filter(r => comm.nodes.includes(r.source) && comm.nodes.includes(r.target))
          .slice(0, 10)
          .map(r => `${r.type}:${r.weight.toFixed(1)}`)
          .join('; ');
        
        // Use local model to summarize if available
        const prompt = `Summarize this narrative community: Nodes: ${nodesList}. Key relations: ${edgesList}. Focus on tension and tropes.`;
        const summary = await localGrunt.summarizeHistory(prompt); // Reusing summarizeHistory for generic generation
        return [commId, { ...comm, summary: summary || "A cluster of related entities." }];
      });

    const resolvedSummaries = await Promise.all(summaryPromises); 
    resolvedSummaries.forEach(([commId, data]) => {
      communities[commId as string] = data as any;
    });

    // Assemble index + cache
    this.index = { 
      entities, 
      relations: sampledRelations, 
      communities, 
      mutCount: this.mutCountSinceIndex, 
      timestamp: Date.now(),
      version: this.INDEX_VERSION 
    };
    this.lastIndexTurn = turn;
    this.mutCountSinceIndex = 0; 
    await this.saveToCache(this.index); 

    // console.timeEnd('[GraphRAG] Index Build');
    console.log(`[GraphRAG] Indexed ${Object.keys(entities).length} entities in ${(performance.now() - start).toFixed(0)}ms`);
    return this.index;
  }

  // Optimized Retrieval: Fuzzy boost + capped expansion
  public async retrieve(query: string, mode: 'local' | 'global' = 'local', k: number = 2): Promise<RetrievalResult> {
    const start = performance.now();
    await this.buildIndex(false, 0); // Lazy + cached build

    const internalGraph = this.core.internalGraph;
    const resolved = fuzzyResolve(this.core, query); 

    // Enhanced fuzzy: Terms + attr overlap
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3); 
    let relevantNodes: string[] = resolved ? [resolved] : [];

    // Scan
    let matchCount = 0;
    internalGraph.forEachNode((nodeId, attrs) => {
      if (matchCount > 10) return; 
      const labelLower = (attrs.label as string).toLowerCase();
      const attrsStr = JSON.stringify(attrs.attributes).toLowerCase(); 
      const labelMatch = queryTerms.some(term => labelLower.includes(term));
      const attrMatch = queryTerms.some(term => attrsStr.includes(term)); 
      if ((labelMatch || attrMatch) && !relevantNodes.includes(nodeId)) {
        relevantNodes.push(nodeId);
        matchCount++;
      }
    });

    // Neighborhood Expansion
    const expanded = new Set(relevantNodes);
    for (let hop = 0; hop < k; hop++) {
      const frontier = [...expanded].slice(-10); // Cap frontier
      const nextLayer = new Set<string>();
      frontier.forEach(n => {
        // FIXED: Use internalGraph.edges(n, neighbor) for multigraphs
        internalGraph.edges(n).forEach(edgeId => { // Iterate all edges connected to 'n'
            const source = internalGraph.source(edgeId);
            const target = internalGraph.target(edgeId);
            const neighbor = (source === n) ? target : source; // Determine actual neighbor

            const edgeWeight = (internalGraph.getEdgeAttribute(edgeId, 'weight') as number) || 0;
            if (edgeWeight >= 0.1) nextLayer.add(neighbor); // Decay filter
        });
      });
      [...nextLayer].forEach(n => expanded.add(n));
    }

    relevantNodes = Array.from(expanded).slice(0, KGOT_CONFIG.GRAPHRAG.SUBGRAPH_CAP); 

    // Evidence: Top heavy edges
    const evidenceEdges: any[] = [];
    relevantNodes.forEach(source => {
        relevantNodes.forEach(target => {
            if (source !== target) {
                // FIXED: Use internalGraph.edges() for multigraphs
                internalGraph.edges(source, target).forEach(edgeId => {
                    // FIX: Cast attrs to any
                    const attrs: any = internalGraph.getEdgeAttributes(edgeId);
                    if ((attrs.weight as number) > 0.3) {
                        evidenceEdges.push({ source, target, ...attrs });
                    }
                });
            }
        });
    });
    
    // Sort and slice evidence
    const sortedEvidence = evidenceEdges.sort((a, b) => b.weight - a.weight).slice(0, 8);

    const evidencePaths: string[] = sortedEvidence.map(e => {
      const srcLabel = internalGraph.getNodeAttribute(e.source, 'label');
      const tgtLabel = internalGraph.getNodeAttribute(e.target, 'label');
      return `${srcLabel} →[${e.type}:${e.weight.toFixed(1)}]→ ${tgtLabel}`;
    });

    // Semantic Filter (Optional Global Mode)
    if (mode === 'global' && relevantNodes.length > 5) {
      try {
          const embeds = this.core.getNode2VecEmbeddings(16); 
          const seedEmbed = embeds[resolved || relevantNodes[0]] || [];
          relevantNodes = relevantNodes.filter(n => {
            const sim = this.cosineSim(seedEmbed, embeds[n] || []);
            return sim > 0.6; 
          });
      } catch (e) {}
    }

    const resultNodes: Record<string, any> = {};
    relevantNodes.forEach(n => {
        resultNodes[n] = internalGraph.getNodeAttributes(n);
    });

    const result: RetrievalResult = {
      query,
      subgraph: {
        nodes: resultNodes,
        edges: sortedEvidence.map(e => ({ source: e.source, target: e.target, data: e }))
      },
      summary: `Retrieved ${relevantNodes.length} nodes, ${sortedEvidence.length} edges for '${query}'`,
      evidencePaths
    };

    console.log(`[GraphRAG] Retrieved in ${(performance.now() - start).toFixed(0)}ms`);
    return result;
  }

  public augmentPrompt(retrieval: RetrievalResult): string {
    const { communities } = this.index!;
    const topComm = Object.values(communities)[0]; 
    return `
GraphRAG MEMORY: "${retrieval.query}"
Relevant Entities: ${Object.values(retrieval.subgraph.nodes).map((n: any) => n.label).join(', ')}
Key Relations: ${retrieval.evidencePaths.join('; ') || 'None'}
Context Summary: ${topComm?.summary || 'Standard protocol.'}
Use these faded scars and hidden connections to deepen the psychological pressure.
    `.trim(); 
  }

  private cosineSim(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0) return 0;
    const dot = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val ** 2, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val ** 2, 0));
    return dot / ((normA * normB) || 1);
  }

  public setDecayHook(hook: (event: 'low_grudge' | 'faded_cluster') => void): void {
    this.onDecayTrigger = hook;
  }
}