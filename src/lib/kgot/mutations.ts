
import { z } from 'zod';
import { KGotCore } from './core';
import { INITIAL_LEDGER } from '../../constants';
import { YandereLedger } from '../../types';

// === BASE SCHEMAS ===

const BaseNode = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

const BaseEdge = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string(),
  label: z.string(),
  weight: z.number().min(0).max(1).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// === MUTATION DEFINITIONS ===

const AddNode = z.object({
  operation: z.literal('add_node'),
  node: BaseNode,
  provenance: z.object({
    creator_agent_id: z.string(),
    turn_created: z.number(),
  }).optional(),
});

const UpdateNode = z.object({
  operation: z.literal('update_node'),
  id: z.string(),
  updates: z.object({
    label: z.string().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  }),
});

const RemoveNode = z.object({
  operation: z.literal('remove_node'),
  id: z.string(),
});

const AddEdge = z.object({
  operation: z.literal('add_edge'),
  edge: BaseEdge,
  provenance: z.object({
    creator_agent_id: z.string(),
    turn_created: z.number(),
  }).optional(),
});

const UpdateEdge = z.object({
  operation: z.literal('update_edge'),
  source: z.string(),
  target: z.string(),
  updates: z.object({
    label: z.string().optional(),
    weight: z.number().min(0).max(1).optional(),
    type: z.string().optional(),
  }),
});

const RemoveEdge = z.object({
  operation: z.literal('remove_edge'),
  source: z.string(),
  target: z.string(),
});

// === GAME SPECIFIC MUTATIONS ===

const AddMemory = z.object({
  operation: z.literal('add_memory'),
  memory: z.object({
    id: z.string(),
    description: z.string(),
    timestamp: z.number().optional(),
    emotional_imprint: z.string().optional(),
    involved_entities: z.array(z.string()).optional(),
  }),
});

const UpdateGrudge = z.object({
  operation: z.literal('update_grudge'),
  source: z.string(),
  target: z.string(),
  delta: z.number(),
});

const AddInjury = z.object({
  operation: z.literal('add_injury'),
  subject_id: z.string(),
  injury: z.string(),
  severity: z.number().min(0).max(100).optional(),
});

const AddTraumaBond = z.object({
  operation: z.literal('add_trauma_bond'),
  source: z.string(), // e.g. Player
  target: z.string(), // e.g. PREFECT_KAELEN
  strength: z.number().min(0).max(1),
  bond_type: z.string().optional(),
});

const UpdateLedgerStat = z.object({
  operation: z.literal('update_ledger_stat'),
  stat: z.string(), // e.g. "traumaLevel"
  delta: z.number(),
  clamp: z.boolean().optional().default(true),
});

const AddSecret = z.object({
  operation: z.literal('add_secret'),
  secret_id: z.string(),
  description: z.string(),
  discovered_by: z.string().optional(),
  turn_discovered: z.number().optional(),
});

const UpdatePhase = z.object({
  operation: z.literal('update_phase'),
  new_phase: z.enum(['alpha', 'beta', 'gamma']),
});

const AddSecretAlliance = z.object({
  operation: z.literal('add_secret_alliance'),
  members: z.array(z.string()),
  strength: z.number().min(0).max(1).optional(),
});

const AddTraumaMemory = z.object({
  operation: z.literal('add_trauma_memory'),
  memory: z.object({
    id: z.string(),
    description: z.string(),
    trauma_delta: z.number(),
    involved: z.array(z.string()),
  }),
});

const UpdateDominance = z.object({
  operation: z.literal('update_dominance'),
  character_id: z.string(),
  delta: z.number(),
});

const AddPsychosisNode = z.object({
  operation: z.literal('add_psychosis_node'),
  node_id: z.string(),
  hallucination: z.string(),
  intensity: z.number().min(0).max(100),
});

// Union of all mutation types
const Mutation = z.discriminatedUnion('operation', [
  AddNode, UpdateNode, RemoveNode, AddEdge, UpdateEdge, RemoveEdge,
  AddMemory, UpdateGrudge, AddInjury,
  AddTraumaBond, UpdateLedgerStat, AddSecret, UpdatePhase,
  AddSecretAlliance, AddTraumaMemory, UpdateDominance, AddPsychosisNode
]);

export type Mutation = z.infer<typeof Mutation>;

// --- HELPER FUNCTIONS ---

function updateLedgerInternal(graph: any, subjectId: string, stat: string, delta: number, clamp: boolean) {
    if (!graph.hasNode(subjectId)) return;
    const nodeAttrs = graph.getNodeAttributes(subjectId);
    const ledger = nodeAttrs.attributes?.ledger || { ...INITIAL_LEDGER };
    
    // Type-safe dynamic access if possible, or fallback to any
    let currentVal = (ledger as any)[stat] || 0;
    
    if (typeof currentVal === 'number') {
        let newVal = currentVal + delta;
        if (clamp) {
            newVal = Math.max(0, Math.min(100, newVal));
        }
        (ledger as any)[stat] = newVal;
        
        graph.mergeNodeAttributes(subjectId, { 
            attributes: { ...nodeAttrs.attributes, ledger } 
        });
    }
}

