
import { KnowledgeGraph, KGotNode, KGotEdge, NodeType, Memory } from '../lib/types/kgot';
import { YandereLedger } from '../types';

/**
 * The Forge's Loom: Knowledge Graph of Thoughts (KGoT) Engine
 * TypeScript Implementation of the "NetworkX" Logic
 */
export class KGotController {
  private graph: KnowledgeGraph;

  constructor(initialGraph: KnowledgeGraph) {
    // Deep copy to ensure immutable-style updates
    this.graph = JSON.parse(JSON.stringify(initialGraph));
    
    // Auto-initialize if empty
    if (Object.keys(this.graph.nodes).length === 0) {
      this.initializeCanonicalNodes();
    }
  }

  public getGraph(): KnowledgeGraph {
    return this.graph;
  }

  // --- Canonical Initialization (Ported from Python) ---

  public initializeCanonicalNodes(): void {
    // Faculty
    this.addNode({
      id: "FACULTY_PROVOST",
      type: "faculty",
      label: "Provost Selene",
      attributes: {
        archetype: "The Corrupted Matriarch",
        manara_gaze: "Bored_God_Complex",
        dominance: 1.0,
        current_mood: "analytical",
        voice_id: "selene_contralto",
        memories: [],
        grudges: {}
      }
    });

    this.addNode({
      id: "FACULTY_LOGICIAN",
      type: "faculty",
      label: "Dr. Lysandra",
      attributes: {
        archetype: "The Vivisectionist",
        manara_gaze: "Clinical_Observer",
        dominance: 0.85,
        voice_id: "lysandra_monotone",
        memories: [],
        grudges: {}
      }
    });

    this.addNode({
      id: "FACULTY_INQUISITOR",
      type: "faculty",
      label: "Inquisitor Petra",
      attributes: {
        archetype: "The Kinetic Artist",
        manara_gaze: "Predatory_Manic",
        dominance: 0.9,
        kinetic_state: "playful",
        voice_id: "petra_soprano_giggle",
        memories: [],
        grudges: {}
      }
    });

    this.addNode({
      id: "FACULTY_CONFESSOR",
      type: "faculty",
      label: "Confessor Calista",
      attributes: {
        archetype: "The Spider",
        manara_gaze: "Sultry_Predator",
        dominance: 0.88,
        manipulation_mode: "hurt_comfort",
        voice_id: "calista_breathy_alto",
        memories: [],
        grudges: {}
      }
    });

    // Prefects
    this.addNode({
      id: "PREFECT_LOYALIST",
      type: "prefect",
      label: "Elara",
      attributes: {
        archetype: "The Flinching Zealot",
        loyalty_score: 0.95,
        doubt_level: 0.6,
        ocean: { O: 0.3, C: 0.9, E: 0.4, A: 0.5, N: 0.7 },
        memories: [],
        grudges: {}
      }
    });

    this.addNode({
      id: "PREFECT_OBSESSIVE",
      type: "prefect",
      label: "Kaelen",
      attributes: {
        archetype: "The Yandere",
        obsession_target: null,
        dere_yan_state: "dere",
        ocean: { O: 0.4, C: 0.6, E: 0.3, A: 0.2, N: 0.9 },
        memories: [],
        grudges: {}
      }
    });

    this.addNode({
      id: "PREFECT_DISSIDENT",
      type: "prefect",
      label: "Rhea",
      attributes: {
        archetype: "The Double Agent",
        cover_integrity: 0.8,
        true_loyalty: "revolution",
        ocean: { O: 0.8, C: 0.7, E: 0.5, A: 0.7, N: 0.6 },
        memories: [],
        grudges: {}
      }
    });

    this.addNode({
      id: "PREFECT_NURSE",
      type: "prefect",
      label: "Anya",
      attributes: {
        archetype: "The False Healer",
        intelligence_value: 0.7,
        trust_facade: 0.9,
        ocean: { O: 0.7, C: 0.8, E: 0.6, A: 0.4, N: 0.3 },
        memories: [],
        grudges: {}
      }
    });

    // Locations
    this.addNode({
      id: "loc_calibration",
      type: "location",
      label: "The Calibration Chamber",
      attributes: {
        noir_lighting_state: "Clinical_Spotlight",
        surface_reflectivity: 0.9,
        architectural_oppression: 0.95,
        description_abyss: "A temple of cold iron and silence"
      }
    });

    this.addNode({
      id: "loc_confessional",
      type: "location",
      label: "The Velvet Confessional",
      attributes: {
        noir_lighting_state: "Venetian_Blind_Amber",
        surface_reflectivity: 0.3,
        architectural_oppression: 0.4,
        description_abyss: "A velvet trap of false sanctuary"
      }
    });

    this.addNode({
      id: "loc_infirmary",
      type: "location",
      label: "Infirmary",
      attributes: {
        noir_lighting_state: "Clinical_Cold_White",
        surface_reflectivity: 0.7,
        architectural_oppression: 0.5,
        description_abyss: "The white lie of healing"
      }
    });
  }

