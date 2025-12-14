
import Graph from 'graphology';
import { z } from 'zod';
import { KnowledgeGraph, KGotNode, KGotEdge, NodeType, Memory } from '../lib/types/kgot';
import { YandereLedger } from '../types';
import { UnifiedDirectorOutput } from '../lib/schemas/unifiedDirectorSchema';

// Graphology Algorithms
import pagerank from 'graphology-metrics/centrality/pagerank';
import betweennessCentrality from 'graphology-metrics/centrality/betweenness';
import { dijkstra } from 'graphology-shortest-path';
import louvain from 'graphology-communities-louvain';
import forceAtlas2 from 'graphology-layout-forceatlas2';

// --- VALIDATION SCHEMAS ---
// Simplified schema to avoid deep object validation issues in some environments
const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.string(), // Flexible enum handling
  label: z.string().min(1),
  attributes: z.any().optional().default({}) // Relaxed validation for attributes bag
});

const EdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string(),
  weight: z.number().min(0).max(1).optional().default(0.5),
  meta: z.any().optional() // Relaxed validation for meta bag
});

// Mutation Parameter Schemas
const MutationSchemas = {
  add_edge: z.object({
    source: z.string().min(1),
    target: z.string().min(1),
    relation: z.string().optional(),
    label: z.string().optional(),
    weight: z.number().optional().default(0.5),
    meta: z.record(z.any()).optional()
  }),
  remove_edge: z.object({
    source: z.string().min(1),
    target: z.string().min(1)
  }),
  update_node: z.object({
    id: z.string().min(1),
    attributes: z.record(z.any())
  }),
  add_node: z.object({
    id: z.string().min(1),
    type: z.string().optional(),
    label: z.string().optional(),
    attributes: z.record(z.any()).optional()
  }),
  add_memory: z.object({
    id: z.string().min(1),
    description: z.string().min(1),
    emotional_imprint: z.string().optional(),
    involved_entities: z.array(z.string()).optional()
  }),
  update_grudge: z.object({
    source: z.string().min(1),
    target: z.string().min(1),
    delta: z.number()
  }),
  add_trauma_bond: z.object({
    source: z.string().min(1),
    target: z.string().min(1),
    intensity: z.number().optional(),
    bond_type: z.string().optional()
  })
};

/**
 * The Forge's Loom: Knowledge Graph of Thoughts (KGoT) Engine
 * Graphology Implementation (v4.1 - Audited)
 * 
 * Features:
 * - Robust Zod Validation
 * - Batch Operations
 * - GraphSAGE/Node2Vec Embeddings (TensorFlow.js)
 * - Error Resilience & Memory Safeguards
 */
export class KGotController {
  private graph: Graph;
  private globalState: KnowledgeGraph['global_state'];

  constructor(initialGraph: KnowledgeGraph) {
    // Initialize directed multi-graph (allows multiple edges between same nodes)
    this.graph = new Graph({ type: 'directed', multi: true });
    
    this.globalState = initialGraph.global_state || { 
        turn_count: 0, 
        tension_level: 0, 
        narrative_phase: 'ACT_1' 
    };

    // Load initial data
    this.loadFromKnowledgeGraph(initialGraph);

    // Auto-bootstrap if empty
    if (this.graph.order === 0) {
      this.initializeCanonicalNodes();
    }
  }

  // --- Serialization / Deserialization ---

  private loadFromKnowledgeGraph(kg: KnowledgeGraph) {
    // Load Nodes with Batch-like logic
    if (kg.nodes) {
        this.batchAddNodes(Object.values(kg.nodes));
    }

    // Load Edges
    if (kg.edges) {
        kg.edges.forEach(edge => {
            // Generate a deterministic key if missing to avoid dupes on reload
            const key = edge.key || `${edge.source}_${edge.target}_${edge.type}`;
            if (!this.graph.hasEdge(key)) {
                try {
                    this.addEdge(edge.source, edge.target, edge.label, edge.weight, edge.meta);
                } catch (e) {
                    console.warn(`[KGot] Failed to add edge ${key}:`, e);
                }
            }
        });
    }
  }

