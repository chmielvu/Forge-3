import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { KnowledgeGraph } from '../lib/types/kgot';
import { executeDirectorTurn } from '../lib/director';
import { INITIAL_LEDGER } from '../constants';
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { LogEntry, CombinedGameStoreState, CharacterId, PrefectDNA, PrefectDecision, GameState } from '../types';
import { KGotController } from '../controllers/KGotController';
import { enqueueTurnForMedia } from './mediaController';
import { prefectManager } from '../services/prefectManager';

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

      applyDirectorUpdates: (response) => {
        // Legacy compat
        console.warn("Using legacy applyDirectorUpdates - migrate to applyServerState");
      },

      processPlayerTurn: async (input: string) => {
        const state = get();
        set({ isThinking: true });
        
        try {
            const history = state.logs.filter(l => l.type === 'narrative').map(l => l.content);
            
            // Re-sync prefect manager with current state if needed
            if (prefectManager.getPrefects().length === 0 && state.prefects.length > 0) {
                 prefectManager.initialize(state.gameState.seed);
            }

            const { thoughts, updatedDNA } = await prefectManager.simulateTurn(
                state.gameState, 
                history, 
                input
            );
            
            get().updatePrefects(updatedDNA);

            const prefectDecisions: PrefectDecision[] = thoughts.map(t => ({
                prefectId: t.agentId,
                action: 'act', 
                actionDetail: t.publicAction,
                publicUtterance: null,
                hiddenProposal: t.hiddenMotivation,
                targetId: null,
                stateDelta: {},
                confidence: t.emotionalState.confidence
            }));

            if (thoughts.length > 0) {
                get().addLog({
                    id: `prefect-sim-${Date.now()}`,
                    type: 'system',
                    content: `PREFECT SIMULATION: ${thoughts.map(t => `${t.agentId} plans: ${t.hiddenMotivation}`).join(' | ')}`
                });
            }

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
            prefectManager.initialize(state.gameState.seed);
            set({ prefects: prefectManager.getPrefects() });
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        gameState: state.gameState,
        kgot: state.kgot,
        prefects: state.prefects,
      }),
    }
  )
);