// --- APPLY LOGIC ---

export function applyMutations(core: KGotCore, mutations: any[], currentTurn: number) {
  const graph = core.internalGraph;

  mutations.forEach((raw, idx) => {
    // 1. Runtime Validation & Transformation
    // Handle legacy formats if necessary (optional)
    const result = Mutation.safeParse(raw);
    
    if (!result.success) {
      // Try to adapt legacy generic formats to new schema
      // This is a safety layer for existing Director output that might use generic 'update_node' for everything
      if (raw.operation === 'update_node' && raw.params) {
          raw.id = raw.params.id;
          raw.updates = { attributes: raw.params.attributes };
          const retry = Mutation.safeParse(raw);
          if (retry.success) {
              applySingleMutation(graph, retry.data, currentTurn);
              return;
          }
      }
      console.warn(`[Mutations] Skipped invalid mutation at index ${idx}:`, result.error);
      return;
    }
    
    applySingleMutation(graph, result.data, currentTurn);
  });
}

function applySingleMutation(graph: any, mut: Mutation, currentTurn: number) {
    try {
        switch (mut.operation) {
        case 'add_node': {
            if (!graph.hasNode(mut.node.id)) {
                graph.addNode(mut.node.id, {
                    ...mut.node,
                    attributes: { ...mut.node.attributes, provenance: mut.provenance },
                });
            }
            break;
        }
        case 'update_node': {
            if (graph.hasNode(mut.id)) {
                const prev = graph.getNodeAttributes(mut.id);
                // Deep merge attributes
                const newAttrs = { ...prev.attributes, ...mut.updates.attributes };
                graph.mergeNodeAttributes(mut.id, {
                    label: mut.updates.label || prev.label,
                    attributes: newAttrs
                });
            }
            break;
        }
        case 'remove_node':
            if (graph.hasNode(mut.id)) graph.dropNode(mut.id);
            break;
        case 'add_edge': {
            const key = `${mut.edge.source}->${mut.edge.target}_${mut.edge.type}`;
            if (graph.hasNode(mut.edge.source) && graph.hasNode(mut.edge.target)) {
                if (!graph.hasEdge(key)) {
                    graph.addDirectedEdgeWithKey(key, mut.edge.source, mut.edge.target, {
                        ...mut.edge,
                        provenance: mut.provenance,
                    });
                }
            }
            break;
        }
        case 'update_edge': {
            const key = `${mut.source}->${mut.target}`;
            // This is tricky as edge keys might be specific. We check for existence of any edge or key.
            // Simplified: Iterate edges between source and target
            if (graph.hasNode(mut.source) && graph.hasNode(mut.target)) {
                graph.forEachDirectedEdge(mut.source, mut.target, (edge: string, attrs: any) => {
                    graph.mergeEdgeAttributes(edge, mut.updates);
                });
            }
            break;
        }
        case 'remove_edge':
            if (graph.hasNode(mut.source) && graph.hasNode(mut.target)) {
                graph.forEachDirectedEdge(mut.source, mut.target, (edge: string) => {
                    graph.dropEdge(edge);
                });
            }
            break;
        case 'add_memory': {
            const nodeId = mut.memory.id;
            if (graph.hasNode(nodeId)) {
                graph.mergeNodeAttributes(nodeId, { attributes: mut.memory });
            } else {
                graph.addNode(nodeId, {
                    id: nodeId,
                    type: 'MEMORY',
                    label: mut.memory.description.slice(0, 30) + '...',
                    attributes: { ...mut.memory, timestamp: mut.memory.timestamp || currentTurn },
                });
            }
            break;
        }
        case 'update_grudge': {
            if (graph.hasNode(mut.source) && graph.hasNode(mut.target)) {
                // Find existing grudge or create
                let found = false;
                graph.forEachDirectedEdge(mut.source, mut.target, (edge: string, attrs: any) => {
                    if (attrs.type === 'GRUDGE') {
                        const newWeight = Math.max(0, Math.min(1, (attrs.weight || 0) + (mut.delta / 100)));
                        graph.setEdgeAttribute(edge, 'weight', newWeight);
                        found = true;
                    }
                });
                
                if (!found && mut.delta > 0) {
                    const key = `${mut.source}->${mut.target}_GRUDGE`;
                    graph.addDirectedEdgeWithKey(key, mut.source, mut.target, {
                        type: 'GRUDGE',
                        label: 'Grudge',
                        weight: Math.min(1, mut.delta / 100)
                    });
                }
            }
            break;
        }
        case 'add_injury': {
            const subjectId = mut.subject_id === 'Player' ? 'Subject_84' : mut.subject_id;
            if (graph.hasNode(subjectId)) {
                const attrs = graph.getNodeAttributes(subjectId);
                const injuries = attrs.attributes?.injuries || [];
                const updatedInjuries = [...new Set([...injuries, mut.injury])];
                
                graph.mergeNodeAttributes(subjectId, {
                    attributes: {
                        ...attrs.attributes,
                        injuries: updatedInjuries,
                        last_injury_severity: mut.severity || 50,
                        last_injury_turn: currentTurn
                    }
                });
            }
            break;
        }
        case 'add_trauma_bond': {
            if (graph.hasNode(mut.source) && graph.hasNode(mut.target)) {
                const key = `${mut.source}->${mut.target}_TRAUMA_BOND`;
                if (!graph.hasEdge(key)) {
                    graph.addDirectedEdgeWithKey(key, mut.source, mut.target, {
                        type: 'TRAUMA_BOND',
                        label: 'Trauma Bond',
                        weight: mut.strength,
                        meta: { bond_type: mut.bond_type }
                    });
                } else {
                    graph.setEdgeAttribute(key, 'weight', mut.strength);
                }
            }
            break;
        }
        case 'update_ledger_stat': {
            const subjectId = 'Subject_84'; // Default to player
            updateLedgerInternal(graph, subjectId, mut.stat, mut.delta, mut.clamp);
            break;
        }
        case 'add_secret': {
            if (!graph.hasNode(mut.secret_id)) {
                graph.addNode(mut.secret_id, {
                    type: 'SECRET',
                    label: mut.description.substring(0, 20) + '...',
                    attributes: { 
                        description: mut.description,
                        discovered_by: mut.discovered_by, 
                        turn: mut.turn_discovered ?? currentTurn 
                    },
                });
            }
            break;
        }
        case 'update_phase': {
            const subjectId = 'Subject_84';
            if (graph.hasNode(subjectId)) {
                const attrs = graph.getNodeAttributes(subjectId);
                const ledger = attrs.attributes?.ledger || { ...INITIAL_LEDGER };
                ledger.phase = mut.new_phase;
                graph.mergeNodeAttributes(subjectId, {
                    attributes: { ...attrs.attributes, ledger }
                });
                
                // Also update global state
                const globalState = graph.getAttribute('global_state');
                graph.setAttribute('global_state', { ...globalState, narrative_phase: mut.new_phase.toUpperCase() });
            }
            break;
        }
        case 'add_secret_alliance': {
            mut.members.forEach((m1) => {
                mut.members.forEach((m2) => {
                    if (m1 !== m2 && graph.hasNode(m1) && graph.hasNode(m2)) {
                        const key = `${m1}->${m2}_ALLIANCE`;
                        if (!graph.hasEdge(key)) {
                            graph.addDirectedEdgeWithKey(key, m1, m2, {
                                type: 'SECRET_ALLIANCE',
                                label: 'Secret Alliance',
                                weight: mut.strength ?? 0.7,
                            });
                        }
                    }
                });
            });
            break;
        }
        case 'add_trauma_memory': {
            const memId = mut.memory.id;
            if (!graph.hasNode(memId)) {
                graph.addNode(memId, {
                    type: 'MEMORY',
                    label: 'Trauma: ' + mut.memory.description.substring(0, 15),
                    attributes: {
                        description: mut.memory.description,
                        trauma_delta: mut.memory.trauma_delta,
                        involved: mut.memory.involved,
                        timestamp: currentTurn
                    },
                });
            }
            break;
        }
        case 'update_dominance': {
            if (graph.hasNode(mut.character_id)) {
                const attrs = graph.getNodeAttributes(mut.character_id);
                const agentState = attrs.attributes?.agent_state || {};
                const prev = agentState.dominance_level || 0.5;
                agentState.dominance_level = Math.max(0, Math.min(1, prev + mut.delta));
                
                graph.mergeNodeAttributes(mut.character_id, {
                    attributes: { ...attrs.attributes, agent_state: agentState }
                });
            }
            break;
        }
        case 'add_psychosis_node': {
            if (!graph.hasNode(mut.node_id)) {
                graph.addNode(mut.node_id, {
                    type: 'PSYCHOSIS',
                    label: mut.hallucination,
                    attributes: { intensity: mut.intensity, turn_created: currentTurn },
                });
                // Link to Subject
                graph.addDirectedEdge('Subject_84', mut.node_id, {
                    type: 'HALLUCINATES',
                    label: 'perceives',
                    weight: mut.intensity / 100
                });
            }
            break;
        }
        }
    } catch (e) {
        console.error(`[Mutations] Error applying ${mut.operation}:`, e);
    }
}