  public getGraph(): KnowledgeGraph {
    const nodes: Record<string, KGotNode> = {};
    this.graph.forEachNode((id, attrs) => {
      nodes[id] = {
        id,
        type: attrs.type as NodeType,
        label: attrs.label as string,
        attributes: attrs.attributes as any
      };
    });

    const edges: KGotEdge[] = [];
    this.graph.forEachEdge((key, attrs, source, target) => {
      edges.push({
        key,
        source,
        target,
        type: attrs.type as string,
        label: attrs.label as string,
        weight: attrs.weight as number,
        meta: attrs.meta
      });
    });

    return {
      nodes,
      edges,
      global_state: this.globalState
    };
  }

  // --- Canonical Initialization ---

  public initializeCanonicalNodes(): void {
    const canonicalNodes: KGotNode[] = [
        // --- FACULTY ---
        { id: "FACULTY_SELENE", type: "FACULTY", label: "Provost Selene", attributes: { manara_gaze: "Bored_God_Complex", agent_state: { archetype: "The Corrupted Matriarch", dominance_level: 1.0, boredom_level: 0.8, current_mood: "Bored", voice_id: "Zephyr" }, active_schemes: ["Transmutation of Virility"] } },
        { id: "FACULTY_LOGICIAN", type: "FACULTY", label: "Dr. Lysandra", attributes: { manara_gaze: "Clinical_Observer", agent_state: { archetype: "The Vivisectionist", dominance_level: 0.85, scientific_curiosity: 0.9, current_mood: "Analytical", voice_id: "Charon" }, active_schemes: ["Neural Mapping"] } },
        { id: "FACULTY_PETRA", type: "FACULTY", label: "Inquisitor Petra", attributes: { manara_gaze: "Predatory_Manic", agent_state: { archetype: "The Kinetic Artist", dominance_level: 0.95, kinetic_arousal: 0.7, current_mood: "Manic", voice_id: "Fenrir" }, active_schemes: ["The Perfect Break"] } },
        { id: "FACULTY_CONFESSOR", type: "FACULTY", label: "Confessor Calista", attributes: { manara_gaze: "Sultry_Predator", agent_state: { archetype: "The Spider", dominance_level: 0.88, maternal_facade_strength: 0.95, current_mood: "Seductive", voice_id: "Kore" }, active_schemes: ["Emotional Harvesting"] } },
        { id: "FACULTY_ASTRA", type: "FACULTY", label: "Dr. Astra", attributes: { manara_gaze: "Weary_Guilt", agent_state: { archetype: "The Pain Broker", dominance_level: 0.6, guilt_level: 0.8, current_mood: "Guilty", voice_id: "Puck" } } },
        
        // --- PREFECTS ---
        { id: "PREFECT_LOYALIST", type: "PREFECT", label: "Elara", attributes: { manara_gaze: "Wide_Eyed_Fanatic", agent_state: { archetype: "The Flinching Zealot", dominance_level: 0.4, loyalty_score: 0.95, current_mood: "Anxious", voice_id: "Puck" } } },
        { id: "PREFECT_OBSESSIVE", type: "PREFECT", label: "Kaelen", attributes: { manara_gaze: "Yandere_Blank_Stare", agent_state: { archetype: "The Yandere", dominance_level: 0.5, obsession_level: 0.9, target_of_interest: "Subject_84", current_mood: "Obsessive", voice_id: "Kore" }, active_schemes: ["Purification Ritual"] } },
        { id: "PREFECT_DISSIDENT", type: "PREFECT", label: "Rhea", attributes: { manara_gaze: "Cynical_Guarded", agent_state: { archetype: "The Double Agent", dominance_level: 0.3, revolutionary_fervor: 0.8, current_mood: "Cynical", voice_id: "Fenrir" }, grudges: { "FACULTY_SELENE": 90 } } },
        { id: "PREFECT_NURSE", type: "PREFECT", label: "Anya", attributes: { manara_gaze: "Calculating_Warmth", agent_state: { archetype: "The False Healer", dominance_level: 0.5, ambition_score: 0.8, current_mood: "Calculating", voice_id: "Puck" }, active_schemes: ["Information Brokerage"] } },

        // --- LOCATIONS ---
        { id: "loc_calibration", type: "LOCATION", label: "The Calibration Chamber", attributes: { noir_lighting_state: "Clinical_Spotlight", architectural_oppression: 0.95 } },
        { id: "loc_confessional", type: "LOCATION", label: "The Velvet Confessional", attributes: { noir_lighting_state: "Venetian_Blind_Amber", architectural_oppression: 0.4 } }
    ];

    this.batchAddNodes(canonicalNodes);

    // --- EDGES ---
    this.addEdge("FACULTY_SELENE", "Subject_84", "dominance", 1.0, { trope: "owns_soul" });
    this.addEdge("PREFECT_KAELEN", "Subject_84", "obsession", 1.0, { trope: "yandere_possession" });
  }

