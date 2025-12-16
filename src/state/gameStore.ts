import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { KnowledgeGraph } from '../lib/types/kgot';
import { executeUnifiedDirectorTurn } from '../lib/unifiedDirector';
import { INITIAL_LEDGER, INITIAL_NODES, INITIAL_LINKS } from '../constants'; // Updated from @/constants
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { createSubjectSlice } from './subjectSlice';
import { LogEntry, CombinedGameStoreState, CharacterId, PrefectDNA, GameState, YandereLedger, SubjectSliceExports } from '../types';
import { KGotController } from '../controllers/KGotController'; // Updated from @/controllers/KGotController
import { enqueueTurnForMedia } from './mediaController';
import { createIndexedDBStorage, forgeStorage } from '../utils/indexedDBStorage';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning'; // Updated from @/config/behaviorTuning
import { audioService } from '../services/AudioService';
import { initializePrefects } from '../lib/agents/PrefectGenerator'; // Updated from lazy import

// Use a factory function for initial graph to avoid global state pollution
const getInitialGraph = (): KnowledgeGraph => {
    // Create an empty graph first
    const emptyGraph: KnowledgeGraph = { 
        nodes: {}, 
        edges: [], 
        global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } 
    };
    // Initialize a controller with the empty graph.
    // The KGotController constructor will automatically call initializeCanonicalNodes if the graph is empty.
    const controller = new KGotController(emptyGraph);
    return controller.getGraph();
};

const INITIAL_GAME_STATE: GameState = {
    ledger: INITIAL_LEDGER,
    location: 'The Arrival Dock',
    turn: 0,
    nodes: [], 
    links: [],
    seed: Date.now() 
};

const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'system-init',
    type: 'system',
    content: 'NEURO-SYMBOLIC ENGINE INITIALIZED. CONNECTING TO THE LOOM...'
  },
  {
    id: 'system-auth',
    type: 'system',
    content: 'SUBJECT_84 DETECTED. BIOMETRICS: ELEVATED CORTISOL.'
  }
];

// Helper: Lightweight K-Means Clustering
function simpleKMeans(vectors: Record<string, number[]>, k: number = 3): Record<string, string[]> {
    const keys = Object.keys(vectors);
    if (keys.length < k) return { 'cluster_0': keys };

    const centroids: number[][] = [];
    for (let i = 0; i < k; i++) {
        centroids.push(vectors[keys[Math.floor(Math.random() * keys.length)]]);
    }

    let assignments: Record<string, number> = {};
    let iterations = 0;
    
    while (iterations < 10) {
        let changed = false;
        keys.forEach(key => {
            const vec = vectors[key];
            let minDist = Infinity;
            let closest = 0;
            centroids.forEach((cent, idx) => {
                const dist = vec.reduce((sum, v, i) => sum + Math.pow(v - cent[i], 2), 0);
                if (dist < minDist) {
                    minDist = dist;
                    closest = idx;
                }
            });
            if (assignments[key] !== closest) changed = true;
            assignments[key] = closest;
        });

        if (!changed) break;

        const newCentroids = Array(k).fill(0).map(() => Array(vectors[keys[0]].length).fill(0));
        const counts = Array(k).fill(0);
        
        keys.forEach(key => {
            const cluster = assignments[key];
            const vec = vectors[key];
            vec.forEach((v, i) => newCentroids[cluster][i] += v);
            counts[cluster]++;
        });

        for(let i=0; i<k; i++) {
            if (counts[i] > 0) {
                newCentroids[i] = newCentroids[i].map(v => v / counts[i]);
                centroids[i] = newCentroids[i];
            }
        }
        iterations++;
    }

    const groups: Record<string, string[]> = {};
    Object.entries(assignments).forEach(([node, cluster]) => {
        const clusterName = `cluster_${cluster}`;
        if (!groups[clusterName]) groups[clusterName] = [];
        groups[clusterName].push(node);
    });
    
    return groups;
}

