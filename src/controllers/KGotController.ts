
import { KnowledgeGraph, KGotNode, KGotEdge, NodeType, Memory, AgentState } from '../lib/types/kgot';
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

  // --- Canonical Initialization (Deep State Integration) ---

  public initializeCanonicalNodes(): void {
    // --- FACULTY ---

    // Provost Selene: The Corrupted Matriarch
    this.addNode({
      id: "FACULTY_SELENE",
      type: "FACULTY",
      label: "Provost Selene",
      attributes: {
        manara_gaze: "Bored_God_Complex",
        description_abyss: "A figure of crimson velvet and glacial indifference.",
        agent_state: {
          archetype: "The Corrupted Matriarch",
          current_mood: "analytical",
          dominance_level: 1.0,
          boredom_level: 0.8, // Starts high, needs disruption
          voice_id: "selene_contralto"
        },
        memories: [],
        grudges: {}, // Tracks who has bored her
        active_schemes: ["Transmutation of Virility"]
      }
    });

    // Dr. Lysandra: The Vivisectionist
    this.addNode({
      id: "FACULTY_LOGICIAN",
      type: "FACULTY",
      label: "Dr. Lysandra",
      attributes: {
        manara_gaze: "Clinical_Observer",
        description_abyss: "Spectacles reflecting a world reduced to variables.",
        agent_state: {
          archetype: "The Vivisectionist",
          current_mood: "curious",
          dominance_level: 0.85,
          scientific_curiosity: 0.9,
          voice_id: "lysandra_monotone"
        },
        memories: [],
        grudges: {}, // Tracks who contaminated data
        active_schemes: ["Neural Mapping of Submission"]
      }
    });

    // Inquisitor Petra: The Kinetic Artist
    this.addNode({
      id: "FACULTY_PETRA",
      type: "FACULTY",
      label: "Inquisitor Petra",
      attributes: {
        manara_gaze: "Predatory_Manic",
        description_abyss: "A coiled spring of violence and leather.",
        agent_state: {
          archetype: "The Kinetic Artist",
          current_mood: "playful", // "Just joking"
          dominance_level: 0.95,
          kinetic_arousal: 0.7,
          boredom_level: 0.5,
          voice_id: "petra_soprano_giggle"
        },
        memories: [],
        grudges: {}, // Tracks who didn't break interestingly
        active_schemes: ["The Perfect Break"]
      }
    });

    // Confessor Calista: The Spider
    this.addNode({
      id: "FACULTY_CONFESSOR",
      type: "FACULTY",
      label: "Confessor Calista",
      attributes: {
        manara_gaze: "Sultry_Predator",
        description_abyss: "Softness weaponized into a trap.",
        agent_state: {
          archetype: "The Spider",
          current_mood: "maternal_predatory",
          dominance_level: 0.88,
          maternal_facade_strength: 0.95,
          voice_id: "calista_breathy_alto"
        },
        memories: [],
        grudges: {},
        active_schemes: ["Emotional Harvesting"]
      }
    });

    // Dr. Astra: The Pain Broker (Conflicted)
    this.addNode({
      id: "FACULTY_ASTRA",
      type: "FACULTY",
      label: "Dr. Astra",
      attributes: {
        manara_gaze: "Weary_Guilt",
        description_abyss: "Trembling hands holding a clipboard of horrors.",
        agent_state: {
          archetype: "The Pain Broker",
          current_mood: "conflicted",
          dominance_level: 0.6,
          guilt_level: 0.8, // Defining trait
          voice_id: "astra_tired_mezzo"
        },
        memories: [],
        grudges: {}
      }
    });

    // --- PREFECTS ---

    // Elara: The Loyalist
    this.addNode({
      id: "PREFECT_LOYALIST",
      type: "PREFECT",
      label: "Elara",
      attributes: {
        manara_gaze: "Wide_Eyed_Fanatic",
        agent_state: {
          archetype: "The Flinching Zealot",
          current_mood: "anxious",
          dominance_level: 0.4,
          loyalty_score: 0.95,
          anxiety_level: 0.7,
          voice_id: "elara_sharp"
        },
        memories: [],
        grudges: {}
      }
    });

    // Kaelen: The Obsessive
    this.addNode({
      id: "PREFECT_OBSESSIVE",
      type: "PREFECT",
      label: "Kaelen",
      attributes: {
        manara_gaze: "Yandere_Blank_Stare",
        agent_state: {
          archetype: "The Yandere",
          current_mood: "dere", // Starts sweet
          dominance_level: 0.5,
          obsession_level: 0.9,
          jealousy_meter: 0.0,
          dere_yan_state: "dere",
          target_of_interest: "Subject_84",
          voice_id: "kaelen_variable"
        },
        memories: [],
        grudges: {},
        active_schemes: ["Purification Ritual"]
      }
    });
    
    // Explicit edge for Kaelen's obsession
    this.addEdge("PREFECT_OBSESSIVE", "Subject_84", "OBSESSION", 1.0, { trope: "Yandere Focus" });

    // Rhea: The Dissident
    this.addNode({
      id: "PREFECT_DISSIDENT",
      type: "PREFECT",
      label: "Rhea",
      attributes: {
        manara_gaze: "Cynical_Guarded",
        agent_state: {
          archetype: "The Double Agent",
          current_mood: "cynical",
          dominance_level: 0.3,
          cover_integrity: 0.9, // High cover
          revolutionary_fervor: 0.8,
          voice_id: "rhea_low"
        },
        memories: [],
        grudges: { "FACULTY_SELENE": 90 }, // Deep hatred
        active_schemes: ["The Signal"]
      }
    });

    // Anya: The Nurse
    this.addNode({
      id: "PREFECT_NURSE",
      type: "PREFECT",
      label: "Anya",
      attributes: {
        manara_gaze: "Calculating_Warmth",
        agent_state: {
          archetype: "The False Healer",
          current_mood: "solicitous",
          dominance_level: 0.5,
          ambition_score: 0.8,
          voice_id: "anya_soothing"
        },
        memories: [],
        grudges: {},
        active_schemes: ["Information Brokerage"]
      }
    });

    // --- LOCATIONS ---

    this.addNode({
      id: "loc_calibration",
      type: "LOCATION",
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
      type: "LOCATION",
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
      type: "LOCATION",
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

  /**
   * Safely updates a specific attribute within a node's 'attributes' object.
   * Supports dot notation for nested keys (e.g. 'agent_state.current_mood').
   */
  public updateNodeAttribute(nodeId: string, attributeName: string, value: any): void {
    const node = this.graph.nodes[nodeId];
    if (!node) {
      console.warn(`[KGotController] Node ${nodeId} not found.`);
      return;
    }

    if (!node.attributes) {
      // @ts-ignore
      node.attributes = {};
    }

    const parts = attributeName.split('.');
    let current: any = node.attributes;

    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        // Create object if it doesn't exist or isn't an object
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }

    const lastKey = parts[parts.length - 1];
    current[lastKey] = value;
  }

  public addSubject(subjectId: string, initialState: any): void {
    this.addNode({
      id: subjectId,
      type: "SUBJECT",
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
    this.addEdge(source, target, 'TRAUMA_BOND', intensity, {
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
  
  public applyMutations(mutations: Array<{ operation: string, params?: any }>): void {
    mutations.forEach(mutation => {
      const { operation, params = {} } = mutation;
      
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