  // --- Graph Operations ---

  public addNode(node: KGotNode): void {
    try {
        // Validation
        const parsed = NodeSchema.parse(node);
        
        if (!this.graph.hasNode(parsed.id)) {
            this.graph.addNode(parsed.id, {
                type: parsed.type,
                label: parsed.label,
                attributes: parsed.attributes
            });
        }
    } catch (e) {
        console.error(`[KGot] Invalid Node Data for ${node.id}:`, e);
    }
  }

  public batchAddNodes(nodes: KGotNode[]): void {
      nodes.forEach(n => this.addNode(n));
  }

  public removeNode(nodeId: string): void {
    if (this.graph.hasNode(nodeId)) {
      this.graph.dropNode(nodeId);
    }
  }

  public addEdge(sourceId: string, targetId: string, relation: string, weight: number = 0.5, meta?: any): void {
    if (!this.graph.hasNode(sourceId) || !this.graph.hasNode(targetId)) return;

    try {
        // Validation
        EdgeSchema.parse({ source: sourceId, target: targetId, label: relation, weight, meta });

        // Use a composite key to prevent exact duplicates, but allow multi-edges of different types
        const key = `${sourceId}_${targetId}_${relation}`;
        
        if (!this.graph.hasEdge(key)) {
            this.graph.addEdgeWithKey(key, sourceId, targetId, {
                label: relation,
                type: meta?.type || 'RELATIONSHIP',
                weight,
                meta: meta || { tension: 0 }
            });
        } else {
            // Update existing
            this.graph.setEdgeAttribute(key, 'weight', weight);
            if (meta) {
                const currentMeta = this.graph.getEdgeAttribute(key, 'meta');
                this.graph.setEdgeAttribute(key, 'meta', { ...currentMeta, ...meta });
            }
        }
    } catch (e) {
        console.error(`[KGot] Invalid Edge Data:`, e);
    }
  }

  public removeEdge(sourceId: string, targetId: string): void {
    // Removes all edges between source and target
    if (this.graph.hasNode(sourceId) && this.graph.hasNode(targetId)) {
        const edges = this.graph.edges(sourceId, targetId);
        edges.forEach(e => this.graph.dropEdge(e));
    }
  }

  // --- Advanced Analysis (Graphology) ---

  /**
   * Calculates PageRank to determine social dominance hierarchy.
   */
  public getSocialHierarchy(): [string, number][] {
    if (this.graph.order === 0) return [];
    try {
        const scores = pagerank(this.graph);
        return Object.entries(scores).sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
    } catch (e) {
        console.warn("PageRank failed:", e);
        return [];
    }
  }