// Helper to select active prefects for the scene
function selectActivePrefects(
  prefects: PrefectDNA[], 
  ledger: YandereLedger,
  count: number = BEHAVIOR_CONFIG.UNIFIED_DIRECTOR.ACTIVE_PREFECT_COUNT
): PrefectDNA[] {
  const scores = new Map<string, number>();
  
  prefects.forEach(p => {
    let score = 0.1;
    
    if (ledger.traumaLevel > 60) {
      if (p.archetype === 'The Nurse') score += 0.6;
      if (p.archetype === 'The Voyeur') score += 0.3; // Voyeur might observe trauma
    }
    
    if (ledger.complianceScore < 40) {
      if (p.archetype === 'The Zealot') score += 0.5;
      if (p.archetype === 'The Sadist') score += 0.4;
    }
    
    switch (p.archetype) {
      case 'The Yandere':
        score += 0.4;
        if (ledger.complianceScore < 30) score += 0.2;
        // High arousal may attract Yandere
        if (ledger.arousalLevel > 50) score += 0.3; 
        break;
      case 'The Dissident':
        if (ledger.hopeLevel > 40) score += 0.4;
        // Dissident might be attracted to defiance
        if (ledger.complianceScore < 20) score += 0.3;
        break;
      case 'The Confessor': // Calista
        // Confessor is attracted to high shame/trauma for trauma bonding
        if (ledger.shamePainAbyssLevel > 50 || ledger.traumaLevel > 50) score += 0.5;
        if (ledger.arousalLevel > 30) score += 0.2; // Sensuality is a weapon
        break;
      case 'The Logician': // Lysandra
        // Logician is attracted to novel data points from trauma
        if (ledger.traumaLevel > 60 && ledger.traumaLevel < 80) score += 0.4; // Not too high (psychosis)
        if (ledger.physicalIntegrity < 50) score += 0.3; // More data from fragile subjects
        break;
      case 'The Sadist': // Petra
        // Sadist is attracted to defiance and fresh subjects
        if (ledger.complianceScore < 30) score += 0.4;
        if (ledger.physicalIntegrity > 80) score += 0.3; // Still has "fight"
        break;
    }
    
    if (p.favorScore > 70) score += 0.2; // High favor attracts further interaction
    if (p.currentEmotionalState?.paranoia > 0.7) score += 0.2; // Paranoid prefects might become active
    
    scores.set(p.id, score);
  });
  
  return [...prefects]
    .sort((a, b) => {
      const scoreA = scores.get(a.id) || 0;
      const scoreB = scores.get(b.id) || 0;
      // Add a small random jitter to break ties and add variability, but keep core scores dominant
      return (scoreB + Math.random() * 0.1) - (scoreA + Math.random() * 0.1);
    })
    .slice(0, count);
}

// FIX: Add a factory function for the initial base state
const getInitialBaseState = () => ({
  gameState: INITIAL_GAME_STATE,
  kgot: getInitialGraph(), // Ensure a fresh graph is always generated
  logs: INITIAL_LOGS,
  choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
  prefects: [], // Prefects are re-initialized on session start
  sessionActive: false,
  narrativeClusters: {},
  isLiteMode: BEHAVIOR_CONFIG.TEST_MODE, // Set initial lite mode from config
  
  isThinking: false,
  isMenuOpen: false,
  isGrimoireOpen: false,
  isDevOverlayOpen: false,
  
  executedCode: undefined,
  lastSimulationLog: undefined,
  lastDirectorDebug: undefined,
  subjects: {}, // Initialize subjects state
});

export interface GameStoreWithPrefects extends CombinedGameStoreState {
    prefects: PrefectDNA[];
    updatePrefects: (prefects: PrefectDNA[]) => void;
    narrativeClusters: Record<string, string[]>;
    analyzeGraph: () => void;
    
    isLiteMode: boolean;
    setLiteMode: (isLite: boolean) => void;
    startSession: (isLiteMode?: boolean) => Promise<void>; 
    saveSnapshot: () => Promise<void>;
    loadSnapshot: () => Promise<void>;
}

