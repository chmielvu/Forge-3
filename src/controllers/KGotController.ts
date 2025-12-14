
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
  }),
  add_injury: z.object({
    target_id: z.string().min(1),
    source_id: z.string().min(1),
    injury_name: z.string().min(1),
    severity: z.number().optional(),
    grammar_phase: z.string().optional()
  }),
  add_subject_secret: z.object({
    subject_id: z.string().min(1),
    secret_name: z.string().min(1),
    secret_description: z.string().min(1),
    discovered_by: z.string().optional()
  })
};

/**
 * The Forge's Loom: Knowledge Graph of Thoughts (KGoT) Engine
 * Graphology Implementation (v4.2 - Resilient)
 */
export class KGotController {
  private graph: Graph;
  private globalState: KnowledgeGraph['global_state'];

  // Strict Entity Map for O(1) Resolution
  private readonly ENTITY_MAP: Record<string, string> = {
    "selene": "FACULTY_SELENE",
    "provost": "FACULTY_SELENE",
    "magistra": "FACULTY_SELENE",
    "petra": "FACULTY_PETRA",
    "inquisitor": "FACULTY_PETRA",
    "lysandra": "FACULTY_LOGICIAN",
    "logician": "FACULTY_LOGICIAN",
    "calista": "FACULTY_CONFESSOR",
    "confessor": "FACULTY_CONFESSOR",
    "astra": "FACULTY_ASTRA",
    "elara": "PREFECT_LOYALIST",
    "kaelen": "PREFECT_OBSESSIVE",
    "rhea": "PREFECT_DISSIDENT",
    "anya": "PREFECT_NURSE",
    "nico": "Subject_Nico",
    "darius": "Subject_Darius",
    "silas": "Subject_Silas",
    "theo": "Subject_Theo",
    "subject": "Subject_84",
    "player": "Subject_84",
    "me": "Subject_84",
    "infirmary": "loc_infirmary",
    "clinic": "loc_infirmary"
  };

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
    this.graph.forEachNode((id, nodeAttrs) => {
      nodes[id] = {
        id,
        type: nodeAttrs.type as NodeType,
        label: nodeAttrs.label as string,
        attributes: nodeAttrs.attributes as any
      };
    });

    const edges: KGotEdge[] = [];
    this.graph.forEachEdge((key, edgeAttrs, source, target) => {
      edges.push({
        key,
        source,
        target,
        type: edgeAttrs.type as string,
        label: edgeAttrs.label as string,
        weight: edgeAttrs.weight as number,
        meta: edgeAttrs.meta
      });
    });