  /**
   * Detects cliques/conspiracies using Louvain community detection.
   */
  public detectConspiracies(): string[][] {
    if (this.graph.order === 0) return [];
    try {
        const communities = louvain(this.graph);
        const groups: Record<string, string[]> = {};
        
        Object.entries(communities).forEach(([nodeId, communityId]) => {
            const key = String(communityId); // Ensure key is a string
            if (!groups[key]) groups[key] = [];
            groups[key].push(nodeId);
        });

        return Object.values(groups).filter(g => g.length > 2);
    } catch (e) {
        console.warn("Louvain detection failed:", e);
        return [];
    }
  }

  /**
   * Calculates the shortest "Dominance Path" using Dijkstra.
   */
  public calculateDominancePath(source: string, target: string): string[] | null {
    if (!this.graph.hasNode(source) || !this.graph.hasNode(target)) return null;

    try {
        const path = dijkstra.bidirectional(this.graph, source, target, (edge, attr) => {
             return 1.0 - (attr.weight || 0.5);
        });
        return path || null;
    } catch (e) {
        return null;
    }
  }

  /**
   * Applies ForceAtlas2 layout for visualization coordinates.
   */
  public applyLayout(iterations = 50): void {
    if (this.graph.order === 0) return;
    try {
        const positions = forceAtlas2(this.graph, { iterations, settings: { gravity: 1.0 } });
        this.graph.forEachNode((node, attr) => {
            if (positions[node]) {
                this.graph.mergeNodeAttributes(node, {
                    x: positions[node].x,
                    y: positions[node].y
                });
            }
        });
    } catch (e) {
        console.warn("Layout application failed:", e);
    }
  }

  // --- EMBEDDING & AI ENHANCEMENTS ---

  /**
   * Imp1: Knowledge Completion (KC)
   * Infers missing relationships based on structural proximity (short paths).
   * E.g., if A connected to B, and B to C, infer A weak-bond C.
   */
  public knowledgeCompletion(threshold: number = 2): void {
    const nodes = this.graph.nodes();
    // O(N^2) - only run on small graphs or limit range
    const limit = Math.min(nodes.length, 50); 
    
    for (let i = 0; i < limit; i++) {
        for (let j = i + 1; j < limit; j++) {
            const source = nodes[i];
            const target = nodes[j];
            
            if (this.graph.hasEdge(source, target)) continue;

            try {
                // Check path length (hops)
                const path = dijkstra.bidirectional(this.graph, source, target);
                if (path && path.length > 1 && path.length <= threshold + 1) { 
                    // Infer bond. Weight decays with distance.
                    const inferredWeight = 0.4 / (path.length - 1); 
                    this.addEdge(source, target, 'INFERRED_BOND', inferredWeight, {
                        type: 'LATENT',
                        is_inferred: true
                    });
                }
            } catch (e) {
                // No path
            }
        }
    }
  }

  /**
   * Imp2: Feature Extraction for Enrichment
   */
  private getNodeFeatures(node: string, bc: Record<string, number>): number[] {
    const inDeg = this.graph.inDegree(node);
    const outDeg = this.graph.outDegree(node);
    const centrality = bc[node] || 0;
    return [inDeg, outDeg, centrality]; 
  }

  /**
   * Internal Node2Vec Simulation (Random Indexing Approximation)
   * Generates structural embeddings without requiring a Word2Vec library.
   */
  private origNode2Vec(dimensions: number = 16, walkLength: number = 10, numWalks: number = 20): Record<string, number[]> {
    const nodes = this.graph.nodes();
    const vectors: Record<string, number[]> = {};
    const contextVectors: Record<string, number[]> = {};

    // 1. Initialize random index vectors (Random Projection)
    nodes.forEach(node => {
        vectors[node] = Array.from({length: dimensions}, () => Math.random() - 0.5);
        contextVectors[node] = Array(dimensions).fill(0);
    });

    // 2. Perform Random Walks
    nodes.forEach(startNode => {
        for (let i = 0; i < numWalks; i++) {
            let curr = startNode;
            for (let step = 0; step < walkLength; step++) {
                const neighbors = this.graph.neighbors(curr);
                if (neighbors.length === 0) break;
                
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                for (let d = 0; d < dimensions; d++) {
                    contextVectors[curr][d] += vectors[next][d];
                    contextVectors[next][d] += vectors[curr][d];
                }
                
                curr = next;
            }
        }
    });

    // 3. Normalize to Unit Vectors
    nodes.forEach(node => {
        const magnitude = Math.sqrt(contextVectors[node].reduce((sum, val) => sum + val * val, 0)) || 1;
        contextVectors[node] = contextVectors[node].map(v => v / magnitude);
    });

    return contextVectors;
  }

