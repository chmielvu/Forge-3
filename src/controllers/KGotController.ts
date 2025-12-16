import { KnowledgeGraph, KGotNode, KGotEdge } from '@/lib/types/kgot';
import { UnifiedDirectorOutput } from '../lib/schemas/unifiedDirectorSchema';
import { YandereLedger, PrefectDNA } from '../types';
import { KGotCore } from '../lib/kgot/core';
import { applyMutations } from '../lib/kgot/mutations';
import { fuzzyResolve } from '../lib/kgot/search';
import { runLayoutAsync } from '../lib/kgot/layout';
import { updateCentrality, detectCommunities, calculateDominancePath, pruneGraph } from '../lib/kgot/metrics';
import { INITIAL_LEDGER, INITIAL_NODES, INITIAL_LINKS } from '@/constants';
import { GraphRAGIndexer } from '../lib/kgot/graphrag';
import { KGOT_CONFIG } from '@/config/behaviorTuning';
import { applyDecayMutation } from '../lib/kgot/decay-mut';

/**
 * KGotController Facade
 * 
 * Orchestrates the modular KGoT subsystems:
 * - Core (Graphology wrapper)
 * - Mutations (Logic & Validation)
 * - Search (Fuzzy Resolution)
 * - Metrics (Analysis)
 * - Layout (Worker)
 * - GraphRAG (Indexing & Retrieval)
 */
export class KGotController {
  private core: KGotCore;
  private graphRAG: GraphRAGIndexer;

  constructor(initialGraph: KnowledgeGraph) {
    this.core = new KGotCore(initialGraph);
    
    // Auto-bootstrap if empty (Initial Session Start)
    if (Object.keys(this.core.getGraph().nodes).length === 0) {
      this.initializeCanonicalNodes();
    }

    // Initialize GraphRAG
    this.graphRAG = new GraphRAGIndexer(this.core);
    this.graphRAG.setDecayHook((event) => {
      // Lore hook: e.g., low_grudge → inject MASQUERADE motif logic in future
      console.log(`[Controller] Decay event: ${event}`);
    });
  }

  // --- Core Delegation ---

  public getGraph(): KnowledgeGraph {
    return this.core.getGraph();
  }

  // --- Narrative Logic ---

  public getNarrativeSpotlight(
    subjectId: string, 
    locationId: string, 
    activePrefectIds: string[]
  ): object {
    const graph = this.core.internalGraph;
    const spotlightNodes = new Set<string>([subjectId, locationId, ...activePrefectIds]);
    const spotlightEdges: any[] = [];

    const safeAddNode = (id: string) => {
        if (graph.hasNode(id)) spotlightNodes.add(id);
    };

    // 1. Subject's Immediate Context
    if (graph.hasNode(subjectId)) {
        graph.forEachNeighbor(subjectId, (neighbor) => {
            const edges = graph.edges(subjectId, neighbor);
            edges.forEach(edgeId => {
                const attrs = graph.getEdgeAttributes(edgeId);
                // Filter relevant edges
                if ((attrs.weight as number) > 0.3 || attrs.type === 'INJURY_LINK' || attrs.type === 'GRUDGE') {
                    safeAddNode(neighbor);
                    spotlightEdges.push({ source: subjectId, target: neighbor, ...attrs });
                }
            });
        });
    }

    // 2. Active NPC Relations
    activePrefectIds.forEach(idA => {
        activePrefectIds.forEach(idB => {
            if (idA !== idB && graph.hasNode(idA) && graph.hasNode(idB)) {
                 const edges = graph.edges(idA, idB);
                 edges.forEach(edgeId => {
                     spotlightEdges.push({ 
                         source: idA, 
                         target: idB, 
                         ...graph.getEdgeAttributes(edgeId) 
                     });
                 });
            }
        });
    });

    const nodes: Record<string, any> = {};
    spotlightNodes.forEach(id => {
        if (graph.hasNode(id)) {
            nodes[id] = graph.getNodeAttributes(id);
        }
    });

    return {
        global_state: this.core.getGraph().global_state,
        spotlight_nodes: nodes,
        spotlight_edges: spotlightEdges
    };
  }

