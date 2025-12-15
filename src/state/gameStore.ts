
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { KnowledgeGraph } from '../lib/types/kgot';
import { executeUnifiedDirectorTurn } from '../lib/unifiedDirector';
import { INITIAL_LEDGER } from '../constants';
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { createSubjectSlice } from './subjectSlice';
import { LogEntry, CombinedGameStoreState, CharacterId, PrefectDNA, GameState, YandereLedger } from '../types';
import { KGotController } from '../controllers/KGotController';
import { enqueueTurnForMedia } from './mediaController';
import { createIndexedDBStorage, forgeStorage } from '../utils/indexedDBStorage';

// Use a factory function for initial graph to avoid global state pollution
const getInitialGraph = (): KnowledgeGraph => {
    const controller = new KGotController({ 
        nodes: {}, 
        edges: [], 
        global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } 
    });
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
  count: number = 2
): PrefectDNA[] {
  const scores = new Map<string, number>();
  
  prefects.forEach(p => {
    let score = 0.1;
    
    if (ledger.traumaLevel > 60) {
      if (p.archetype === 'The Nurse') score += 0.6;
      if (p.archetype === 'The Voyeur') score += 0.3;
    }
    
    if (ledger.complianceScore < 40) {
      if (p.archetype === 'The Zealot') score += 0.5;
      if (p.archetype === 'The Sadist') score += 0.4;
    }
    
    switch (p.archetype) {
      case 'The Yandere':
        score += 0.4;
        if (ledger.complianceScore < 30) score += 0.2;
        break;
      case 'The Dissident':
        if (ledger.hopeLevel > 40) score += 0.4;
        break;
    }
    
    if (p.favorScore > 70) score += 0.2;
    if (p.currentEmotionalState?.paranoia > 0.7) score += 0.2;
    
    scores.set(p.id, score);
  });
  
  return [...prefects]
    .sort((a, b) => {
      const scoreA = scores.get(a.id) || 0;
      const scoreB = scores.get(b.id) || 0;
      return (scoreB + Math.random() * 0.3) - (scoreA + Math.random() * 0.3);
    })
    .slice(0, count);
}

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
      gameState: INITIAL_GAME_STATE,
      kgot: getInitialGraph(),
      logs: INITIAL_LOGS,
      choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
      prefects: [], 
      sessionActive: false,
      narrativeClusters: {},
      isLiteMode: false,
      
      isThinking: false,
      isMenuOpen: false,
      isGrimoireOpen: false,
      isDevOverlayOpen: false,
      
      executedCode: undefined,
      lastSimulationLog: undefined,
      lastDirectorDebug: undefined,

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

          // 1. Identify Primary Actor for Visualization using Fuzzy Resolution
          let primaryActor: PrefectDNA | CharacterId | string = CharacterId.PLAYER; 
          
          if (result.prefectSimulations && result.prefectSimulations.length > 0) {
              const sortedSims = [...result.prefectSimulations].sort((a: any, b: any) => 
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
          if (result.narrative) {
              const subjectNode = controller.getGraph().nodes['Subject_84'];
              const currentLocation = subjectNode?.attributes?.currentLocation || state.gameState.location;

              const newTurn = get().registerTurn(
                  result.narrative, 
                  result.visualPrompt, 
                  result.audioMarkup, 
                  {
                    ledgerSnapshot: result.state_updates ? { ...get().gameState.ledger, ...result.state_updates } : get().gameState.ledger,
                    directorDebug: result.thoughtProcess,
                    activeCharacters: typeof primaryActor !== 'string' ? [primaryActor.id] : [primaryActor],
                    location: currentLocation,
                  },
                  result.script
              );
              newTurnId = newTurn.id;
              
              enqueueTurnForMedia(
                newTurn, 
                primaryActor, 
                get().gameState.ledger
              );
          }

          if (result.thoughtProcess) {
              get().addLog({ id: `thought-${Date.now()}`, type: 'thought', content: result.thoughtProcess });
          }
          if (result.narrative) {
              get().addLog({ 
                  id: newTurnId || `narrative-${Date.now()}`, 
                  type: 'narrative', 
                  content: result.narrative, 
                  visualContext: result.visualPrompt,
                  script: result.script
              });
          }
          if (result.psychosisText) {
              get().addLog({
                  id: `psychosis-${Date.now()}`,
                  type: 'psychosis',
                  content: result.psychosisText
              });
          }

          // === HANDLING MUTATIONS AND SYNCING TO STORE ===
          if (result.kgot_mutations) {
             // 1. Process Side Effects (Logs / Subject Updates)
             result.kgot_mutations.forEach((mut: any) => {
                 // Handle 'add_injury' mutations using resolved IDs
                 if (mut.operation === 'add_injury' && mut.params) {
                     const rawTargetId = mut.params.target_id || mut.params.subject_id;
                     const finalTarget = controller.resolveEntityId(rawTargetId) || rawTargetId;
                     
                     const subject = get().subjects[finalTarget];
                     if (subject) {
                         const injuryName = mut.params.injury_name || mut.params.injury;
                         const updatedInjuries = [...new Set([...(subject.injuries || []), injuryName])];
                         get().updateSubject(finalTarget, { injuries: updatedInjuries });
                         
                         get().addLog({
                             id: `injury-${Date.now()}`,
                             type: 'system',
                             content: `CRITICAL INJURY LOGGED: ${injuryName} >> SUBJECT ${finalTarget}`
                         });
                     }
                 }
                 // Handle 'add_subject_secret' mutations
                 if ((mut.operation === 'add_subject_secret' || mut.operation === 'add_secret') && mut.params) {
                     const rawSubjectId = mut.params.subject_id || CharacterId.PLAYER;
                     const subjectId = controller.resolveEntityId(rawSubjectId) || rawSubjectId;
                     const secretName = mut.params.secret_name || "Hidden Truth";
                     const discoveredBy = mut.params.discovered_by || "Unknown";

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

             // 2. Apply mutations to the Graph via Controller (which handles ID resolution internally now for mutations)
             controller.applyMutations(result.kgot_mutations);
          }

          // 3. Handle Ledger Updates via Controller
          if (result.state_updates) {
              controller.updateLedger('Subject_84', result.state_updates);
          }

          // 4. Retrieve Updated Graph from Controller
          const finalGraph = controller.getGraph();

          set((state) => {
              let nextLedger = state.gameState.ledger;
              if (result.state_updates) {
                 nextLedger = updateLedgerHelper(state.gameState.ledger, result.state_updates);
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
                  }
              };
          });
      },

      applyDirectorUpdates: (response: any) => {
        console.warn("Using legacy applyDirectorUpdates - migrate to applyServerState");
      },

      processPlayerTurn: async (input: string) => {
        const state = get();
        set({ isThinking: true });
        
        let actionType: 'COMPLY' | 'DEFY' | 'OBSERVE' | 'SPEAK' = 'OBSERVE';
        const lower = input.toLowerCase();
        if (lower.includes('submit') || lower.includes('yes')) actionType = 'COMPLY';
        else if (lower.includes('resist') || lower.includes('no')) actionType = 'DEFY';
        else if (lower.includes('speak') || lower.includes('ask')) actionType = 'SPEAK';
        
        get().triggerSubjectReaction(actionType, input);
        
        try {
          const history = state.logs.filter(l => l.type === 'narrative').map(l => l.content);
          
          let currentPrefects = state.prefects;
          if (currentPrefects.length === 0) {
            const { initializePrefects } = await import('../lib/agents/PrefectGenerator');
            currentPrefects = initializePrefects(state.gameState.seed);
            set({ prefects: currentPrefects });
          }
          
          const activePrefects = selectActivePrefects(
            currentPrefects, 
            state.gameState.ledger, 
            2 
          );
          
          const result = await executeUnifiedDirectorTurn(
            input,
            history,
            state.kgot,
            activePrefects,
            state.isLiteMode
          );
          
          if (result.prefectSimulations && result.prefectSimulations.length > 0) {
            const updatedPrefects = [...state.prefects];
            
            // Instantiate Controller for ID Resolution
            const controller = new KGotController(state.kgot);

            result.prefectSimulations.forEach((sim: any) => {
              // Resolve Prefect ID
              const resolvedId = controller.resolveEntityId(sim.prefect_id) || sim.prefect_id;
              const prefectIndex = updatedPrefects.findIndex(p => p.id === resolvedId);
              
              if (prefectIndex !== -1) {
                const prefect = updatedPrefects[prefectIndex];
                
                prefect.currentEmotionalState = sim.emotional_state;
                prefect.lastPublicAction = sim.public_action;
                
                if (sim.favor_score_delta) {
                  prefect.favorScore = Math.max(0, Math.min(100, 
                    prefect.favorScore + sim.favor_score_delta
                  ));
                }
                
                if (sim.secrets_uncovered?.length) {
                  prefect.knowledge = [
                    ...(prefect.knowledge || []),
                    ...sim.secrets_uncovered
                  ].slice(-10); 
                }
                
                if (sim.sabotage_attempt) {
                  // Resolve Target ID for Sabotage
                  const targetRaw = sim.sabotage_attempt.target;
                  const targetId = controller.resolveEntityId(targetRaw);
                  
                  if (targetId && updatedPrefects.some(p => p.id === targetId)) {
                    prefect.relationships[targetId] = 
                      Math.max(-1, (prefect.relationships[targetId] || 0) - 0.3);
                  }
                }
                
                if (sim.alliance_signal) {
                  // Resolve Target ID for Alliance
                  const targetRaw = sim.alliance_signal.target;
                  const targetId = controller.resolveEntityId(targetRaw);
                  
                  if (targetId && updatedPrefects.some(p => p.id === targetId)) {
                    prefect.relationships[targetId] = 
                      Math.min(1, (prefect.relationships[targetId] || 0) + 0.2);
                  }
                }
                
                updatedPrefects[prefectIndex] = prefect;
              }
            });
            
            set({ prefects: updatedPrefects });
            
            const simLog = result.prefectSimulations
              .map((s: any) => `${s.prefect_name}: "${s.hidden_motivation.substring(0, 40)}..."`)
              .join(' | ');
            
            get().addLog({
              id: `sim-${Date.now()}`,
              type: 'system',
              content: `PREFECT SIMULATION :: ${simLog}`
            });
          }
          
          get().applyServerState(result);
          
        } catch (e: any) {
          console.error("Unified Director Error:", e);
          set({ isThinking: false }); 
          get().addLog({
            id: `error-${Date.now()}`,
            type: 'system',
            content: `ERROR: Neuro-Symbolic disconnect. (${e.message || 'Unknown error'})`
          });
        }
      },

      resetGame: () => {
        get().resetMultimodalState();
        // Use local controller to generate fresh state
        const freshController = new KGotController({ nodes: {}, edges: [], global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } });
        const newSeed = Date.now();
        
        set({
          gameState: { ...INITIAL_GAME_STATE, seed: newSeed },
          kgot: freshController.getGraph(),
          logs: INITIAL_LOGS,
          choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
          prefects: [],
          sessionActive: false, 
          narrativeClusters: {},
          isThinking: false,
          executedCode: undefined,
          lastSimulationLog: undefined,
          lastDirectorDebug: undefined,
        });
      },

      startSession: async (isLiteMode = false) => {
        set({ sessionActive: true, isLiteMode }); 
        const state = get();
        
        if (state.prefects.length === 0) {
            const { initializePrefects } = await import('../lib/agents/PrefectGenerator');
            const newPrefects = initializePrefects(state.gameState.seed);
            set({ prefects: newPrefects });
        }
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
            isLiteMode: lightweightState.isLiteMode
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
              choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
            }));
            console.log("Game state restored (Split-Storage).");
            get().addLog({ id: `system-load-${Date.now()}`, type: 'system', content: 'SYSTEM STATE RESTORED FROM ARCHIVE.' });
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
      }),
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<CombinedGameStoreState>;
        return { ...currentState, ...state, sessionActive: false, isThinking: false }; 
      },
    }
  )
);