  /**
   * Imp2: Enriched Node2Vec Public API
   * Combines Structural Embeddings + Centrality Features.
   */
  public getNode2VecEmbeddings(dim: number = 16): Record<string, number[]> {
    // 1. Knowledge Completion
    this.knowledgeCompletion();

    // 2. Pre-calculate centrality map
    let bc = {};
    try { bc = betweennessCentrality(this.graph); } catch (e) {}

    // 3. Get Base Node2Vec Embeddings
    const rawEmbeds = this.origNode2Vec(dim);

    // 4. Enrich
    const enriched: Record<string, number[]> = {};
    this.graph.forEachNode(node => {
        const structuralFeats = this.getNodeFeatures(node, bc as Record<string, number>);
        if (rawEmbeds[node]) {
            enriched[node] = rawEmbeds[node].concat(structuralFeats);
        }
    });

    return enriched;
  }

  /**
   * GraphSAGE Implementation (Matrix/Vectorized for TFJS)
   * Superior to GCN for inductive tasks and narrative prediction.
   * Uses Mean Aggregator + Concatenation.
   */
  public async getGraphSAGEEmbeddings(layers = [16, 32, 16], epochs = 50, lr = 0.01): Promise<Record<string, number[]>> {
    const nodes = this.graph.nodes();
    const numNodes = nodes.length;
    
    if (numNodes === 0) return {};
    if (numNodes > 500) {
        console.warn(`[KGot] GraphSAGE Warning: Graph size (${numNodes}) may exceed browser memory for dense matrix ops. Falling back to Node2Vec.`);
        return this.getNode2VecEmbeddings();
    }

    try {
        const tf = await import('@tensorflow/tfjs');
        
        const nodeToIndex: Record<string, number> = {};
        nodes.forEach((n, i) => nodeToIndex[n] = i);

        // Adjacency List to Tensor (Row Normalized)
        const adjBuffer = tf.buffer([numNodes, numNodes]);
        this.graph.forEachEdge((e, a, src, tgt) => {
            const s = nodeToIndex[src];
            const t = nodeToIndex[tgt];
            if (s !== undefined && t !== undefined) {
                adjBuffer.set(1, s, t);
                // GraphSAGE often treats edges as undirected for aggregation context
                adjBuffer.set(1, t, s); 
            }
        });
        
        // Normalize Neighbors (Mean Aggregation Prep)
        for(let i=0; i<numNodes; i++) {
            let deg = 0;
            for(let j=0; j<numNodes; j++) if(adjBuffer.get(i, j)) deg++;
            deg = deg > 0 ? deg : 1; 
            
            // Normalize existing edges
            for(let j=0; j<numNodes; j++) {
                if(adjBuffer.get(i, j)) adjBuffer.set(1/deg, i, j);
            }
        }
        
        const A = adjBuffer.toTensor();

        return tf.tidy(() => {
            // Initialize Features (Random Init implies "Structural Identity")
            const inputDim = layers[0];
            const initialFeatures = tf.randomNormal([numNodes, inputDim]);
            
            // Initialize Weights for SAGE Layers
            // Layer 1: Input [Self(16) + Neigh(16)] -> Output(32)
            const w1 = tf.variable(tf.randomNormal([layers[0] * 2, layers[1]], 0, 0.1));
            
            // Layer 2: Input [Self(32) + Neigh(32)] -> Output(16)
            const w2 = tf.variable(tf.randomNormal([layers[1] * 2, layers[2]], 0, 0.1));
            
            const optimizer = tf.train.adam(lr);

            // Forward Pass Function (Inductive)
            const model = (x: any) => {
                // Layer 1
                const neigh1 = tf.matMul(A, x); // Aggregate
                const concat1 = tf.concat([x, neigh1], 1); // Concat
                const h1 = tf.relu(tf.matMul(concat1, w1)); // Transform
                const norm1 = tf.div(h1, tf.norm(h1, 'euclidean', 1, true).add(1e-6)); // Normalize
                
                // Layer 2
                const neigh2 = tf.matMul(A, norm1);
                const concat2 = tf.concat([norm1, neigh2], 1);
                const h2 = tf.matMul(concat2, w2); 
                const norm2 = tf.div(h2, tf.norm(h2, 'euclidean', 1, true).add(1e-6));
                
                return norm2;
            };

            // Train (Feature/Structure Reconstruction)
            for(let i=0; i<epochs; i++) {
                optimizer.minimize(() => {
                    const embeddings = model(initialFeatures);
                    // Loss: Reconstruction of initial structural signal
                    return tf.mean(tf.square(tf.sub(embeddings, initialFeatures)));
                });
            }

            const finalEmbeds = model(initialFeatures);
            const data = finalEmbeds.arraySync() as number[][];
            
            const result: Record<string, number[]> = {};
            nodes.forEach((n, i) => result[n] = data[i]);
            return result;
        });

    } catch (e) {
        console.warn("GraphSAGE failed (tfjs likely missing or error):", e);
        // Fallback to basic Node2Vec if TFJS fails
        return this.getNode2VecEmbeddings();
    }
  }

