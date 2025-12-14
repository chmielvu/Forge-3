
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { KnowledgeGraph } from '../lib/types/kgot';
import { executeUnifiedDirectorTurn } from '../lib/unifiedDirector';
import { INITIAL_LEDGER } from '../constants';
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { createSubjectSlice } from './subjectSlice';
import { LogEntry, CombinedGameStoreState, CharacterId, PrefectDNA, PrefectDecision, GameState } from '../types';
import { KGotController } from '../controllers/KGotController';
import { enqueueTurnForMedia } from './mediaController';
import { createIndexedDBStorage } from '../utils/indexedDBStorage';

// Initialize the Controller to get the canonical graph structure
const controller = new KGotController({ 
    nodes: {}, 
    edges: [], 
    global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } 
});
const INITIAL_GRAPH: KnowledgeGraph = controller.getGraph();

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

// Helper: Lightweight K-Means Clustering (replacing heavy ml5)
function simpleKMeans(vectors: Record<string, number[]>, k: number = 3): Record<string, string[]> {
    const keys = Object.keys(vectors);
    if (keys.length < k) return { 'cluster_0': keys };

    // 1. Initialize Centroids randomly
    const centroids: number[][] = [];
    for (let i = 0; i < k; i++) {
        centroids.push(vectors[keys[Math.floor(Math.random() * keys.length)]]);
    }

    let assignments: Record<string, number> = {};
    let iterations = 0;
    
    // 2. Iteration Loop
    while (iterations < 10) {
        // Assign
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

        // Update Centroids
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

    // 3. Group by Cluster
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
  ledger: any, 
  count: number = 2
): PrefectDNA[] {
  const scores = new Map<string, number>();
  
  prefects.forEach(p => {
    let score = 0.1;
    
    // Ledger reactivity
    if (ledger.traumaLevel > 60) {
      if (p.archetype === 'The Nurse') score += 0.6;
      if (p.archetype === 'The Voyeur') score += 0.3;
    }
    
    if (ledger.complianceScore < 40) {
      if (p.archetype === 'The Zealot') score += 0.5;
      if (p.archetype === 'The Sadist') score += 0.4;
    }
    
    // Archetype-specific
    switch (p.archetype) {
      case 'The Yandere':
        score += 0.4;
        if (ledger.complianceScore < 30) score += 0.2;
        break;
      case 'The Dissident':
        if (ledger.hopeLevel > 40) score += 0.4;
        break;
      // ... other archetypes
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
    narrativeClusters: Record<string, string[]>; // New: Stores Node2Vec Clusters
    analyzeGraph: () => void; // New: Triggers analysis
    
    // Lite Mode Support
    isLiteMode: boolean;
    setLiteMode: (isLite: boolean) => void;
    startSession: (isLiteMode?: boolean) => Promise<void>; 
}

export const useGameStore = create<GameStoreWithPrefects>()(
  persist(
    (set, get, api) => ({
      gameState: INITIAL_GAME_STATE,
      kgot: INITIAL_GRAPH,
      logs: INITIAL_LOGS,
      choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
      prefects: [], 
      sessionActive: false, // Default to false
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
          // MEMORY MANAGEMENT: Prune old logs if they exceed threshold
          // This prevents the application state from bloating indefinitely
          const MAX_LOGS = 50;
          let updatedLogs = [...state.logs, log];
          
          if (updatedLogs.length > MAX_LOGS) {
              // Keep initial system logs (0-1) and the last 40 logs
              // This is a simple sliding window strategy
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
          // Triggered periodically or after turns to update embeddings and clusters
          const state = get();
          const currentController = new KGotController(state.kgot);
          
          // 1. Compute GraphSAGE Embeddings (Deep Learning for Graph)
          const embeddings = await currentController.getGraphSAGEEmbeddings();
          
          // 2. Perform Clustering (Narrative Subplots)
          // K=3 for finding e.g., 'Trauma Group', 'Faculty Elite', 'Resistance'
          const clusters = simpleKMeans(embeddings, 3);
          
          // 3. Log results to system if changed
          console.log("[GraphAnalysis] Narrative Clusters updated (SAGE):", clusters);
          
          set({ narrativeClusters: clusters });
      },

      applyServerState: (result: any) => {
          // 1. Identify Primary Actor for Visualization
          let primaryActor: PrefectDNA | CharacterId | string = CharacterId.PLAYER; // Default to player/POV
          
          if (result.prefectSimulations && result.prefectSimulations.length > 0) {
              const sortedSims = [...result.prefectSimulations].sort((a: any, b: any) => 
                  (b.public_action?.length || 0) - (a.public_action?.length || 0)
              );
              const activeId = sortedSims[0].prefect_id;
              const prefect = get().prefects.find(p => p.id === activeId);
              if (prefect) {
                  primaryActor = prefect;
              }
          }

          // 2. Register Multimodal Turn
          let newTurnId: string | null = null;
          if (result.narrative) {
              const newTurn = get().registerTurn(
                  result.narrative, 
                  result.visualPrompt, 
                  result.audioMarkup, 
                  {
                    ledgerSnapshot: result.state_updates ? { ...get().gameState.ledger, ...result.state_updates } : get().gameState.ledger,
                    directorDebug: result.thoughtProcess,
                    activeCharacters: typeof primaryActor !== 'string' ? [primaryActor.id] : [primaryActor]
                  }
              );
              newTurnId = newTurn.id;
              
              // Trigger media generation pipeline
              enqueueTurnForMedia(
                newTurn, 
                primaryActor, 
                get().gameState.ledger
              );
          }

          // State updates via setter to trigger pruning logic inside addLog
          // We can't use simple spread here because addLog contains logic
          
          if (result.thoughtProcess) {
              get().addLog({ id: `thought-${Date.now()}`, type: 'thought', content: result.thoughtProcess });
          }
          
          if (result.narrative) {
              get().addLog({ 
                  id: newTurnId || `narrative-${Date.now()}`, 
                  type: 'narrative', 
                  content: result.narrative, 
                  visualContext: result.visualPrompt 
              });
          }

          if (result.psychosisText) {
              get().addLog({
                  id: `psychosis-${Date.now()}`,
                  type: 'psychosis',
                  content: result.psychosisText
              });
          }

          set((state) => {
              let nextKgot = state.kgot;
              if (result.updatedGraph) {
                  nextKgot = result.updatedGraph;
              }

              let nextLedger = state.gameState.ledger;
              if (result.state_updates) {
                 nextLedger = updateLedgerHelper(state.gameState.ledger, result.state_updates);
              }

              // Determine next turn count (Sync with KGoT or increment)
              const nextTurn = nextKgot.global_state?.turn_count 
                ? nextKgot.global_state.turn_count 
                : (state.gameState.turn + 1);

              return {
                  kgot: nextKgot,
                  choices: result.choices || [],
                  // logs are updated via addLog above
                  isThinking: false,
                  gameState: {
                      ...state.gameState,
                      ledger: nextLedger,
                      turn: nextTurn // Update local turn count
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
          
          // Pass the isLiteMode flag from store to the Director
          const result = await executeUnifiedDirectorTurn(
            input,
            history,
            state.kgot,
            activePrefects,
            state.isLiteMode
          );
          
          if (result.prefectSimulations && result.prefectSimulations.length > 0) {
            const updatedPrefects = [...state.prefects];
            
            result.prefectSimulations.forEach((sim: any) => {
              const prefectIndex = updatedPrefects.findIndex(p => p.id === sim.prefect_id);
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
                  const targetId = updatedPrefects.find(p => 
                    p.displayName.includes(sim.sabotage_attempt.target)
                  )?.id;
                  if (targetId) {
                    prefect.relationships[targetId] = 
                      Math.max(-1, (prefect.relationships[targetId] || 0) - 0.3);
                  }
                }
                
                if (sim.alliance_signal) {
                  const targetId = updatedPrefects.find(p => 
                    p.displayName.includes(sim.alliance_signal.target)
                  )?.id;
                  if (targetId) {
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
          set({ isThinking: false }); // Ensure UI is no longer stuck in thinking state
          get().addLog({
            id: `error-${Date.now()}`,
            type: 'system',
            content: `ERROR: Neuro-Symbolic disconnect. (${e.message || 'Unknown error'})`
          });
        }
      },

      resetGame: () => {
        get().resetMultimodalState();
        const freshController = new KGotController({ nodes: {}, edges: [], global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } });
        const newSeed = Date.now();
        
        set({
          gameState: { ...INITIAL_GAME_STATE, seed: newSeed },
          kgot: freshController.getGraph(),
          logs: INITIAL_LOGS,
          choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
          prefects: [],
          sessionActive: false, // Reset active state
          narrativeClusters: {},
          isThinking: false,
          executedCode: undefined,
          lastSimulationLog: undefined,
          lastDirectorDebug: undefined,
          // Preserve isLiteMode setting or reset? Assuming preserve.
        });
      },

      startSession: async (isLiteMode = false) => {
        set({ sessionActive: true, isLiteMode }); // Activate session with mode preference
        const state = get();
        
        if (state.prefects.length === 0) {
            const { initializePrefects } = await import('../lib/agents/PrefectGenerator');
            const newPrefects = initializePrefects(state.gameState.seed);
            set({ prefects: newPrefects });
        }

        if (Object.keys(state.subjects).length === 0) {
            state.initializeSubjects();
        }

        if (state.multimodalTimeline.length === 0) {
           console.log("[GameStore] Bootstrapping opening scene...");
           set({ isThinking: true });
           
           try {
               const result = await executeUnifiedDirectorTurn(
                   "INITIALIZE_SIMULATION", 
                   [], 
                   state.kgot,
                   [],
                   isLiteMode // Pass lite mode preference
               );
               get().applyServerState(result);
           } catch (e: any) {
               console.error("Failed to bootstrap session:", e);
               set({ isThinking: false }); // Ensure UI is no longer stuck in thinking state
               get().addLog({
                 id: `error-boot-${Date.now()}`,
                 type: 'system',
                 content: `ERROR: Failed to initialize session. (${e.message || 'Unknown error'})`
               });
           }
        }
        
        // Trigger initial graph analysis
        get().analyzeGraph();
      },
      
      saveSnapshot: () => {
         console.log("Snapshot saved via middleware");
      },
      loadSnapshot: () => {
         window.location.reload(); 
      }
    }),
    {
      name: 'forge-storage',
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        gameState: state.gameState,
        kgot: state.kgot,
        prefects: state.prefects,
        subjects: state.subjects,
        sessionActive: state.sessionActive,
        isLiteMode: state.isLiteMode,
      }),
    }
  )
);

// --- Reactive Subscriptions ---

let analysisTimer: ReturnType<typeof setTimeout> | null = null;

// Automatically trigger graph analysis whenever the Knowledge Graph (kgot) updates
useGameStore.subscribe((state, prevState) => {
  if (state.kgot !== prevState.kgot) {
    if (analysisTimer) clearTimeout(analysisTimer);
    
    // Debounce analysis (2s) to prevent computation during rapid updates
    analysisTimer = setTimeout(() => {
      console.log("[GameStore] 🧠 Reactive Graph Analysis Triggered (KGOT Mutation)");
      useGameStore.getState().analyzeGraph();
    }, 2000);
  }
});