  public initializeCanonicalNodes(): void {
    const muts: any[] = [];

    // 1. Add Nodes from Constants
    INITIAL_NODES.forEach(node => {
        muts.push({
            operation: 'add_node',
            node: {
                id: node.id,
                type: node.group.toUpperCase(), // Map 'faculty' -> 'FACULTY'
                label: node.label,
                attributes: {
                    ...node,
                    // Ensure Ledger is attached to Subject
                    ledger: node.id === 'Subject_84' ? INITIAL_LEDGER : undefined
                }
            }
        });
    });

    // 2. Add Links from Constants
    INITIAL_LINKS.forEach(link => {
        muts.push({
            operation: 'add_edge',
            edge: {
                source: link.source,
                target: link.target,
                type: link.relation.toUpperCase(), // Map 'trauma_bonds' -> 'TRAUMA_BONDS'
                label: link.relation,
                weight: (link.weight || 5) / 10, // Normalize 0-10 to 0.0-1.0
                meta: {
                    tension: link.weight
                }
            }
        });
    });
    
    // Apply initial mutations with turn 0
    applyMutations(this.core, muts, 0);
    
    // Initial Layout Calculation
    runLayoutAsync(this.core, 100);
  }

  // --- Mutation Handling ---

  public applyMutations(mutations: any[]): void {
    const currentTurn = this.core.getGraph().global_state.turn_count || 0;

    // Periodic decay: Every X turns (modular call)
    if (currentTurn > 0 && currentTurn % KGOT_CONFIG.DECAY.INTERVAL === 0) {
      const decayConfig = { 
          rate: KGOT_CONFIG.DECAY.RATE, 
          minWeight: KGOT_CONFIG.DECAY.MIN_WEIGHT, 
          types: KGOT_CONFIG.DECAY.TYPES 
      }; 
      // Apply decay to Subject interactions primarily
      applyDecayMutation(this.core.internalGraph, 'Subject_84', decayConfig, currentTurn); 
    }

    // Pre-process params to resolve fuzzy IDs before passing to strict mutation handler
    const resolvedMutations = mutations.map(m => {
        const resolved = { ...m };
        
        // Helper to resolve specific fields if they exist
        const resolveField = (obj: any, field: string) => {
            if (obj && obj[field]) {
                const id = this.resolveEntityId(obj[field]);
                if (id) obj[field] = id;
            }
        };

        // Resolve common ID fields at top level or nested objects
        resolveField(resolved, 'id');
        resolveField(resolved, 'source');
        resolveField(resolved, 'target');
        resolveField(resolved, 'subject_id');
        resolveField(resolved, 'character_id');
        resolveField(resolved, 'target_id');
        resolveField(resolved, 'victim_id');
        
        // Nested logic for node/edge objects if they exist
        if (resolved.node) resolveField(resolved.node, 'id');
        if (resolved.edge) {
            resolveField(resolved.edge, 'source');
            resolveField(resolved.edge, 'target');
        }

        // Array resolution for alliances/witnesses
        if (resolved.members && Array.isArray(resolved.members)) {
            resolved.members = resolved.members.map((id: string) => this.resolveEntityId(id) || id);
        }
        if (resolved.witness_ids && Array.isArray(resolved.witness_ids)) {
            resolved.witness_ids = resolved.witness_ids.map((id: string) => this.resolveEntityId(id) || id);
        }

        return resolved;
    });

    applyMutations(this.core, resolvedMutations, currentTurn);
    
    // GraphRAG incremental: Pass delta for threshold
    // Async, non-blocking build
    this.graphRAG.buildIndex(false, mutations.length).catch(e => console.warn("GraphRAG build failed:", e));

    // Auto-prune and Layout periodically
    if (Math.random() < 0.1) {
        this.pruneGraph();
        this.runLayout();
    }
  }

  public updateLedger(subjectId: string, deltas: Partial<YandereLedger>): void {
      const turn = this.core.getGraph().global_state.turn_count;
      const updateMut = {
          operation: 'update_node',
          id: subjectId,
          updates: {
              attributes: { ledger: { ...deltas } } 
          }
      };
      applyMutations(this.core, [updateMut], turn);
  }