  // --- Benchmarking ---
  
  public benchAlgorithms(): { pagerank: number, node2vec: number } {
      const startPR = performance.now();
      this.getSocialHierarchy();
      const endPR = performance.now();

      const startN2V = performance.now();
      this.getNode2VecEmbeddings();
      const endN2V = performance.now();

      return {
          pagerank: endPR - startPR,
          node2vec: endN2V - startN2V
      };
  }

  // --- Logic Helpers ---

  public updateLedger(subjectId: string, deltas: Partial<YandereLedger>): void {
    if (!this.graph.hasNode(subjectId)) return;
    
    const attrs = this.graph.getNodeAttributes(subjectId);
    // @ts-ignore
    const ledger = attrs.attributes.ledger || {};

    Object.keys(deltas).forEach((key) => {
        const k = key as keyof YandereLedger;
        const val = deltas[k];
        if (typeof val === 'number' && typeof ledger[k] === 'number') {
           // @ts-ignore
           ledger[k] = Math.max(0, Math.min(100, ledger[k] + val));
        } else if (val !== undefined) {
           // @ts-ignore
           ledger[k] = val;
        }
    });

    this.graph.mergeNodeAttributes(subjectId, {
        attributes: { ...attrs.attributes, ledger }
    });
  }

  public addMemory(nodeId: string, memory: Memory): void {
    if (!this.graph.hasNode(nodeId)) return;
    const attrs = this.graph.getNodeAttributes(nodeId);
    // @ts-ignore
    const memories = attrs.attributes.memories || [];
    memories.push(memory);
    if (memories.length > 20) memories.shift();
    
    this.graph.mergeNodeAttributes(nodeId, {
        attributes: { ...attrs.attributes, memories }
    });
  }

