
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { KnowledgeGraph } from '../lib/types/kgot';
import { executeDirectorTurn } from '../lib/director';
import { INITIAL_LEDGER } from '../constants';
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { createSubjectSlice } from './subjectSlice';
import { LogEntry, CombinedGameStoreState, CharacterId, PrefectDNA, PrefectDecision, GameState } from '../types';
import { KGotController } from '../controllers/KGotController';
import { enqueueTurnForMedia } from './mediaController';
import { prefectManager } from '../services/prefectManager';
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

export interface GameStoreWithPrefects extends CombinedGameStoreState {
    prefects: PrefectDNA[];
    updatePrefects: (prefects: PrefectDNA[]) => void;
}

export const useGameStore = create<GameStoreWithPrefects>()(
  persist(
    (set, get, api) => ({
      gameState: INITIAL_GAME_STATE,
      kgot: INITIAL_GRAPH,
      logs: INITIAL_LOGS,
      choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
      prefects: [], 
      
      isThinking: false,
      isMenuOpen: false,
      isGrimoireOpen: false,
      isDevOverlayOpen: false,
      
      executedCode: undefined,
      lastSimulationLog: undefined,
      lastDirectorDebug: undefined,

      ...createMultimodalSlice(set, get, api),
      ...createSubjectSlice(set, get, api),

      addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
      setLogs: (logs) => set({ logs }),
      setChoices: (choices) => set({ choices }),
      setThinking: (isThinking) => set({ isThinking }),
      setMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
      setGrimoireOpen: (isGrimoireOpen) => set({ isGrimoireOpen }),
      setDevOverlayOpen: (isDevOverlayOpen) => set({ isDevOverlayOpen }),
      updatePrefects: (prefects) => set({ prefects }),

      updateGameState: (updates) => set((state) => ({
        gameState: { ...state.gameState, ...updates }
      })),

      updateLogMedia: (logId, media) => set((state) => ({
        logs: state.logs.map(log => log.id === logId ? { ...log, ...media } : log)
      })),

      applyServerState: (result: any) => {
          // 1. Register Multimodal Turn
          let newTurnId: string | null = null;
          if (result.narrative) {
              const newTurn = get().registerTurn(result.narrative, result.visualPrompt, {
                  ledgerSnapshot: result.state_updates ? { ...get().gameState.ledger, ...result.state_updates } : get().gameState.ledger,
                  directorDebug: result.thoughtProcess
              });
              newTurnId = newTurn.id;
              
              // Trigger media generation pipeline
              enqueueTurnForMedia(
                newTurn, 
                'Subject_84', 
                get().gameState.ledger
              );
          }

          set((state) => {
              const newLogs = [...state.logs];
              
              if (result.thoughtProcess) {
                  newLogs.push({ id: `thought-${Date.now()}`, type: 'thought', content: result.thoughtProcess });
              }
              
              if (result.narrative) {
                  newLogs.push({ 
                      id: newTurnId || `narrative-${Date.now()}`, 
                      type: 'narrative', 
                      content: result.narrative, 
                      visualContext: result.visualPrompt 
                  });
              }

              if (result.psychosisText) {
                  newLogs.push({
                      id: `psychosis-${Date.now()}`,
                      type: 'psychosis',
                      content: result.psychosisText
                  });
              }
              
              let nextKgot = state.kgot;
              if (result.updatedGraph) {
                  nextKgot = result.updatedGraph;
              }

              let nextLedger = state.gameState.ledger;
              if (result.state_updates) {
                 nextLedger = updateLedgerHelper(state.gameState.ledger, result.state_updates);
              }

              return {
                  kgot: nextKgot,
                  choices: result.choices || [],
                  logs: newLogs,
                  isThinking: false,
                  gameState: {
                      ...state.gameState,
                      ledger: nextLedger
                  }
              };
          });
      },

      applyDirectorUpdates: (response: any) => {
        // Legacy compat
        console.warn("Using legacy applyDirectorUpdates - migrate to applyServerState");
      },

      processPlayerTurn: async (input: string) => {
        const state = get();
        set({ isThinking: true });
        
        // 1. Trigger Subject Reactions (Sync Logic)
        let actionType: 'COMPLY' | 'DEFY' | 'OBSERVE' | 'SPEAK' = 'OBSERVE';
        const lower = input.toLowerCase();
        if (lower.includes('submit') || lower.includes('yes') || lower.includes('bow')) actionType = 'COMPLY';
        else if (lower.includes('resist') || lower.includes('no') || lower.includes('spit')) actionType = 'DEFY';
        else if (lower.includes('speak') || lower.includes('ask')) actionType = 'SPEAK';
        
        get().triggerSubjectReaction(actionType, input);

        try {
            const history = state.logs.filter(l => l.type === 'narrative').map(l => l.content);
            
            // 2. Initialize or Hydrate Prefect Manager
            if (prefectManager.getPrefects().length === 0) {
                 if (state.prefects.length > 0) {
                     prefectManager.loadState(state.prefects);
                 } else {
                     prefectManager.initialize(state.gameState.seed);
                 }
            }

            // 3. Simulate Prefect Turn
            const { thoughts, updatedDNA } = await prefectManager.simulateTurn(
                state.gameState, 
                history, 
                input,
                state.kgot,
                get().addLog // Pass logger for error reporting
            );
            
            // Update store with new DNA (persisting emotional shifts)
            get().updatePrefects(updatedDNA);

            // 4. Map Thoughts to Decisions for Director
            const prefectDecisions: PrefectDecision[] = thoughts.map(t => {
                let detailedAction = t.publicAction;
                if (t.sabotageAttempt) {
                    detailedAction += ` [INTERNAL SUBROUTINE: SABOTAGE Attempt against ${t.sabotageAttempt.target} via ${t.sabotageAttempt.method}]`;
                }
                if (t.allianceSignal) {
                    detailedAction += ` [INTERNAL SUBROUTINE: ALLIANCE Signal to ${t.allianceSignal.target}: "${t.allianceSignal.message}"]`;
                }

                return {
                    prefectId: t.agentId,
                    action: 'act', 
                    actionDetail: detailedAction,
                    publicUtterance: null,
                    hiddenProposal: t.hiddenMotivation,
                    targetId: t.sabotageAttempt?.target || t.allianceSignal?.target || null,
                    stateDelta: {},
                    confidence: t.emotionalState.confidence
                };
            });

            // 5. System Log for Debugging/Transparency
            if (thoughts.length > 0) {
                const agentLog = thoughts.map(t => {
                    const name = t.agentId.split('_').pop() || 'AGENT';
                    let status = "";
                    if (t.sabotageAttempt) status = `[⚠️ SABOTAGE: ${t.sabotageAttempt.target}]`;
                    else if (t.allianceSignal) status = `[🤝 ALLIANCE: ${t.allianceSignal.target}]`;
                    
                    return `${name}: "${t.hiddenMotivation.substring(0, 40)}..." ${status}`;
                }).join(' | ');

                get().addLog({
                    id: `prefect-sim-${Date.now()}`,
                    type: 'system',
                    content: `PREFECT SIMULATION :: ${agentLog}`
                });
                
                set({ lastSimulationLog: `PREFECT SIMULATION :: ${agentLog}` });
            }

            // 6. Execute Director Turn
            const result = await executeDirectorTurn(
                input, 
                history, 
                state.kgot,
                prefectDecisions 
            );

            get().applyServerState(result);
            
        } catch (e) {
            console.error("Critical Client Director Error:", e);
            set({ isThinking: false });
            get().addLog({
                id: `error-${Date.now()}`,
                type: 'system',
                content: 'CRITICAL: NEURO-SYMBOLIC DISCONNECT. RETRYING CONNECTION...'
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
          isThinking: false,
          executedCode: undefined,
          lastSimulationLog: undefined,
          lastDirectorDebug: undefined,
        });
        
        // Restart session logic
        setTimeout(() => get().startSession(), 500);
      },

      startSession: async () => {
        const state = get();
        
        // Initialize Prefects
        if (prefectManager.getPrefects().length === 0) {
            if (state.prefects.length > 0) {
                prefectManager.loadState(state.prefects);
            } else {
                prefectManager.initialize(state.gameState.seed);
                set({ prefects: prefectManager.getPrefects() });
            }
        }

        // Initialize Remedial Class
        if (Object.keys(state.subjects).length === 0) {
            state.initializeSubjects();
        }

        // Bootstrapping: Generate the opening scene via the Director if timeline is empty
        if (state.multimodalTimeline.length === 0) {
           console.log("[GameStore] Bootstrapping opening scene...");
           set({ isThinking: true });
           
           try {
               const result = await executeDirectorTurn(
                   "INITIALIZE_SIMULATION", 
                   [], 
                   state.kgot
               );
               get().applyServerState(result);
           } catch (e) {
               console.error("Failed to bootstrap session:", e);
               set({ isThinking: false });
           }
        }
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
      }),
    }
  )
);