    return {
      nodes,
      edges,
      global_state: this.globalState
    };
  }

  // --- NARRATIVE SPOTLIGHT (Context Optimization) ---
  
  /**
   * Returns a culled subgraph containing only nodes and edges relevant 
   * to the current scene context. Drastically reduces token usage.
   */
  public getNarrativeSpotlight(
    subjectId: string, 
    locationId: string, 
    activePrefectIds: string[]
  ): object {
    const spotlightNodes = new Set<string>([subjectId, locationId, ...activePrefectIds]);
    const spotlightEdges: any[] = [];

    const safeAddNode = (id: string) => {
        if (this.graph.hasNode(id)) spotlightNodes.add(id);
    };

    // 1. Add 1st-degree connections of the Subject (Memories, Injuries, Grudges)
    if (this.graph.hasNode(subjectId)) {
        this.graph.forEachNeighbor(subjectId, (neighbor, attr) => {
            const edges = this.graph.edges(subjectId, neighbor);
            edges.forEach(edgeId => {
                const edgeAttrs = this.graph.getEdgeAttributes(edgeId);
                // Filter: Only relevant edges (High intensity OR Recent)
                const weight = (edgeAttrs.weight as number) || 0;
                // Note: We don't track 'last_active_turn' on edges by default in graphology unless we set it
                // Assuming high weight or specific types
                if (weight > 0.3 || edgeAttrs.type === 'INJURY_LINK' || edgeAttrs.type === 'GRUDGE') {
                    safeAddNode(neighbor);
                    spotlightEdges.push({ source: subjectId, target: neighbor, ...edgeAttrs });
                }
            });
        });
    }

    // 2. Add relationships between active NPCs in the scene (e.g., Elara vs Rhea)
    activePrefectIds.forEach(idA => {
        activePrefectIds.forEach(idB => {
            if (idA === idB) return;
            if (this.graph.hasNode(idA) && this.graph.hasNode(idB)) {
                 const edges = this.graph.edges(idA, idB);
                 edges.forEach(edgeId => {
                     spotlightEdges.push({ 
                         source: idA, 
                         target: idB, 
                         ...this.graph.getEdgeAttributes(edgeId) 
                     });
                 });
            }
        });
    });

    // 3. Serialize only the spotlighted subgraph
    const nodes: Record<string, any> = {};
    spotlightNodes.forEach(id => {
        if (this.graph.hasNode(id)) {
            nodes[id] = this.graph.getNodeAttributes(id);
        }
    });

    return {
        global_state: this.globalState,
        spotlight_nodes: nodes,
        spotlight_edges: spotlightEdges
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
                currentLocation: "The Calibration Chamber",
                secrets: [] 
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
        { id: "loc_confessional", type: "LOCATION", label: "The Velvet Confessional", attributes: { noir_lighting_state: "Venetian_Blind_Amber", architectural_oppression: 0.4 } },
        { id: "loc_infirmary", type: "LOCATION", label: "The Infirmary", attributes: { noir_lighting_state: "Sterile_Fluorescent", architectural_oppression: 0.6 } } 
    ];

    this.batchAddNodes(canonicalNodes);

    this.addEdge("FACULTY_SELENE", "Subject_84", "dominance", 1.0, { trope: "owns_soul" });
    this.addEdge("PREFECT_OBSESSIVE", "Subject_84", "obsession", 1.0, { trope: "yandere_possession" });
    this.addEdge("PREFECT_NURSE", "loc_infirmary", "works_in", 0.8, { type: "SPATIAL" });
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
        if (!this.graph.hasNode(parsed.id)) {
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
        if (this.graph.hasNode(nodeId)) {
            this.graph.dropNode(nodeId);
        }
    } catch (e) {
        console.error(`[KGot] Error removing node ${nodeId}:`, e);
    }
  }

  public addEdge(sourceId: string, targetId: string, relation: string, weight: number = 0.5, meta?: any): void {
    if (!this.graph.hasNode(sourceId)) {
        console.warn(`[KGot] addEdge ignored: Source ${sourceId} does not exist.`);
        return;
    }
    if (!this.graph.hasNode(targetId)) {
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
        // DEDUPLICATION & DECAY LOGIC
        // Check for existing similar edge types between these nodes to prevent bloating.
        // We filter for edges of the same semantic 'type' (e.g. 'RELATIONSHIP') but potentially different labels.
        const existingEdges = this.graph.edges(sourceId, targetId).filter(e => 
            this.graph.getEdgeAttribute(e, 'type') === (meta?.type || 'RELATIONSHIP')
        );
        
        // Decay existing edges to represent memory fade/focus shift.
        // This ensures that the most recent edge is the dominant one, while older ones fade.
        existingEdges.forEach(e => {
            const currentWeight = this.graph.getEdgeAttribute(e, 'weight');
            this.graph.setEdgeAttribute(e, 'weight', currentWeight * 0.8);
        });

        // Add or Update the new edge
        if (!this.graph.hasEdge(key)) {
            this.graph.addEdgeWithKey(key, sourceId, targetId, {
                label: relation,
                type: meta?.type || 'RELATIONSHIP',
                weight,
                meta: meta || { tension: 0 }
            });
        } else {
            // If the exact same edge exists, we refresh its weight (superseding the decay above)
            this.graph.setEdgeAttribute(key, 'weight', weight);
            if (meta) {
                const currentMeta = this.graph.getEdgeAttribute(key, 'meta');
                this.graph.setEdgeAttribute(key, 'meta', { ...currentMeta, ...meta });
            }
        }
        
        // Update Activity Timestamp for Magellan & Centrality Analysis
        const turn = this.globalState.turn_count;
        if (this.graph.hasNode(sourceId)) {
            this.graph.mergeNodeAttributes(sourceId, { last_active_turn: turn });
        }
        if (this.graph.hasNode(targetId)) {
            this.graph.mergeNodeAttributes(targetId, { last_active_turn: turn });
        }

    } catch (e) {
        console.error(`[KGot] Graphology Error adding edge ${key}:`, e);
    }
  }

  public removeEdge(sourceId: string, targetId: string): void {
    try {
        if (this.graph.hasNode(sourceId) && this.graph.hasNode(targetId)) {
            const edges = this.graph.edges(sourceId, targetId);
            edges.forEach(e => this.graph.dropEdge(e));
        }
    } catch (e) {
        console.error(`[KGot] Error removing edges between ${sourceId} and ${targetId}:`, e);
    }
  }

  /**
   * Performs a graph hygiene pass to remove low-weight edges.
   * Uses centrality analysis to protect edges connected to key narrative figures.
   */
  public pruneGraph(weightThreshold: number = 0.1): void {
    // 1. Calculate Centrality to protect key nodes (e.g. The Provost)
    let scores: Record<string, number> = {};
    try {
        scores = pagerank(this.graph) as Record<string, number>; 
    } catch (e) {
        console.warn("PageRank failed:", e);
    }

    const edgesToRemove: string[] = [];
    
    // 2. Identify weak edges
    this.graph.forEachEdge((edge, edgeAttrs, source, target) => {
        const w = edgeAttrs.weight as number;
        // Protect edges connected to high centrality nodes
        const importance = (scores[source] || 0) + (scores[target] || 0);
        
        // Dynamic threshold: Important nodes keep weaker edges longer
        const effectiveThreshold = weightThreshold * (1.0 - Math.min(importance * 5, 0.8));
        
        if (w < effectiveThreshold) {
            edgesToRemove.push(edge);
        }
    });

    // 3. Remove them
    edgesToRemove.forEach(e => this.graph.dropEdge(e));
    if (edgesToRemove.length > 0) {
        console.log(`[KGot] Pruned ${edgesToRemove.length} weak edges. Centrality protection active.`);
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
            
            const src = this.resolveTargetId(valid.source);
            const tgt = this.resolveTargetId(valid.target);
            if (src && tgt) {
                this.addEdge(src, tgt, valid.relation || valid.label || 'RELATIONSHIP', valid.weight, valid.meta);
            }
            break;
          }
          
          case 'remove_edge': {
            let valid;
            try { valid = MutationSchemas.remove_edge.parse(params); }
            catch(e) { console.warn(`[KGot] Mutation ${idx} (remove_edge) invalid params:`, e); return; }
            
            const src = this.resolveTargetId(valid.source);
            const tgt = this.resolveTargetId(valid.target);
            if (src && tgt) this.removeEdge(src, tgt);
            break;
          }
          
          case 'update_node': {
            let valid;
            try { valid = MutationSchemas.update_node.parse(params); }
            catch(e) { console.warn(`[KGot] Mutation ${idx} (update_node) invalid params:`, e); return; }

            const id = this.resolveTargetId(valid.id);
            if (id && this.graph.hasNode(id)) {
               const currentAttrs = this.graph.getNodeAttributes(id);
               this.graph.mergeNodeAttributes(id, {
                   attributes: { ...currentAttrs.attributes, ...valid.attributes }
               });
            }
            break;
          }

          case 'add_node': {
            // ... (Add node is usually for new entities, direct ID usage is fine or resolved manually)
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

              const id = this.resolveTargetId(valid.id);
              if (id) {
                  this.addMemory(id, {
                      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
                      description: valid.description,
                      emotional_imprint: valid.emotional_imprint || 'Neutral',
                      involved_entities: valid.involved_entities || [],
                      timestamp: this.globalState.turn_count
                  });
              }
              break;
          }

          case 'update_grudge': {
              let valid;
              try { valid = MutationSchemas.update_grudge.parse(params); }
              catch(e) { console.warn(`[KGot] Mutation ${idx} (update_grudge) invalid params:`, e); return; }

              const src = this.resolveTargetId(valid.source);
              const tgt = this.resolveTargetId(valid.target);
              if (src && tgt) this.updateGrudge(src, tgt, valid.delta);
              break;
          }
              
          case 'add_trauma_bond': {
              let valid;
              try { valid = MutationSchemas.add_trauma_bond.parse(params); }
              catch(e) { console.warn(`[KGot] Mutation ${idx} (add_trauma_bond) invalid params:`, e); return; }

              const src = this.resolveTargetId(valid.source);
              const tgt = this.resolveTargetId(valid.target);
              if (src && tgt) {
                  this.addEdge(src, tgt, 'TRAUMA_BOND', valid.intensity || 0.5, {
                      type: "trauma_bond",
                      bond_type: valid.bond_type || "dependency",
                      intensity: valid.intensity,
                      timestamp: new Date().toISOString()
                  });
              }
              break;
          }

          case 'add_injury': {
              let valid;
              try { valid = MutationSchemas.add_injury.parse(params); }
              catch(e) { console.warn(`[KGot] Mutation ${idx} (add_injury) invalid params:`, e); return; }

              const targetId = this.resolveTargetId(valid.target_id);
              const sourceId = this.resolveTargetId(valid.source_id);
              
              if (!targetId || !sourceId) {
                  console.warn(`[KGot] Invalid target/source for injury: ${valid.target_id} -> ${valid.source_id}`);
                  return;
              }

              // DETERMINISTIC ID: Enables updating existing injuries instead of duplicating
              const normalizedInjuryName = valid.injury_name.trim().replace(/\s+/g, '_').toUpperCase();
              const injuryNodeId = `INJURY_${targetId}_${normalizedInjuryName}`;

              if (this.graph.hasNode(injuryNodeId)) {
                  // UPDATE PATH: Escalation
                  const nodeAttrs = this.graph.getNodeAttributes(injuryNodeId);
                  const currentSeverity = nodeAttrs.attributes?.severity || 0;
                  const newSeverity = Math.min(1.0, currentSeverity + (valid.severity || 0.1));
                  
                  this.graph.mergeNodeAttributes(injuryNodeId, {
                      attributes: {
                          ...nodeAttrs.attributes,
                          severity: newSeverity,
                          timestamp: this.globalState.turn_count,
                          // Update grammar phase if provided
                          grammar_phase: valid.grammar_phase || nodeAttrs.attributes?.grammar_phase,
                          last_updated: Date.now()
                      }
                  });
                  console.log(`[KGot] Updated Injury Node: ${injuryNodeId} -> Severity ${newSeverity}`);
              } else {
                  // CREATE PATH: New Trauma
                  this.addNode({
                      id: injuryNodeId,
                      type: 'INJURY',
                      label: valid.injury_name,
                      attributes: {
                          severity: valid.severity || 0.5,
                          grammar_phase: valid.grammar_phase || 'Shock',
                          timestamp: this.globalState.turn_count,
                          description: `Inflicted by ${sourceId}`
                      }
                  });

                  // 2. Link to Subject
                  this.addEdge(injuryNodeId, targetId, 'AFFLICTS', valid.severity || 0.5, { type: 'INJURY_LINK' });

                  // 3. Link to Inflictor
                  this.addEdge(injuryNodeId, sourceId, 'CAUSED_BY', 1.0, { type: 'INJURY_SOURCE' });
                  console.log(`[KGot] Created Injury Node: ${injuryNodeId}`);
              }
              break;
          }

          case 'add_subject_secret': {
            let valid;
            try { valid = MutationSchemas.add_subject_secret.parse(params); }
            catch(e) { console.warn(`[KGot] Mutation ${idx} (add_subject_secret) invalid params:`, e); return; }
            
            const subId = this.resolveTargetId(valid.subject_id);
            const discBy = this.resolveTargetId(valid.discovered_by);

            if (subId) {
                this.addSubjectSecret(subId, {
                    name: valid.secret_name,
                    description: valid.secret_description,
                    discoveredBy: valid.discovered_by,
                    turn: this.globalState.turn_count
                });
                
                // Also add an edge between the discoverer and the secret
                if (discBy && this.graph.hasNode(discBy)) {
                    const secretNodeId = `SECRET_${Date.now()}_${valid.secret_name.replace(/\s+/g, '_').toUpperCase()}`;
                    this.addNode({ // Add the secret as a node itself for traceability
                        id: secretNodeId,
                        type: 'SECRET',
                        label: valid.secret_name,
                        attributes: {
                            description: valid.secret_description,
                            discoveredBy: valid.discovered_by,
                            turnDiscovered: this.globalState.turn_count,
                            aboutSubject: valid.subject_id
                        }
                    });
                    this.addEdge(discBy, secretNodeId, 'DISCOVERED', 1.0, { type: 'KNOWLEDGE_ACQUISITION' });
                    this.addEdge(secretNodeId, subId, 'ABOUT', 1.0, { type: 'SECRET_RELATION' });
                }
            }
            break;
          }
          
          default:
            console.warn(`[KGot] Unknown mutation operation: ${operation}`);
        }
      } catch (e: any) {
        console.error(`[KGot] Mutation ${idx} (${operation}) Execution Failed:`, e.message || e);
      }
    });
    
    // Auto-prune periodically (every ~5 turns or based on mutation count) to keep graph performant
    if (Math.random() < 0.2) {
        this.pruneGraph();
    }
  }

  // --- Advanced Analysis (Graphology) ---

  public getSocialHierarchy(): [string, number][] {
    if (this.graph.order === 0) return [];
    try {
        const scores = pagerank(this.graph) as Record<string, number>; // Explicitly cast to Record<string, number>
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

  public applyLayout(iterations = 50): void {
    if (this.graph.order === 0) return;
    try {
        const positions = forceAtlas2(this.graph, { iterations, settings: { gravity: 1.0 } });
        this.graph.forEachNode((node, nodeAttrs) => { // Renamed 'attr' to 'nodeAttrs'
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
            if (this.graph.hasEdge(source, target)) continue;
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
    let bc: Record<string, number> = {}; // Explicitly type bc
    try { bc = betweennessCentrality(this.graph); } catch (e) {}
    const rawEmbeds = this.origNode2Vec(dim);
    // You can enrich rawEmbeds here with getNodeFeatures if needed, e.g.:
    // const enriched: Record<string, number[]> = {};
    // for (const node of this.graph.nodes()) {
    //    enriched[node] = [...rawEmbeds[node], ...this.getNodeFeatures(node, bc)];
    // }
    // return enriched;
    return rawEmbeds; // Returning raw Node2Vec embeddings for now
  }

  public updateLedger(subjectId: string, deltas: Partial<YandereLedger>): void {
    if (!this.graph.hasNode(subjectId)) return;
    const nodeAttrs = this.graph.getNodeAttributes(subjectId);
    const ledger: YandereLedger = nodeAttrs.attributes?.ledger || INITIAL_LEDGER; // Ensure ledger is initialized
    
    // Create a mutable copy of the ledger for updates
    const updatedLedger: YandereLedger = { ...ledger };

    Object.keys(deltas).forEach((key) => {
        const k = key as keyof YandereLedger;
        const val = deltas[k];
        if (typeof val === 'number' && typeof updatedLedger[k] === 'number') {
           (updatedLedger[k] as number) = Math.max(0, Math.min(100, (updatedLedger[k] as number) + val));
        } else if (val !== undefined) {
           (updatedLedger[k] as any) = val; // Direct assignment for non-number types or new values
        }
    });
    this.graph.mergeNodeAttributes(subjectId, { attributes: { ...nodeAttrs.attributes, ledger: updatedLedger } });
  }

  public addMemory(nodeId: string, memory: Memory): void {
    if (!this.graph.hasNode(nodeId)) return;
    const nodeAttrs = this.graph.getNodeAttributes(nodeId);
    const memories = nodeAttrs.attributes?.memories || [];
    memories.push(memory);
    if (memories.length > 20) memories.shift(); // Keep a limited history
    this.graph.mergeNodeAttributes(nodeId, { attributes: { ...nodeAttrs.attributes, memories } });
  }

  public updateGrudge(holderId: string, targetId: string, delta: number): void {
    if (!this.graph.hasNode(holderId)) return;
    const nodeAttrs = this.graph.getNodeAttributes(holderId);
    const grudges: Record<string, number> = nodeAttrs.attributes?.grudges || {};
    const current = grudges[targetId] || 0;
    const newVal = Math.max(0, Math.min(100, current + delta));
    grudges[targetId] = newVal;
    this.graph.mergeNodeAttributes(holderId, { attributes: { ...nodeAttrs.attributes, grudges } });
    if (newVal > 50) {
        this.addEdge(holderId, targetId, 'GRUDGE', newVal / 100, { intensity: newVal, trope: 'Burning Hatred' });
    }
  }

  // NEW: Method to add a secret to a subject's attributes
  public addSubjectSecret(
    subjectId: string,
    secret: { name: string; description: string; discoveredBy?: string; turn?: number }
  ): void {
    if (!this.graph.hasNode(subjectId)) {
        console.warn(`[KGot] Subject ${subjectId} not found to add secret.`);
        return;
    }
    const nodeAttrs = this.graph.getNodeAttributes(subjectId);
    const currentSecrets = nodeAttrs.attributes?.secrets || [];
    currentSecrets.push(secret);
    this.graph.mergeNodeAttributes(subjectId, { attributes: { ...nodeAttrs.attributes, secrets: currentSecrets } });
  }

  // --- Unified Director Logic Bridge ---
  public applyPrefectSimulations(simulations: UnifiedDirectorOutput['prefect_simulations']): void {
    simulations.forEach(sim => {
        if (!this.graph.hasNode(sim.prefect_id)) {
            const resolved = this.resolveTargetId(sim.prefect_name);
            if (resolved) sim.prefect_id = resolved;
            else return; 
        }
        const nodeAttrs = this.graph.getNodeAttributes(sim.prefect_id);
        const agentState = nodeAttrs.attributes?.agent_state || {};
        const updatedAgentState = {
            ...agentState,
            current_mood: this.deriveMoodFromState(sim.emotional_state),
            emotional_vector: sim.emotional_state,
            last_hidden_motivation: sim.hidden_motivation,
            last_public_action: sim.public_action
        };
        const currentSecrets = nodeAttrs.attributes?.secrets || [];
        const newSecrets = [...new Set([...currentSecrets, ...(sim.secrets_uncovered || [])])];
        this.graph.mergeNodeAttributes(sim.prefect_id, {
            attributes: {
                ...nodeAttrs.attributes,
                agent_state: updatedAgentState,
                secrets: newSecrets
            }
        });
        if (sim.sabotage_attempt) {
             const targetId = this.resolveTargetId(sim.sabotage_attempt.target);
             if (targetId && this.graph.hasNode(targetId)) {
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
            if (targetId && this.graph.hasNode(targetId)) {
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

  /**
   * Resolves fuzzy names/aliases to canonical KGot IDs using Strict Entity Map
   * UPDATED: Removed fuzzy string matching to prevent ID collisions.
   */
  private resolveTargetId(nameOrId: string | undefined): string | null {
    if (!nameOrId) return null;
    
    // 1. Exact Match (Already a valid ID in the graph)
    if (this.graph.hasNode(nameOrId)) return nameOrId;
    
    const lower = nameOrId.toLowerCase().trim();
    
    // 2. Direct Map Lookup (Strict Alias Resolution)
    if (this.ENTITY_MAP[lower]) {
        return this.ENTITY_MAP[lower];
    }

    // 3. No Fuzzy Fallback
    // We strictly fail if not found in the map or graph to preserve data integrity.
    return null;
  }
}