  public updateGrudge(holderId: string, targetId: string, delta: number): void {
    if (!this.graph.hasNode(holderId)) return;
    const attrs = this.graph.getNodeAttributes(holderId);
    // @ts-ignore
    const grudges = attrs.attributes.grudges || {};
    const current = grudges[targetId] || 0;
    const newVal = Math.max(0, Math.min(100, current + delta));
    grudges[targetId] = newVal;

    this.graph.mergeNodeAttributes(holderId, {
        attributes: { ...attrs.attributes, grudges }
    });

    if (newVal > 50) {
        this.addEdge(holderId, targetId, 'GRUDGE', newVal / 100, {
            intensity: newVal,
            trope: 'Burning Hatred'
        });
    }
  }

  // --- Director-Specific Mutation Handler ---
  
  public applyMutations(mutations: Array<{ operation: string, params?: any }>): void {
    mutations.forEach(mutation => {
      const { operation, params = {} } = mutation;
      
      try {
        switch (operation) {
          case 'add_edge': {
            const valid = MutationSchemas.add_edge.parse(params);
            this.addEdge(valid.source, valid.target, valid.relation || valid.label || 'RELATIONSHIP', valid.weight, valid.meta);
            break;
          }
          
          case 'remove_edge': {
            const valid = MutationSchemas.remove_edge.parse(params);
            this.removeEdge(valid.source, valid.target);
            break;
          }
          
          case 'update_node': {
            const valid = MutationSchemas.update_node.parse(params);
            if (this.graph.hasNode(valid.id)) {
               const currentAttrs = this.graph.getNodeAttributes(valid.id);
               this.graph.mergeNodeAttributes(valid.id, {
                   attributes: { ...currentAttrs.attributes, ...valid.attributes }
               });
            }
            break;
          }

          case 'add_node': {
            const valid = MutationSchemas.add_node.parse(params);
            this.addNode({
                id: valid.id,
                type: valid.type || 'ENTITY',
                label: valid.label || valid.id,
                attributes: valid.attributes || {}
            });
            break;
          }

          case 'add_memory': {
              const valid = MutationSchemas.add_memory.parse(params);
              this.addMemory(valid.id, {
                  id: `mem_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
                  description: valid.description,
                  emotional_imprint: valid.emotional_imprint || 'Neutral',
                  involved_entities: valid.involved_entities || [],
                  timestamp: this.globalState.turn_count
              });
              break;
          }

          case 'update_grudge': {
              const valid = MutationSchemas.update_grudge.parse(params);
              this.updateGrudge(valid.source, valid.target, valid.delta);
              break;
          }
              
          case 'add_trauma_bond': {
              const valid = MutationSchemas.add_trauma_bond.parse(params);
              this.addEdge(valid.source, valid.target, 'TRAUMA_BOND', valid.intensity || 0.5, {
                  type: "trauma_bond",
                  bond_type: valid.bond_type || "dependency",
                  intensity: valid.intensity,
                  timestamp: new Date().toISOString()
              });
              break;
          }
          
          default:
            console.warn(`[KGot] Unknown mutation operation: ${operation}`);
        }
      } catch (e: any) {
        console.error(`[KGot] Mutation Validation Failed for ${operation}:`, e.message || e);
      }
    });
  }

  /**
   * Applies complex simulation results from the Unified Director to the graph.
   * Updates agent state, memories, relationships, and hidden secrets.
   */
  public applyPrefectSimulations(simulations: UnifiedDirectorOutput['prefect_simulations']): void {
    simulations.forEach(sim => {
        if (!this.graph.hasNode(sim.prefect_id)) {
            // Try resolving by name if ID miss
            const resolved = this.resolveTargetId(sim.prefect_name);
            if (resolved) sim.prefect_id = resolved;
            else return; 
        }

        // 1. Retrieve Current State
        const attrs = this.graph.getNodeAttributes(sim.prefect_id);
        // @ts-ignore
        const agentState = attrs.attributes.agent_state || {};
        
        // 2. Update Agent State (Emotion & Motivation)
        const updatedAgentState = {
            ...agentState,
            current_mood: this.deriveMoodFromState(sim.emotional_state),
            emotional_vector: sim.emotional_state,
            last_hidden_motivation: sim.hidden_motivation,
            last_public_action: sim.public_action
        };

        // 3. Update Secrets/Knowledge
        // @ts-ignore
        const currentSecrets = attrs.attributes.secrets || [];
        const newSecrets = [...new Set([...currentSecrets, ...(sim.secrets_uncovered || [])])];

        // 4. Merge Attributes
        this.graph.mergeNodeAttributes(sim.prefect_id, {
            attributes: {
                ...attrs.attributes,
                agent_state: updatedAgentState,
                secrets: newSecrets
            }
        });

        // 5. Handle Sabotage (Grudge Edge)
        if (sim.sabotage_attempt) {
             const targetId = this.resolveTargetId(sim.sabotage_attempt.target);
             if (targetId && this.graph.hasNode(targetId)) {
                 // Increase grudge intensity
                 this.updateGrudge(sim.prefect_id, targetId, 25); 
                 
                 // Add explicit edge for the attempt
                 this.addEdge(sim.prefect_id, targetId, 'SABOTAGE_ATTEMPT', 0.9, {
                     method: sim.sabotage_attempt.method,
                     deniability: sim.sabotage_attempt.deniability,
                     timestamp: this.globalState.turn_count,
                     desc: `Sabotage: ${sim.sabotage_attempt.method}`
                 });
             }
        }

        // 6. Handle Alliance Signals
        if (sim.alliance_signal) {
            const targetId = this.resolveTargetId(sim.alliance_signal.target);
            if (targetId && this.graph.hasNode(targetId)) {
                // Add positive edge
                this.addEdge(sim.prefect_id, targetId, 'ALLIANCE_SIGNAL', 0.6, {
                    message: sim.alliance_signal.message,
                    timestamp: this.globalState.turn_count,
                     desc: `Signal: ${sim.alliance_signal.message}`
                });
            }
        }

        // 7. Record Ephemeral Memory of Action
        this.addMemory(sim.prefect_id, {
            id: `mem_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
            description: `Action: ${sim.public_action} | Motivation: ${sim.hidden_motivation}`,
            emotional_imprint: `Paranoia: ${sim.emotional_state.paranoia}`,
            involved_entities: [],
            timestamp: this.globalState.turn_count
        });
    });
  }

  private deriveMoodFromState(state: { paranoia: number, desperation: number, confidence: number }): string {
    if (state.paranoia > 0.6) return "Paranoid";
    if (state.desperation > 0.6) return "Desperate";
    if (state.confidence > 0.7) return "Confident";
    if (state.confidence < 0.3) return "Anxious";
    return "Calculated";
  }

  private resolveTargetId(nameOrId: string): string | null {
    if (this.graph.hasNode(nameOrId)) return nameOrId;
    
    let foundId = null;
    // Simple fuzzy match on label or ID parts
    const search = nameOrId.toUpperCase();
    
    this.graph.forEachNode((id, attrs) => {
        // @ts-ignore
        const label = (attrs.label || "").toUpperCase();
        if (label.includes(search) || id.includes(search)) {
            foundId = id;
        }
        // Archetype match
        // @ts-ignore
        if (attrs.attributes?.agent_state?.archetype?.toUpperCase() === search) {
            foundId = id;
        }
    });
    
    // Handle common mapping aliases
    if (!foundId) {
        if (search.includes("PLAYER") || search.includes("SUBJECT")) return "Subject_84";
        if (search.includes("SELENE")) return "FACULTY_SELENE";
        if (search.includes("PETRA")) return "FACULTY_PETRA";
        if (search.includes("ELARA")) return "PREFECT_LOYALIST";
        if (search.includes("KAELEN")) return "PREFECT_OBSESSIVE";
        if (search.includes("RHEA")) return "PREFECT_DISSIDENT";
        if (search.includes("ANYA")) return "PREFECT_NURSE";
    }

    return foundId;
  }
}