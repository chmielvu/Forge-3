
import Graph from 'graphology';
import { z } from 'zod';
import { KnowledgeGraph, KGotNode, KGotEdge, NodeType, Memory } from '../lib/types/kgot';
import { YandereLedger } from '../types';
import { UnifiedDirectorOutput } from '../lib/schemas/unifiedDirectorSchema';
import { INITIAL_LEDGER } from '../constants';

// Graphology Algorithms
import pagerank from 'graphology-metrics/centrality/pagerank';
import betweennessCentrality from 'graphology-metrics/centrality/betweenness';
import { dijkstra } from 'graphology-shortest-path';
import louvain from 'graphology-communities-louvain';
import forceAtlas2 from 'graphology-layout-forceatlas2';

// --- VALIDATION SCHEMAS ---
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
    meta: z.record(z.string(), z.any()).optional()
  }),
  remove_edge: z.object({
    source: z.string().min(1),
    target: z.string().min(1)
  }),
  update_node: z.object({
    id: z.string().min(1),
    attributes: z.record(z.string(), z.any())
  }),
  add_node: z.object({
    id: z.string().min(1),
    type: z.string().optional(),
    label: z.string().optional(),
    attributes: z.record(z.string(), z.any()).optional()
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
 * Graphology Implementation (v4.2 - Resilient)
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
            const key = edge.key || `${edge.source}_${edge.target}_${edge.type}`;
            // Use internal addEdge logic which now has robust error handling
            this.addEdge(edge.source, edge.target, edge.label, edge.weight, edge.meta);
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
        // --- SUBJECT ---
        { 
            id: "Subject_84", 
            type: "SUBJECT", 
            label: "Subject 84", 
            attributes: { 
                agent_state: { 
                    archetype: "The Subject", 
                    current_mood: "Fearful", 
                    dominance_level: 0.1, 
                    voice_id: "Charon" 
                },
                ledger: INITIAL_LEDGER,
                currentLocation: "The Calibration Chamber"
            } 
        },

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

    this.addEdge("FACULTY_SELENE", "Subject_84", "dominance", 1.0, { trope: "owns_soul" });
    this.addEdge("PREFECT_OBSESSIVE", "Subject_84", "obsession", 1.0, { trope: "yandere_possession" });
  }

  // --- Graph Operations (Robust Error Handling) ---

  public addNode(node: KGotNode): void {
    let parsed;
    try {
        parsed = NodeSchema.parse(node);
    } catch (e) {
        console.warn(`[KGot] Node Schema Validation Failed for ${node.id}:`, e);
        return;
    }

    try {
        if (!(this.graph as any).hasNode(parsed.id)) {
            this.graph.addNode(parsed.id, {
                type: parsed.type,
                label: parsed.label,
                attributes: parsed.attributes
            });
        }
    } catch (e) {
        console.error(`[KGot] Graphology Error adding node ${parsed.id}:`, e);
    }
  }

  public batchAddNodes(nodes: KGotNode[]): void {
      nodes.forEach(n => this.addNode(n));
  }

  public removeNode(nodeId: string): void {
    try {
        if ((this.graph as any).hasNode(nodeId)) {
            this.graph.dropNode(nodeId);
        }
    } catch (e) {
        console.error(`[KGot] Error removing node ${nodeId}:`, e);
    }
  }

  public addEdge(sourceId: string, targetId: string, relation: string, weight: number = 0.5, meta?: any): void {
    if (!(this.graph as any).hasNode(sourceId)) {
        console.warn(`[KGot] addEdge ignored: Source ${sourceId} does not exist.`);
        return;
    }
    if (!(this.graph as any).hasNode(targetId)) {
        console.warn(`[KGot] addEdge ignored: Target ${targetId} does not exist.`);
        return;
    }

    let validParams;
    try {
        validParams = EdgeSchema.parse({ source: sourceId, target: targetId, label: relation, weight, meta });
    } catch(e) {
        console.warn(`[KGot] Edge Schema Validation Failed (${sourceId}->${targetId}):`, e);
        return;
    }

    const key = `${sourceId}_${targetId}_${relation}`;
    try {
        if (!(this.graph as any).hasEdge(key)) {
            this.graph.addEdgeWithKey(key, sourceId, targetId, {
                label: relation,
                type: meta?.type || 'RELATIONSHIP',
                weight,
                meta: meta || { tension: 0 }
            });
        } else {
            this.graph.setEdgeAttribute(key, 'weight', weight);
            if (meta) {
                const currentMeta = this.graph.getEdgeAttribute(key, 'meta');
                this.graph.setEdgeAttribute(key, 'meta', { ...currentMeta, ...meta });
            }
        }
    } catch (e) {
        console.error(`[KGot] Graphology Error adding edge ${key}:`, e);
    }
  }

  public removeEdge(sourceId: string, targetId: string): void {
    try {
        if ((this.graph as any).hasNode(sourceId) && (this.graph as any).hasNode(targetId)) {
            const edges = this.graph.edges(sourceId, targetId);
            edges.forEach(e => this.graph.dropEdge(e));
        }
    } catch (e) {
        console.error(`[KGot] Error removing edges between ${sourceId} and ${targetId}:`, e);
    }
  }

  // --- Director-Specific Mutation Handler ---
  
  public applyMutations(mutations: Array<{ operation: string, params?: any }>): void {
    mutations.forEach((mutation, idx) => {
      const { operation, params = {} } = mutation;
      
      try {
        switch (operation) {
          case 'add_edge': {
            let valid;
            try { valid = MutationSchemas.add_edge.parse(params); } 
            catch(e) { console.warn(`[KGot] Mutation ${idx} (add_edge) invalid params:`, e); return; }
            
            this.addEdge(valid.source, valid.target, valid.relation || valid.label || 'RELATIONSHIP', valid.weight, valid.meta);
            break;
          }
          
          case 'remove_edge': {
            let valid;
            try { valid = MutationSchemas.remove_edge.parse(params); }
            catch(e) { console.warn(`[KGot] Mutation ${idx} (remove_edge) invalid params:`, e); return; }
            
            this.removeEdge(valid.source, valid.target);
            break;
          }
          
          case 'update_node': {
            let valid;
            try { valid = MutationSchemas.update_node.parse(params); }
            catch(e) { console.warn(`[KGot] Mutation ${idx} (update_node) invalid params:`, e); return; }

            if ((this.graph as any).hasNode(valid.id)) {
               const currentAttrs = this.graph.getNodeAttributes(valid.id);
               this.graph.mergeNodeAttributes(valid.id, {
                   attributes: { ...currentAttrs.attributes, ...valid.attributes }
               });
            } else {
                console.warn(`[KGot] Mutation ${idx}: Node ${valid.id} not found for update.`);
            }
            break;
          }

          case 'add_node': {
            let valid;
            try { valid = MutationSchemas.add_node.parse(params); }
            catch(e) { console.warn(`[KGot] Mutation ${idx} (add_node) invalid params:`, e); return; }

            this.addNode({
                id: valid.id,
                type: valid.type || 'ENTITY',
                label: valid.label || valid.id,
                attributes: valid.attributes || {}
            });
            break;
          }

          case 'add_memory': {
              let valid;
              try { valid = MutationSchemas.add_memory.parse(params); }
              catch(e) { console.warn(`[KGot] Mutation ${idx} (add_memory) invalid params:`, e); return; }

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
              let valid;
              try { valid = MutationSchemas.update_grudge.parse(params); }
              catch(e) { console.warn(`[KGot] Mutation ${idx} (update_grudge) invalid params:`, e); return; }

              this.updateGrudge(valid.source, valid.target, valid.delta);
              break;
          }
              
          case 'add_trauma_bond': {
              let valid;
              try { valid = MutationSchemas.add_trauma_bond.parse(params); }
              catch(e) { console.warn(`[KGot] Mutation ${idx} (add_trauma_bond) invalid params:`, e); return; }

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
        console.error(`[KGot] Mutation ${idx} (${operation}) Execution Failed:`, e.message || e);
      }
    });
  }

  // --- Advanced Analysis (Graphology) ---

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

  public detectConspiracies(): string[][] {
    if (this.graph.order === 0) return [];
    try {
        const communities = louvain(this.graph);
        const groups: Record<string, string[]> = {};
        Object.entries(communities).forEach(([nodeId, communityId]) => {
            const key = String(communityId);
            if (!groups[key]) groups[key] = [];
            groups[key].push(nodeId);
        });
        return Object.values(groups).filter(g => g.length > 2);
    } catch (e) {
        console.warn("Louvain detection failed:", e);
        return [];
    }
  }

  public calculateDominancePath(source: string, target: string): string[] | null {
    if (!(this.graph as any).hasNode(source) || !(this.graph as any).hasNode(target)) return null;
    try {
        const path = dijkstra.bidirectional(this.graph, source, target, (edge, attr) => {
             return 1.0 - (attr.weight || 0.5);
        });
        return path || null;
    } catch (e) {
        return null;
    }
  }

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

  public knowledgeCompletion(threshold: number = 2): void {
    const nodes = this.graph.nodes();
    const limit = Math.min(nodes.length, 50); 
    
    for (let i = 0; i < limit; i++) {
        for (let j = i + 1; j < limit; j++) {
            const source = nodes[i];
            const target = nodes[j];
            if ((this.graph as any).hasEdge(source, target)) continue;
            try {
                const path = dijkstra.bidirectional(this.graph, source, target);
                if (path && path.length > 1 && path.length <= threshold + 1) { 
                    const inferredWeight = 0.4 / (path.length - 1); 
                    this.addEdge(source, target, 'INFERRED_BOND', inferredWeight, { type: 'LATENT', is_inferred: true });
                }
            } catch (e) {}
        }
    }
  }

  private getNodeFeatures(node: string, bc: Record<string, number>): number[] {
    const inDeg = this.graph.inDegree(node);
    const outDeg = this.graph.outDegree(node);
    const centrality = bc[node] || 0;
    return [inDeg, outDeg, centrality]; 
  }

  private origNode2Vec(dimensions: number = 16, walkLength: number = 10, numWalks: number = 20): Record<string, number[]> {
    const nodes = this.graph.nodes();
    const vectors: Record<string, number[]> = {};
    const contextVectors: Record<string, number[]> = {};

    nodes.forEach(node => {
        vectors[node] = Array.from({length: dimensions}, () => Math.random() - 0.5);
        contextVectors[node] = Array(dimensions).fill(0);
    });

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

    nodes.forEach(node => {
        const magnitude = Math.sqrt(contextVectors[node].reduce((sum, val) => sum + val * val, 0)) || 1;
        contextVectors[node] = contextVectors[node].map(v => v / magnitude);
    });

    return contextVectors;
  }

  public getNode2VecEmbeddings(dim: number = 16): Record<string, number[]> {
    this.knowledgeCompletion();
    let bc = {};
    try { bc = betweennessCentrality(this.graph); } catch (e) {}
    const rawEmbeds = this.origNode2Vec(dim);
    const enriched: Record<string, number[]> = {};
    this.graph.forEachNode(node => {
        const structuralFeats = this.getNodeFeatures(node, bc as Record<string, number>);
        if (rawEmbeds[node]) {
            enriched[node] = rawEmbeds[node].concat(structuralFeats);
        }
    });
    return enriched;
  }

  public async getGraphSAGEEmbeddings(layers = [16, 32, 16], epochs = 50, lr = 0.01): Promise<Record<string, number[]>> {
    const nodes = this.graph.nodes();
    const numNodes = nodes.length;
    if (numNodes === 0) return {};
    if (numNodes > 500) {
        console.warn(`[KGot] GraphSAGE Warning: Graph size too large. Falling back to Node2Vec.`);
        return this.getNode2VecEmbeddings();
    }

    try {
        const tf = await import('@tensorflow/tfjs');
        const nodeToIndex: Record<string, number> = {};
        nodes.forEach((n, i) => nodeToIndex[n] = i);

        const adjBuffer = tf.buffer([numNodes, numNodes]);
        this.graph.forEachEdge((e, a, src, tgt) => {
            const s = nodeToIndex[src];
            const t = nodeToIndex[tgt];
            if (s !== undefined && t !== undefined) {
                adjBuffer.set(1, s, t);
                adjBuffer.set(1, t, s); 
            }
        });
        
        for(let i=0; i<numNodes; i++) {
            let deg = 0;
            for(let j=0; j<numNodes; j++) if(adjBuffer.get(i, j)) deg++;
            deg = deg > 0 ? deg : 1; 
            for(let j=0; j<numNodes; j++) if(adjBuffer.get(i, j)) adjBuffer.set(1/deg, i, j);
        }
        
        const A = adjBuffer.toTensor();

        return tf.tidy(() => {
            const inputDim = layers[0];
            const initialFeatures = tf.randomNormal([numNodes, inputDim]);
            const w1 = tf.variable(tf.randomNormal([layers[0] * 2, layers[1]], 0, 0.1));
            const w2 = tf.variable(tf.randomNormal([layers[1] * 2, layers[2]], 0, 0.1));
            const optimizer = tf.train.adam(lr);

            const model = (x: any) => {
                const neigh1 = tf.matMul(A, x);
                const concat1 = tf.concat([x, neigh1], 1);
                const h1 = tf.relu(tf.matMul(concat1, w1));
                const norm1 = tf.div(h1, tf.norm(h1, 'euclidean', 1, true).add(1e-6));
                
                const neigh2 = tf.matMul(A, norm1);
                const concat2 = tf.concat([norm1, neigh2], 1);
                const h2 = tf.matMul(concat2, w2); 
                const norm2 = tf.div(h2, tf.norm(h2, 'euclidean', 1, true).add(1e-6));
                
                return norm2;
            };

            for(let i=0; i<epochs; i++) {
                optimizer.minimize(() => tf.mean(tf.square(tf.sub(model(initialFeatures), initialFeatures))));
            }

            const finalEmbeds = model(initialFeatures);
            const data = finalEmbeds.arraySync() as number[][];
            const result: Record<string, number[]> = {};
            nodes.forEach((n, i) => result[n] = data[i]);
            return result;
        });

    } catch (e) {
        console.warn("GraphSAGE failed (tfjs likely missing or error):", e);
        return this.getNode2VecEmbeddings();
    }
  }

  public updateLedger(subjectId: string, deltas: Partial<YandereLedger>): void {
    if (!(this.graph as any).hasNode(subjectId)) return;
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
    this.graph.mergeNodeAttributes(subjectId, { attributes: { ...attrs.attributes, ledger } });
  }

  public addMemory(nodeId: string, memory: Memory): void {
    if (!(this.graph as any).hasNode(nodeId)) return;
    const attrs = this.graph.getNodeAttributes(nodeId);
    // @ts-ignore
    const memories = attrs.attributes.memories || [];
    memories.push(memory);
    if (memories.length > 20) memories.shift();
    this.graph.mergeNodeAttributes(nodeId, { attributes: { ...attrs.attributes, memories } });
  }

  public updateGrudge(holderId: string, targetId: string, delta: number): void {
    if (!(this.graph as any).hasNode(holderId)) return;
    const attrs = this.graph.getNodeAttributes(holderId);
    // @ts-ignore
    const grudges = attrs.attributes.grudges || {};
    const current = grudges[targetId] || 0;
    const newVal = Math.max(0, Math.min(100, current + delta));
    grudges[targetId] = newVal;
    this.graph.mergeNodeAttributes(holderId, { attributes: { ...attrs.attributes, grudges } });
    if (newVal > 50) {
        this.addEdge(holderId, targetId, 'GRUDGE', newVal / 100, { intensity: newVal, trope: 'Burning Hatred' });
    }
  }

  // --- Unified Director Logic Bridge ---
  public applyPrefectSimulations(simulations: UnifiedDirectorOutput['prefect_simulations']): void {
    simulations.forEach(sim => {
        if (!(this.graph as any).hasNode(sim.prefect_id)) {
            const resolved = this.resolveTargetId(sim.prefect_name);
            if (resolved) sim.prefect_id = resolved;
            else return; 
        }
        const attrs = this.graph.getNodeAttributes(sim.prefect_id);
        // @ts-ignore
        const agentState = attrs.attributes.agent_state || {};
        const updatedAgentState = {
            ...agentState,
            current_mood: this.deriveMoodFromState(sim.emotional_state),
            emotional_vector: sim.emotional_state,
            last_hidden_motivation: sim.hidden_motivation,
            last_public_action: sim.public_action
        };
        // @ts-ignore
        const currentSecrets = attrs.attributes.secrets || [];
        const newSecrets = [...new Set([...currentSecrets, ...(sim.secrets_uncovered || [])])];
        this.graph.mergeNodeAttributes(sim.prefect_id, {
            attributes: {
                ...attrs.attributes,
                agent_state: updatedAgentState,
                secrets: newSecrets
            }
        });
        if (sim.sabotage_attempt) {
             const targetId = this.resolveTargetId(sim.sabotage_attempt.target);
             if (targetId && (this.graph as any).hasNode(targetId)) {
                 this.updateGrudge(sim.prefect_id, targetId, 25); 
                 this.addEdge(sim.prefect_id, targetId, 'SABOTAGE_ATTEMPT', 0.9, {
                     method: sim.sabotage_attempt.method,
                     deniability: sim.sabotage_attempt.deniability,
                     timestamp: this.globalState.turn_count,
                     desc: `Sabotage: ${sim.sabotage_attempt.method}`
                 });
             }
        }
        if (sim.alliance_signal) {
            const targetId = this.resolveTargetId(sim.alliance_signal.target);
            if (targetId && (this.graph as any).hasNode(targetId)) {
                this.addEdge(sim.prefect_id, targetId, 'ALLIANCE_SIGNAL', 0.6, {
                    message: sim.alliance_signal.message,
                    timestamp: this.globalState.turn_count,
                     desc: `Signal: ${sim.alliance_signal.message}`
                });
            }
        }
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
    if ((this.graph as any).hasNode(nameOrId)) return nameOrId;
    let foundId = null;
    const search = nameOrId.toUpperCase();
    this.graph.forEachNode((id, attrs) => {
        // @ts-ignore
        const label = (attrs.label || "").toUpperCase();
        if (label.includes(search) || id.includes(search)) foundId = id;
        // @ts-ignore
        if (attrs.attributes?.agent_state?.archetype?.toUpperCase() === search) foundId = id;
    });
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
