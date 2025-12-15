
import { KGotCore } from './core';

export function applyMutations(core: KGotCore, mutations: any[], currentTurn: number) {
  const graph = core.internalGraph;

  mutations.forEach((mut) => {
    try {
      switch (mut.operation) {
        case 'add_node': {
          const nodeId = mut.node?.id || mut.id;
          if (nodeId && !graph.hasNode(nodeId)) {
            graph.addNode(nodeId, {
              ...mut.node,
              id: nodeId,
              // Ensure basic attributes exist
              attributes: mut.node?.attributes || mut.attributes || {}
            });
          }
          break;
        }

        case 'update_node': {
          const nodeId = mut.id;
          if (nodeId && graph.hasNode(nodeId)) {
            graph.mergeNodeAttributes(nodeId, mut.updates || {});
          }
          break;
        }

        case 'remove_node': {
          const nodeId = mut.id;
          if (nodeId && graph.hasNode(nodeId)) {
            graph.dropNode(nodeId);
          }
          break;
        }

        case 'add_edge': {
          const { source, target } = mut.edge || mut;
          if (graph.hasNode(source) && graph.hasNode(target)) {
            const key = mut.edge?.key || `${source}_${target}_${mut.edge?.type || 'RELATIONSHIP'}`;
            if (!graph.hasEdge(key)) {
                graph.addEdgeWithKey(key, source, target, mut.edge || { type: 'RELATIONSHIP', weight: 0.5 });
            }
          }
          break;
        }

        case 'update_edge': {
           // Not fully supported in graphology merge without key, assuming simple update by source/target if key not present
           // For now, skip if complexity is high, or implement if key is provided
           break;
        }

        case 'add_memory': {
            if (!mut.memory) break;
            const memId = mut.memory.id;
            // Memories are now stored as attributes on relevant nodes (e.g. character node)
            const targetNodeId = mut.memory.involved_entities?.[0] || 'Subject_84'; // Default to subject
            if (graph.hasNode(targetNodeId)) {
                const attrs = graph.getNodeAttributes(targetNodeId);
                const memories = attrs.attributes?.memories || [];
                graph.mergeNodeAttributes(targetNodeId, { attributes: { ...attrs.attributes, memories: [...memories, mut.memory] } });
            } else {
                 // Fallback: create a standalone memory node if no target entity
                 if (!graph.hasNode(memId)) {
                    graph.addNode(memId, {
                        id: memId,
                        type: 'MEMORY',
                        label: mut.memory.description.slice(0, 30) + '...',
                        attributes: { ...mut.memory, timestamp: mut.memory.timestamp || currentTurn },
                    });
                 }
            }
            break;
        }

        case 'add_trauma_memory': {
            if (!mut.memory) break;
            const memId = mut.memory.id || `trauma_${Date.now()}`;
            const targetNodeId = mut.memory.involved?.[0] || 'Subject_84'; // Default to subject
            if (graph.hasNode(targetNodeId)) {
                const attrs = graph.getNodeAttributes(targetNodeId);
                const memories = attrs.attributes?.memories || [];
                graph.mergeNodeAttributes(targetNodeId, {
                    attributes: { ...attrs.attributes, memories: [...memories, mut.memory] }
                });
            } else {
                 if (!graph.hasNode(memId)) { 
                    graph.addNode(memId, {
                        id: memId,
                        type: 'MEMORY',
                        label: 'Trauma: ' + (mut.memory.description || '').substring(0, 15),
                        attributes: {
                            description: mut.memory.description,
                            trauma_delta: mut.memory.trauma_delta,
                            involved: mut.memory.involved,
                            timestamp: currentTurn
                        },
                    });
                 }
            }
            break;
        }

        case 'update_grudge': {
            const { source, target, delta } = mut;
            if (graph.hasNode(source)) {
                const attrs = graph.getNodeAttributes(source);
                const grudges = attrs.attributes?.grudges || {};
                const currentVal = grudges[target] || 0;
                const newVal = Math.max(0, Math.min(100, currentVal + (delta || 0)));
                
                graph.mergeNodeAttributes(source, {
                    attributes: {
                        ...attrs.attributes,
                        grudges: { ...grudges, [target]: newVal }
                    }
                });
            }
            break;
        }

        case 'update_relationship': {
            const { source, target, delta } = mut;
            // Assuming this updates a PrefectDNA-like relationship map on the node
            if (graph.hasNode(source)) {
                 const attrs = graph.getNodeAttributes(source);
                 // Check if it has prefectDNA structure
                 if (attrs.attributes?.prefectDNA) {
                     const rels = attrs.attributes.prefectDNA.relationships || {};
                     const currentRel = rels[target] || 0;
                     const newRel = Math.max(-1, Math.min(1, currentRel + (delta || 0)));
                     
                     graph.mergeNodeAttributes(source, {
                         attributes: {
                             ...attrs.attributes,
                             prefectDNA: {
                                 ...attrs.attributes.prefectDNA,
                                 relationships: { ...rels, [target]: newRel }
                             }
                         }
                     });
                 }
            }
            break;
        }

        case 'add_secret': {
            const subjectId = mut.subject_id || 'Subject_84';
            if (graph.hasNode(subjectId)) {
                const attrs = graph.getNodeAttributes(subjectId);
                const secrets = attrs.attributes?.secrets || [];
                const newSecret = {
                    name: mut.secret_id || `Secret_${Date.now()}`,
                    description: mut.description,
                    discoveredBy: mut.discovered_by,
                    turn: mut.turn_discovered || currentTurn
                };
                graph.mergeNodeAttributes(subjectId, {
                    attributes: { ...attrs.attributes, secrets: [...secrets, newSecret] }
                });
            }
            break;
        }
        
        case 'add_injury': {
             // Handled mainly in store side effects, but can log to node here
             const targetId = mut.params?.target_id || mut.target_id || 'Subject_84';
             if (graph.hasNode(targetId)) {
                 const attrs = graph.getNodeAttributes(targetId);
                 const injury = mut.injury || mut.params?.injury_name;
                 if (injury) {
                     const currentInjuries = attrs.attributes?.injuries || [];
                     graph.mergeNodeAttributes(targetId, {
                         attributes: {
                             ...attrs.attributes,
                             injuries: [...new Set([...currentInjuries, injury])]
                         }
                     });
                 }
             }
             break;
        }

        default:
          // console.warn(`Unknown mutation operation: ${mut.operation}`);
          break;
      }
    } catch (e) {
      console.warn(`Failed to apply mutation ${mut.operation}:`, e);
    }
  });
}
