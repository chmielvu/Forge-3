
import { KnowledgeGraph, KGotNode, KGotEdge } from '../lib/types/kgot';
import { UnifiedDirectorOutput } from '../lib/schemas/unifiedDirectorSchema';
import { YandereLedger, PrefectDNA } from '../types';
import { KGotCore } from '../lib/kgot/core';
import { applyMutations } from '../lib/kgot/mutations';
import { fuzzyResolve } from '../lib/kgot/search';
import { runLayoutAsync } from '../lib/kgot/layout';
import { updateCentrality, detectCommunities, calculateDominancePath, pruneGraph } from '../lib/kgot/metrics';
import { INITIAL_LEDGER } from '../constants';

/**
 * KGotController Facade
 * 
 * Orchestrates the modular KGoT subsystems:
 * - Core (Graphology wrapper)
 * - Mutations (Logic & Validation)
 * - Search (Fuzzy Resolution)
 * - Metrics (Analysis)
 * - Layout (Worker)
 */
export class KGotController {
  private core: KGotCore;

  constructor(initialGraph: KnowledgeGraph) {
    this.core = new KGotCore(initialGraph);
    
    // Auto-bootstrap if empty
    if (Object.keys(this.core.getGraph().nodes).length === 0) {
      this.initializeCanonicalNodes();
    }
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
    const nodes = [
        { id: "Subject_84", type: "SUBJECT", label: "Subject 84", attributes: { ledger: INITIAL_LEDGER, currentLocation: "The Calibration Chamber" } },
        { id: "FACULTY_SELENE", type: "FACULTY", label: "Provost Selene", attributes: {} },
        { id: "loc_calibration", type: "LOCATION", label: "The Calibration Chamber", attributes: {} }
    ];
    
    // Apply initial mutations with turn 0
    applyMutations(this.core, nodes.map(n => ({
        operation: 'add_node',
        node: n
    })), 0);
  }

  // --- Mutation Handling ---

  public applyMutations(mutations: any[]): void {
    const currentTurn = this.core.getGraph().global_state.turn_count || 0;

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
   * This is used to sync PrefectDNA changes from the gameStore to the KGotNode attributes.
   */
  public updateAgentAttributes(prefect: PrefectDNA): void {
      const turn = this.core.getGraph().global_state.turn_count;
      const updateMut = {
          operation: 'update_node',
          id: prefect.id,
          updates: {
              attributes: { 
                  // Directly store the full PrefectDNA attributes for rich context
                  // Avoid direct circular references if PrefectDNA has deep graph objects
                  prefectDNA: { ...prefect, relationships: { ...prefect.relationships } }, 
                  psychometrics: prefect.psychometrics, // Ensure psychometrics are carried over
                  appearanceDescription: prefect.appearanceDescription,
                  narrativeFunctionDescription: prefect.narrativeFunctionDescription,
                  promptKeywords: prefect.promptKeywords,
                  visualDNA: prefect.visualDNA,
                  somaticSignature: prefect.somaticSignature,
                  // Add other specific attributes as needed
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
      const nodes = this.core.internalGraph.nodes();
      const vectors: Record<string, number[]> = {};
      nodes.forEach(n => {
          vectors[n] = Array(dim).fill(0).map(() => Math.random());
      });
      return vectors;
  }

  public applyPrefectSimulations(simulations: UnifiedDirectorOutput['prefect_simulations']): void {
      if (!simulations) return; // Guard for optional simulations

      const muts: any[] = [];
      const turn = this.core.getGraph().global_state.turn_count;

      simulations.forEach(sim => {
          const pid = this.resolveEntityId(sim.prefect_id) || sim.prefect_id;
          
          // Update State
          muts.push({
              operation: 'update_node',
              id: pid,
              updates: {
                  attributes: {
                      agent_state: {
                          emotional_vector: sim.emotional_state,
                          last_action: sim.public_action
                      },
                      // Also update specific emotional states for potential psychometrics
                      currentEmotionalState: sim.emotional_state, // Direct update to PrefectDNA part
                      lastPublicAction: sim.public_actionSummary || sim.public_action, // Use summary if available
                  }
              }
          });

          // Memory
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

          // Interactions
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
                  category: 'TRUST', // Or 'LOVE', 'SYMPATHY' based on context
                  delta: 0.2 // Small positive delta for alliance
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

  /**
   * Public wrapper for fuzzy ID resolution to be used by store side-effects.
   */
  public resolveEntityId(nameOrId: string | undefined): string | null {
      return fuzzyResolve(this.core, nameOrId || '');
  }
}
