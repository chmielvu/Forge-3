
// decay-mut.ts: Handles temporal erosion of persistent states (grudges, bonds).
// Exponential decay: weight *= (1 - rate)^turns; min 0.05 for "eternal scars".
// Modular: Call standalone or via mutations.apply.

import Graph from 'graphology'; // Core graph type
import { KGOT_CONFIG } from '@/config/behaviorTuning';

interface DecayConfig {
  rate: number; // 0.05 = 5% loss/turn
  minWeight: number; // 0.05 floor
  types: string[]; // ['GRUDGE', 'TRAUMA_BOND']
  baseTurn?: number; // Decay from this turn
}

export function applyDecayMutation(
  graph: Graph, // Input graph (from core.internalGraph)
  sourceNodeId: string, // e.g., 'PREFECT_OBSESSIVE'
  config: DecayConfig,
  currentTurn: number
): void {
  const { rate, minWeight, types, baseTurn = 0 } = config;
  const turnsElapsed = currentTurn - baseTurn; // Elapsed since last decay/creation

  if (!graph.hasNode(sourceNodeId)) return; // Guard: No-op if missing

  const attrs = graph.getNodeAttributes(sourceNodeId);
  // Collect persistent states (grudges, bonds) from node attrs
  const attributes = attrs.attributes as any || {};
  const states = attributes.grudges || {}; // Extensible: Add bonds, secrets

  const decayedStates: Record<string, number> = {};
  let hasChange = false;

  Object.entries(states).forEach(([targetId, intensity]: [string, number]) => {
    // Exponential decay formula: Fades over time, caps at min
    // Only apply if intensity is above minWeight
    if (intensity > minWeight) {
        let decayed = intensity * Math.pow(1 - rate, 1); // Apply 1 step of decay per trigger
        decayed = Math.max(minWeight, decayed);
        decayedStates[targetId] = decayed;
        hasChange = true;

        // Sync to edges: Update matching type/weight
        graph.forEachEdge(sourceNodeId, (edge, edgeAttrs, src, target) => {
        if (
            src === sourceNodeId &&
            target === targetId &&
            types.includes(edgeAttrs.type as string)
        ) {
            graph.mergeEdgeAttributes(edge, {
            weight: decayed,
            meta: { ...edgeAttrs.meta, fadedAt: currentTurn } // Provenance
            });
        }
        });
    } else {
        decayedStates[targetId] = intensity;
    }
  });

  // Update node attrs atomically
  if (hasChange) {
      graph.mergeNodeAttributes(sourceNodeId, {
        attributes: { ...attributes, grudges: decayedStates } // Or bonds, etc.
      });
  }

  // Hook: Optional callback for lore (e.g., low weights → 'forgotten echo' motif)
  if (Object.values(decayedStates).some((v: number) => v < 0.15 && v > 0.05)) {
    // console.log('[Decay] Faded cluster detected—potential RELIEF beat hook');
    // e.g., this.onDecayTrigger?.('low_grudge'); // Extensible
  }
}

// Standalone trigger: For cron-like (every 5 turns)
export function triggerPeriodicDecay(
  graph: Graph,
  sources: string[], // e.g., ['Subject_84', 'PREFECT_OBSESSIVE']
  config: DecayConfig,
  currentTurn: number
): void {
  sources.forEach(source => applyDecayMutation(graph, source, config, currentTurn));
}