  /**
   * Updates an agent's attributes based on PrefectDNA.
   */
  public updateAgentAttributes(prefect: PrefectDNA): void {
      const turn = this.core.getGraph().global_state.turn_count;
      const updateMut = {
          operation: 'update_node',
          id: prefect.id,
          updates: {
              attributes: { 
                  prefectDNA: { ...prefect, relationships: { ...prefect.relationships } }, 
                  psychometrics: prefect.psychometrics, 
                  appearanceDescription: prefect.appearanceDescription,
                  narrativeFunctionDescription: prefect.narrativeFunctionDescription,
                  promptKeywords: prefect.promptKeywords,
                  visualDNA: prefect.visualDNA,
                  somaticSignature: prefect.somaticSignature,
              }
          }
      };
      applyMutations(this.core, [updateMut], turn);
  }

  // --- Metrics & Analysis (Core Methods) ---

  public updateMetrics(): void {
      updateCentrality(this.core);
  }

  public detectCommunities(): Record<string, number> {
      return detectCommunities(this.core);
  }

  public getDominancePath(source: string, target: string): string[] | null {
      return calculateDominancePath(this.core, source, target);
  }

  public pruneGraph(threshold: number = 0.1): void {
      pruneGraph(this.core, threshold);
  }

  public async runLayout(iterations: number = 50): Promise<void> {
      await runLayoutAsync(this.core, iterations);
  }

  // --- Analysis & AI ---

  public getNode2VecEmbeddings(dim: number = 16): Record<string, number[]> {
      return this.core.getNode2VecEmbeddings(dim);
  }

  public applyPrefectSimulations(simulations: UnifiedDirectorOutput['prefect_simulations']): void {
      if (!simulations) return; 

      const muts: any[] = [];
      const turn = this.core.getGraph().global_state.turn_count;

      simulations.forEach(sim => {
          const pid = this.resolveEntityId(sim.prefect_id) || sim.prefect_id;
          
          muts.push({
              operation: 'update_node',
              id: pid,
              updates: {
                  attributes: {
                      agent_state: {
                          emotional_vector: sim.emotional_state,
                          last_action: sim.public_action
                      },
                      currentEmotionalState: sim.emotional_state, 
                      lastPublicAction: sim.public_actionSummary || sim.public_action, 
                  }
              }
          });

          muts.push({
              operation: 'add_memory',
              memory: {
                  id: `mem_${Date.now()}_${pid}`,
                  description: `Action: ${sim.public_action} | Motivation: ${sim.hidden_motivation}`,
                  emotional_imprint: `Confidence: ${sim.emotional_state.confidence}`,
                  involved_entities: [pid, sim.sabotage_attempt?.target || sim.alliance_signal?.target || ''], 
                  timestamp: turn
              }
          });

          if (sim.sabotage_attempt) {
              muts.push({
                  operation: 'update_grudge',
                  source: pid,
                  target: this.resolveEntityId(sim.sabotage_attempt.target) || sim.sabotage_attempt.target,
                  delta: 25 
              });
          }
           if (sim.alliance_signal) {
              muts.push({
                  operation: 'update_relationship',
                  source: pid,
                  target: this.resolveEntityId(sim.alliance_signal.target) || sim.alliance_signal.target,
                  category: 'TRUST', 
                  delta: 0.2 
              });
          }
          if (sim.secrets_uncovered && sim.secrets_uncovered.length > 0) {
              sim.secrets_uncovered.forEach(secret => {
                  muts.push({
                      operation: 'add_secret',
                      secret_id: `secret_${Date.now()}_${pid}_${Math.random().toString(36).substring(2, 6)}`,
                      description: secret,
                      discovered_by: sim.prefect_name,
                      turn_discovered: turn
                  });
              });
          }
      });
      this.applyMutations(muts);
  }

  // --- Search & Utils ---

  public resolveEntityId(nameOrId: string | undefined): string | null {
      return fuzzyResolve(this.core, nameOrId || '');
  }

  // --- GraphRAG Access ---
  
  public async getRAGAugmentedPrompt(query: string): Promise<string> {
      try {
          const retrieval = await this.graphRAG.retrieve(query);
          return this.graphRAG.augmentPrompt(retrieval);
      } catch (e) {
          console.warn("[KGotController] RAG augmentation failed:", e);
          return "";
      }
  }
}