  // --- Graph Operations ---

  public addNode(node: KGotNode): void {
    if (!this.graph.nodes[node.id]) {
        this.graph.nodes[node.id] = node;
    }
  }

  public removeNode(nodeId: string): void {
    if (this.graph.nodes[nodeId]) {
      delete this.graph.nodes[nodeId];
      this.graph.edges = this.graph.edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );
    }
  }

  public addEdge(sourceId: string, targetId: string, relation: string, weight: number = 0.5, meta?: any): void {
    const existingIndex = this.graph.edges.findIndex(
      e => e.source === sourceId && e.target === targetId && e.label === relation
    );

    if (existingIndex !== -1) {
      this.graph.edges[existingIndex].weight = weight;
      if (meta) {
        this.graph.edges[existingIndex].meta = { ...this.graph.edges[existingIndex].meta, ...meta };
      }
    } else {
      const newEdge: KGotEdge = {
        source: sourceId,
        target: targetId,
        type: 'RELATIONSHIP',
        label: relation,
        weight,
        meta: meta || { tension: 0, is_secret: false }
      };
      this.graph.edges.push(newEdge);
    }
  }

  public removeEdge(sourceId: string, targetId: string): void {
    this.graph.edges = this.graph.edges.filter(
      e => !(e.source === sourceId && e.target === targetId)
    );
  }

  // --- Specialized Updates (Python Port) ---

  public addSubject(subjectId: string, initialState: any): void {
    this.addNode({
      id: subjectId,
      type: "subject",
      label: initialState.name || "Subject",
      attributes: {
        ledger: {
          subjectId: subjectId,
          physicalIntegrity: 100,
          traumaLevel: 0,
          shamePainAbyssLevel: 0,
          hopeLevel: 50,
          complianceScore: 0,
          fearOfAuthority: 0,
          desireForValidation: 0,
          capacityForManipulation: 0,
          arousalLevel: 0,
          prostateSensitivity: 0,
          ruinedOrgasmCount: 0,
          castrationAnxiety: 0,
          traumaBonds: {},
          phase: 'alpha'
        },
        memories: [],
        grudges: {},
        ...initialState
      }
    });
  }

  public addTraumaBond(source: string, target: string, bondType: string, intensity: number): void {
    this.addEdge(source, target, 'trauma_bond', intensity, {
      type: "trauma_bond",
      bond_type: bondType,
      intensity,
      timestamp: new Date().toISOString()
    });
    
    // Also update ledger if target is subject
    const targetNode = this.graph.nodes[target];
    if (targetNode && targetNode.attributes.ledger) {
      const bonds = targetNode.attributes.ledger.traumaBonds || {};
      bonds[source] = (bonds[source] || 0) + intensity;
      targetNode.attributes.ledger.traumaBonds = bonds;
    }
  }

  public updateLedger(subjectId: string, deltas: Partial<YandereLedger>): void {
    const node = this.graph.nodes[subjectId];
    if (!node || !node.attributes.ledger) return;

    const ledger = node.attributes.ledger;
    
    // Apply updates with clamping logic
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
  }

  // --- Memory & Relationship Management ---

  public addMemory(nodeId: string, memory: Memory): void {
    const node = this.graph.nodes[nodeId];
    if (node) {
        if (!node.attributes.memories) node.attributes.memories = [];
        node.attributes.memories.push(memory);
        
        // Trim old memories to save context
        if (node.attributes.memories.length > 20) {
            node.attributes.memories.shift();
        }
    }
  }

  public updateGrudge(holderId: string, targetId: string, intensityDelta: number): void {
    const node = this.graph.nodes[holderId];
    if (node) {
        if (!node.attributes.grudges) node.attributes.grudges = {};
        const current = node.attributes.grudges[targetId] || 0;
        const newVal = Math.max(0, Math.min(100, current + intensityDelta));
        node.attributes.grudges[targetId] = newVal;

        // Also explicitly reflect significant grudges as edges for graph visualization
        if (newVal > 50) {
            this.addEdge(holderId, targetId, 'GRUDGE', newVal / 100, {
                intensity: newVal,
                trope: 'Burning Hatred'
            });
        }
    }
  }

  // --- Director-Specific Mutation Handler ---
  
  public applyMutations(mutations: Array<{ operation: string, params: any }>): void {
    mutations.forEach(mutation => {
      const { operation, params } = mutation;
      
      switch (operation) {
        case 'add_edge':
          this.addEdge(params.source, params.target, params.relation || params.label, params.weight || 0.5, params.meta);
          break;
          
        case 'remove_edge':
          this.removeEdge(params.source, params.target);
          break;
          
        case 'update_node':
          // Update attributes of existing node
          if (this.graph.nodes[params.id]) {
             this.graph.nodes[params.id].attributes = {
                ...this.graph.nodes[params.id].attributes,
                ...params.attributes
             };
          }
          break;

        case 'add_node':
          this.addNode({
              id: params.id,
              type: params.type || 'ENTITY',
              label: params.label || params.id,
              attributes: params.attributes || {}
          });
          break;

        case 'add_memory':
            this.addMemory(params.id, {
                id: `mem_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
                description: params.description,
                emotional_imprint: params.emotional_imprint,
                involved_entities: params.involved_entities || [],
                timestamp: this.graph.global_state.turn_count
            });
            break;

        case 'update_grudge':
            this.updateGrudge(params.source, params.target, params.delta);
            break;
      }
    });
  }

  // --- Graph Algorithms (TS Implementation of NetworkX) ---

  /**
   * Simple iterative PageRank implementation to determine Social Hierarchy.
   */
  public getSocialHierarchy(): [string, number][] {
    const d = 0.85;
    const maxIter = 20;
    const nodes = Object.keys(this.graph.nodes);
    const N = nodes.length;
    if (N === 0) return [];

    let ranks: Record<string, number> = {};
    nodes.forEach(n => ranks[n] = 1 / N);

    for (let i = 0; i < maxIter; i++) {
      const newRanks: Record<string, number> = {};
      let sinkRankSum = 0;

      // Identify sinks (nodes with no outbound edges)
      nodes.forEach(u => {
         const outEdges = this.graph.edges.filter(e => e.source === u);
         if (outEdges.length === 0) sinkRankSum += ranks[u];
      });

      nodes.forEach(u => {
        let rankSum = 0;
        // Find nodes pointing to u
        const inEdges = this.graph.edges.filter(e => e.target === u);
        
        inEdges.forEach(e => {
            const v = e.source;
            const outEdgesV = this.graph.edges.filter(edge => edge.source === v);
            const L = outEdgesV.length;
            if (L > 0) rankSum += ranks[v] / L;
        });

        newRanks[u] = (1 - d) / N + d * (rankSum + sinkRankSum / N);
      });
      ranks = newRanks;
    }

    return Object.entries(ranks).sort((a, b) => b[1] - a[1]);
  }

  /**
   * Detects Conspiracies (Connected Components of 'secret_alliance' edges).
   */
  public detectConspiracies(): string[][] {
    const secretEdges = this.graph.edges.filter(e => e.type === 'secret_alliance' || e.label === 'secret_alliance');
    const nodes = new Set<string>();
    const adj: Record<string, string[]> = {};

    secretEdges.forEach(e => {
        nodes.add(e.source);
        nodes.add(e.target);
        if (!adj[e.source]) adj[e.source] = [];
        if (!adj[e.target]) adj[e.target] = [];
        adj[e.source].push(e.target);
        adj[e.target].push(e.source);
    });

    const visited = new Set<string>();
    const components: string[][] = [];

    nodes.forEach(node => {
        if (!visited.has(node)) {
            const component: string[] = [];
            const queue = [node];
            visited.add(node);
            while (queue.length > 0) {
                const u = queue.shift()!;
                component.push(u);
                if (adj[u]) {
                    adj[u].forEach(v => {
                        if (!visited.has(v)) {
                            visited.add(v);
                            queue.push(v);
                        }
                    });
                }
            }
            components.push(component);
        }
    });

    return components;
  }

  /**
   * Calculates Narrative Entropy based on trope diversity.
   */
  public calculateNarrativeEntropy(): number {
    const tropes = this.graph.edges
      .map(e => e.meta?.trope || e.label) // Use label if trope missing
      .filter(t => t);
    
    if (tropes.length === 0) return 0;

    const counts: Record<string, number> = {};
    tropes.forEach(t => counts[t] = (counts[t] || 0) + 1);

    const total = tropes.length;
    let entropy = 0;
    Object.values(counts).forEach(count => {
        const p = count / total;
        entropy -= p * Math.log2(p);
    });

    return entropy;
  }

  /**
   * Dijkstra implementation for Dominance Path.
   * Assumes weight represents "resistance" (so lower weight = easier dominance flow).
   * Or if weight is "strength", we invert it. Let's assume weight is strength (0-1), so cost = 1 - weight.
   */
  public calculateDominancePath(source: string, target: string): string[] | null {
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const nodes = Object.keys(this.graph.nodes);
    
    nodes.forEach(n => {
        dist[n] = Infinity;
        prev[n] = null;
    });
    dist[source] = 0;

    const queue = new Set(nodes);

    while (queue.size > 0) {
        let u: string | null = null;
        let minDist = Infinity;
        
        queue.forEach(node => {
            if (dist[node] < minDist) {
                minDist = dist[node];
                u = node;
            }
        });

        if (u === null || u === target) break;
        queue.delete(u);

        const neighbors = this.graph.edges
            .filter(e => e.source === u)
            .map(e => ({ id: e.target, weight: e.weight }));

        for (const v of neighbors) {
            if (queue.has(v.id)) {
                const alt = dist[u] + (1 - v.weight); // Cost logic
                if (alt < dist[v.id]) {
                    dist[v.id] = alt;
                    prev[v.id] = u;
                }
            }
        }
    }

    if (prev[target] || source === target) {
        const path: string[] = [];
        let u: string | null = target;
        while (u) {
            path.unshift(u);
            u = prev[u];
        }
        return path;
    }

    return null;
  }

  public applyDelta(delta: {
    nodes_added?: any[];
    nodes_removed?: string[];
    edges_added?: { source: string; target: string; relation: string; weight: number }[];
    edges_removed?: { source: string; target: string }[];
  }): void {
    if (delta.nodes_added) {
      delta.nodes_added.forEach(n => {
         // Respect provided attributes or default
         const node: KGotNode = {
           id: n.id,
           type: n.type || 'ENTITY',
           label: n.label || n.id,
           attributes: n.attributes || { ...n }
         };
         this.addNode(node);
      });
    }

    if (delta.nodes_removed) {
      delta.nodes_removed.forEach(id => this.removeNode(id));
    }

    if (delta.edges_added) {
      delta.edges_added.forEach(e => {
         this.addEdge(e.source, e.target, e.relation, e.weight);
      });
    }

    if (delta.edges_removed) {
      delta.edges_removed.forEach(e => {
         this.removeEdge(e.source, e.target);
      });
    }
  }
}