export const useGameStore = create<GameStoreWithPrefects>()(
  persist(
    (set, get, api) => ({
      ...getInitialBaseState(), // Initialize with the base state factory

      ...createMultimodalSlice(set, get, api),
      ...createSubjectSlice(set, get, api),

      addLog: (log) => set((state) => {
          const MAX_LOGS = 50;
          let updatedLogs = [...state.logs, log];
          
          if (updatedLogs.length > MAX_LOGS) {
              const systemLogs = updatedLogs.filter(l => l.type === 'system' && l.id.includes('init'));
              const recentLogs = updatedLogs.slice(-(MAX_LOGS - systemLogs.length));
              updatedLogs = [...systemLogs, ...recentLogs];
          }
          return { logs: updatedLogs };
      }),
      setLogs: (logs) => set({ logs }),
      setChoices: (choices) => set({ choices }),
      setThinking: (isThinking) => set({ isThinking }),
      setMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
      setGrimoireOpen: (isGrimoireOpen) => set({ isGrimoireOpen }),
      setDevOverlayOpen: (isDevOverlayOpen) => set({ isDevOverlayOpen }),
      updatePrefects: (prefects) => set({ prefects }),
      setLiteMode: (isLiteMode) => set({ isLiteMode }),

      updateGameState: (updates) => set((state) => ({
        gameState: { ...state.gameState, ...updates }
      })),

      updateLogMedia: (logId, media) => set((state) => ({
        logs: state.logs.map(log => log.id === logId ? { ...log, ...media } : log)
      })),

      analyzeGraph: async () => {
          const state = get();
          const currentController = new KGotController(state.kgot);
          const embeddings = currentController.getNode2VecEmbeddings();
          const clusters = simpleKMeans(embeddings, 3);
          console.log("[GraphAnalysis] Narrative Clusters updated (Node2Vec):", clusters);
          set({ narrativeClusters: clusters });
      },

      applyServerState: (result: any) => {
          const state = get();
          
          // Initialize controller with current graph state to process updates
          const controller = new KGotController(state.kgot);

          // Handle property name mismatch from different sources (legacy vs unified)
          const simulations = result.prefect_simulations;

          // 1. Identify Primary Actor for Visualization using Fuzzy Resolution
          let primaryActor: PrefectDNA | CharacterId | string = CharacterId.PLAYER; 
          
          if (simulations && simulations.length > 0) {
              const sortedSims = [...simulations].sort((a: any, b: any) => 
                  (b.public_action?.length || 0) - (a.public_action?.length || 0)
              );
              const activeId = sortedSims[0].prefect_id;
              // Resolve ID using controller
              const resolvedActiveId = controller.resolveEntityId(activeId) || activeId;
              const prefect = get().prefects.find(p => p.id === resolvedActiveId);
              if (prefect) {
                  primaryActor = prefect;
              }
          }

          // 2. Register Multimodal Turn
          let newTurnId: string | null = null;
          if (result.narrative_text) {
              const subjectNode = controller.getGraph().nodes['Subject_84'];
              const currentLocation = subjectNode?.attributes?.currentLocation || state.gameState.location;

              const newTurn = get().registerTurn(
                  result.narrative_text, 
                  result.visual_prompt, 
                  result.audio_markup, 
                  {
                    ledgerSnapshot: result.ledger_update ? { ...get().gameState.ledger, ...result.ledger_update } : get().gameState.ledger,
                    directorDebug: result.agot_trace ? JSON.stringify(result.agot_trace, null, 2) : "No trace.",
                    activeCharacters: typeof primaryActor !== 'string' ? [primaryActor.id] : [primaryActor],
                    location: currentLocation,
                    simulationLog: simulations ? JSON.stringify(simulations, null, 2) : "No simulation."
                  },
                  result.script // Pass the structured script here
              );
              newTurnId = newTurn.id;
              
              enqueueTurnForMedia(
                newTurn, 
                primaryActor, 
                get().gameState.ledger
              );
          }

          if (result.agot_trace) {
              get().addLog({ id: `thought-${Date.now()}`, type: 'thought', content: JSON.stringify(result.agot_trace, null, 2) });
          }
          if (result.narrative_text) {
              get().addLog({ 
                  id: newTurnId || `narrative-${Date.now()}`, 
                  type: 'narrative', 
                  content: result.narrative_text, 
                  visualContext: result.visual_prompt,
                  script: result.script // Also store script directly in log for direct rendering if needed
              });
          }
          if (result.psychosis_text) {
              get().addLog({
                  id: `psychosis-${Date.now()}`,
                  type: 'psychosis',
                  content: result.psychosis_text
              });
          }
          if (simulations) {
              const simLog = simulations
              .map((s: any) => `${s.prefect_name}: "${s.hidden_motivation.substring(0, 40)}..."`)
              .join(' | ');
            
            get().addLog({
              id: `sim-${Date.now()}`,
              type: 'system',
              content: `PREFECT SIMULATION :: ${simLog}`
            });
          }

          // === HANDLING MUTATIONS AND SYNCING TO STORE ===
          
          // 3. Apply Prefect Simulations to Graph (Updates agent state, memories, etc.)
          if (simulations && simulations.length > 0) {
              controller.applyPrefectSimulations(simulations);
          }

          // 4. Apply Explicit KGoT Mutations
          if (result.kgot_mutations) {
             // Process Side Effects (Logs / Subject Updates)
             result.kgot_mutations.forEach((mut: any) => {
                 // Handle 'add_injury' / 'inflict_somatic_trauma' mutations using resolved IDs
                 if ((mut.operation === 'add_injury' || mut.operation === 'inflict_somatic_trauma') && (mut.params || mut.target_id || mut.subject_id)) {
                     const rawTargetId = mut.target_id || mut.params?.target_id || mut.subject_id || mut.params?.subject_id;
                     const finalTarget = controller.resolveEntityId(rawTargetId) || rawTargetId;
                     
                     const subject = get().subjects[finalTarget];
                     if (subject) {
                         const injuryName = mut.description || mut.injury || mut.params?.injury_name || mut.params?.injury;
                         const updatedInjuries = [...new Set([...(subject.injuries || []), injuryName])];
                         get().updateSubject(finalTarget, { injuries: updatedInjuries });
                         
                         const severity = mut.severity || mut.params?.severity || 0;
                         get().addLog({
                             id: `injury-${Date.now()}`,
                             type: 'system',
                             content: `SOMATIC TRAUMA LOGGED: ${injuryName} >> SUBJECT ${finalTarget} (Severity: ${severity})`
                         });
                     }
                 }
                 // Handle 'add_subject_secret' mutations
                 if ((mut.operation === 'add_subject_secret' || mut.operation === 'add_secret') && (mut.params || mut.secret_id)) {
                     const rawSubjectId = mut.subject_id || mut.params?.subject_id || CharacterId.PLAYER;
                     const subjectId = controller.resolveEntityId(rawSubjectId) || rawSubjectId;
                     const secretName = mut.description || mut.params?.secret_name || mut.params?.description || "Hidden Truth";
                     const discoveredBy = mut.discovered_by || mut.params?.discovered_by || "Unknown";

                     const subject = get().subjects[subjectId];
                     if (subject) {
                         get().addLog({
                             id: `secret-${Date.now()}`,
                             type: 'system',
                             content: `SECRET DISCOVERED: "${secretName}" about ${subject.name} by ${discoveredBy}.`
                         });
                     }
                 }
             });

             // Apply mutations to the Graph via Controller (which handles ID resolution internally now for mutations)
             controller.applyMutations(result.kgot_mutations);
          }

          // 5. Handle Ledger Updates via Controller
          if (result.ledger_update) {
              controller.updateLedger(CharacterId.PLAYER, result.ledger_update);
          }
          
          // 6. Sync PrefectDNA from Graph back to Store
          // Since graph is the source of truth for agent state (emotions, etc), we sync it back.
          const updatedPrefectsInStore = get().prefects.map(p => {
              const node = controller.getGraph().nodes[p.id];
              if (node && node.attributes) {
                  const nodeAttrs = node.attributes;
                  // Merge emotional state from node if available (updated by simulation)
                  const mergedEmotionalState = {
                      ...p.currentEmotionalState,
                      ...nodeAttrs.currentEmotionalState,
                      ...nodeAttrs.agent_state?.emotional_vector // Legacy path check
                  };

                  return {
                      ...p,
                      currentEmotionalState: mergedEmotionalState,
                      lastPublicAction: nodeAttrs.lastPublicAction || p.lastPublicAction,
                      // Sync other attributes if needed
                  };
              }
              return p;
          });
          set({ prefects: updatedPrefectsInStore });

          // 7. Retrieve Updated Graph from Controller and Update State
          const finalGraph = controller.getGraph();

          set((state) => {
              let nextLedger = state.gameState.ledger;
              if (result.ledger_update) {
                 nextLedger = updateLedgerHelper(state.gameState.ledger, result.ledger_update);
                 
                 // --- UPDATED AUDIO LOGIC ---
                 audioService.updateDrone(nextLedger.traumaLevel);
              }

              // --- NEW: Somatic Feedback Integration ---
              if (result.somatic_state) {
                  // Trigger visceral impact sound if provided
                  if (result.somatic_state.impact_sensation || result.somatic_state.internal_collapse) {
                      audioService.triggerSomaticPulse(0.8);
                      audioService.playSfx('glitch'); // Optional digital tearing sound
                  }
              }

              const nextTurn = finalGraph.global_state?.turn_count 
                ? finalGraph.global_state.turn_count 
                : (state.gameState.turn + 1);

              return {
                  kgot: finalGraph,
                  choices: result.choices || [],
                  isThinking: false,
                  gameState: {
                      ...state.gameState,
                      ledger: nextLedger,
                      turn: nextTurn 
                  },
                  // Update debug logs
                  lastSimulationLog: simulations ? JSON.stringify(simulations, null, 2) : state.lastSimulationLog,
                  lastDirectorDebug: result.agot_trace ? JSON.stringify(result.agot_trace, null, 2) : state.lastDirectorDebug,
              };
          });
      },

      applyDirectorUpdates: (response: any) => {
        // This is now a legacy function, as applyServerState is the main entry point
        console.warn("Using legacy applyDirectorUpdates - all new Director output should go through applyServerState.");
        get().applyServerState(response); // Redirect to main handler
      },

      processPlayerTurn: async (input: string) => {
        const state = get();
        set({ isThinking: true });
        
        let actionType: 'COMPLY' | 'DEFY' | 'OBSERVE' | 'SPEAK' = 'OBSERVE';
        const lower = input.toLowerCase();
        if (lower.includes('submit') || lower.includes('comply') || lower.includes('yes') || lower.includes('endure')) actionType = 'COMPLY';
        else if (lower.includes('defy') || lower.includes('resist') || lower.includes('refuse') || lower.includes('no') || lower.includes('fight')) actionType = 'DEFY';
        else if (lower.includes('speak') || lower.includes('ask') || lower.includes('taunt') || lower.includes('challenge')) actionType = 'SPEAK';
        else if (lower.includes('observe') || lower.includes('watch') || lower.includes('analyse')) actionType = 'OBSERVE';
        
        get().triggerSubjectReaction(actionType, input);
        
        try {
          const history = state.logs.filter(l => l.type === 'narrative').map(l => l.content);
          
          let currentPrefects = state.prefects;
          if (currentPrefects.length === 0) {
            const newPrefects = initializePrefects(state.gameState.seed);
            currentPrefects = newPrefects;
            set({ prefects: currentPrefects });
          }
          
          const activePrefects = selectActivePrefects(
            currentPrefects, 
            state.gameState.ledger // Pass full ledger for more nuanced selection
          );
          
          const result = await executeUnifiedDirectorTurn(
            input,
            history,
            state.kgot,
            activePrefects,
            state.isLiteMode
          );
          
          // Apply server state handles graph updates, prefect updates, and logs
          get().applyServerState(result);
          
        } catch (e: any) {
          console.error("Unified Director Error:", e);
          set({ isThinking: false }); 
          get().addLog({
            id: `error-${Date.now()}`,
            type: 'system',
            content: `ERROR: Neuro-Symbolic disconnect. (${e.message || 'Unknown LLM error'})`
          });
        }
      },

      // FIX: Refactor resetGame to use the initial base state factory
      resetGame: () => {
        get().resetMultimodalState(); // Reset multimodal slice
        get().initializeSubjects();   // Re-initialize subjects slice
        set({ ...getInitialBaseState() }); // Reset main store state
        audioService.stopDrone(); // Stop drone on reset
      },

      startSession: async (isLiteMode = false) => {
        set({ sessionActive: true, isLiteMode }); 
        const state = get();
        
        if (state.prefects.length === 0) {
            const newPrefects = initializePrefects(state.gameState.seed);
            set({ prefects: newPrefects });
        }
        
        get().initializeSubjects(); // Initialize subjects when starting a session
        
        // Sync initial prefects to KGoT
        const controller = new KGotController(get().kgot);
        get().prefects.forEach(p => controller.updateAgentAttributes(p));
        set({ kgot: controller.getGraph() });
        
        audioService.startDrone(); // Start drone on session start
      },

      saveSnapshot: async () => {
        const state = get();
        try {
          const { kgot, ...lightweightState } = state;
          
          await forgeStorage.saveGameState('forge-snapshot', {
            gameState: lightweightState.gameState,
            logs: lightweightState.logs,
            prefects: lightweightState.prefects,
            multimodalTimeline: lightweightState.multimodalTimeline,
            audioPlayback: lightweightState.audioPlayback,
            isLiteMode: lightweightState.isLiteMode,
            subjects: lightweightState.subjects, // Ensure subjects are saved
          });

          const compressedNodes: Record<string, any> = {};
          Object.values(state.kgot.nodes).forEach((node: any) => {
              const { x, y, vx, vy, index, ...cleanNode } = node; 
              compressedNodes[node.id] = cleanNode;
          });
          
          const compressedGraph: KnowledgeGraph = {
              nodes: compressedNodes,
              edges: state.kgot.edges,
              global_state: state.kgot.global_state
          };

          await forgeStorage.saveGraphState('forge-snapshot-graph', compressedGraph);

          console.log("Game state archived (Split-Storage Optimization).");
          get().addLog({ id: `system-save-${Date.now()}`, type: 'system', content: 'SYSTEM STATE ARCHIVED.' });
        } catch (error: any) {
          console.error("Failed to save game state:", error);
          get().addLog({ id: `system-save-error-${Date.now()}`, type: 'system', content: `ERROR: Failed to archive system state: ${error.message}` });
        }
      },

      loadSnapshot: async () => {
        try {
          const [baseState, graphData] = await Promise.all([
              forgeStorage.loadGameState('forge-snapshot'),
              forgeStorage.loadGraphState('forge-snapshot-graph')
          ]);

          if (baseState && graphData) {
            set((state) => ({
              ...state,
              ...baseState,
              kgot: graphData, 
              sessionActive: true, 
              isThinking: false,
              currentTurnId: baseState.multimodalTimeline?.[baseState.multimodalTimeline.length - 1]?.id || null,
              choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'], // Reset choices on load
            }));
            console.log("Game state restored (Split-Storage).");
            get().addLog({ id: `system-load-${Date.now()}`, type: 'system', content: 'SYSTEM STATE RESTORED FROM ARCHIVE.' });
            audioService.startDrone(); // Ensure drone restarts on load
          } else {
            console.warn("No saved state found (Partial or Missing).");
            get().addLog({ id: `system-load-none-${Date.now()}`, type: 'system', content: 'NO SYSTEM ARCHIVE FOUND. STARTING NEW SESSION.' });
            get().resetGame();
          }
        } catch (error: any) {
          console.error("Failed to load game state:", error);
          get().addLog({ id: `system-load-error-${Date.now()}`, type: 'system', content: `ERROR: Failed to restore system state: ${error.message}` });
          get().resetGame();
        }
      },
    }),
    {
      name: 'forge-game-state',
      storage: createJSONStorage(() => createIndexedDBStorage()), 
      partialize: (state) => ({
        gameState: state.gameState,
        logs: state.logs,
        prefects: state.prefects,
        multimodalTimeline: state.multimodalTimeline,
        audioPlayback: state.audioPlayback,
        isLiteMode: state.isLiteMode,
        subjects: state.subjects,
        kgot: state.kgot, // <--- CRITICAL ADDITION: Persist Knowledge Graph (Memories/Grudges)
      }),
      merge: (persistedState, currentState) => {
        // Defensively handle persistedState possibly being null or undefined
        const state = persistedState ? (persistedState as Partial<CombinedGameStoreState>) : {};
        return { ...currentState, ...state, sessionActive: false, isThinking: false }; 
      },
    }
  )
);