
import { create } from 'zustand';
import { KnowledgeGraph } from '../lib/types/kgot';
import { executeDirectorTurn } from '../lib/director';
import { INITIAL_LEDGER } from '../constants';
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { LogEntry, CombinedGameStoreState, CharacterId, PrefectDNA, PrefectDecision } from '../types';
import { KGotController } from '../controllers/KGotController';
import { enqueueTurnForMedia } from './mediaController';
import { prefectManager } from '../services/prefectManager';

// Initialize the Controller to get the canonical graph
const controller = new KGotController({ nodes: {}, edges: [], global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } });
const INITIAL_GRAPH: KnowledgeGraph = controller.getGraph();

const INITIAL_GAME_STATE = {
    ledger: INITIAL_LEDGER,
    location: 'The Arrival Dock',
    turn: 0,
    nodes: [], 
    links: []  
};

const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'system-init',
    type: 'system',
    content: 'NEURO-SYMBOLIC ENGINE INITIALIZED. CONNECTING TO THE LOOM...'
  },
  {
    id: 'narrative-start',
    type: 'narrative',
    content: 'The air is thick with humidity, smelling of volcanic ash and old fear. You stand at the precipice of The Forge. The silence is not empty; it is waiting.'
  }
];

export interface GameStoreWithPrefects extends CombinedGameStoreState {
    prefects: PrefectDNA[];
    updatePrefects: (prefects: PrefectDNA[]) => void;
}

export const useGameStore = create<GameStoreWithPrefects>((set, get, api) => ({
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
      let newTurnId: string | null = null;
      if (result.narrative) {
          const newTurn = get().registerTurn(result.narrative, result.visualPrompt, {
              ledgerSnapshot: result.state_updates ? { ...get().gameState.ledger, ...result.state_updates } : get().gameState.ledger,
              directorDebug: result.thoughtProcess
          });
          newTurnId = newTurn.id;
          
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

  applyDirectorUpdates: (response) => set((state) => {
    const nextLedger = response.state_updates 
      ? updateLedgerHelper(state.gameState.ledger, response.state_updates) 
      : state.gameState.ledger;

    const controller = new KGotController(state.kgot);
    
    if (state.kgot.nodes['Subject_84']) {
        controller.updateLedger('Subject_84', nextLedger);
    }
    
    if (response.graph_updates) {
      controller.applyDelta(response.graph_updates);
    }

    const nextKgot = controller.getGraph();
    nextKgot.global_state.turn_count = (state.kgot.global_state.turn_count || 0) + 1;

    return {
      gameState: {
        ...state.gameState,
        ledger: nextLedger,
        turn: state.gameState.turn + 1
      },
      kgot: nextKgot,
      executedCode: response.executed_code,
      lastSimulationLog: response.simulationLog,
      lastDirectorDebug: response.debugTrace || response.thought_process
    };
  }),

  processPlayerTurn: async (input: string) => {
    const state = get();
    set({ isThinking: true });
    
    try {
        const history = state.logs.filter(l => l.type === 'narrative').map(l => l.content);
        
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
    
    set({
      gameState: INITIAL_GAME_STATE,
      kgot: freshController.getGraph(),
      logs: INITIAL_LOGS,
      choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
      prefects: [],
      isThinking: false,
      executedCode: undefined,
      lastSimulationLog: undefined,
      lastDirectorDebug: undefined,
    });
    get().startSession();
  },

  startSession: () => {
    const state = get();
    
    // Always init prefects if missing
    if (state.prefects.length === 0) {
        prefectManager.initialize(Date.now());
        set({ prefects: prefectManager.getPrefects() });
    }

    // Attempt to register first turn if timeline is empty
    if (state.multimodalTimeline.length === 0) {
       const firstNarrative = state.logs.find(l => l.type === 'narrative');
       
       if (firstNarrative) {
          const turn = state.registerTurn(
             firstNarrative.content, 
             "The Arrival Dock, volcanic ash, oppressed atmosphere.", 
             {
               location: "The Arrival Dock",
               tags: ['intro'],
               ledgerSnapshot: state.gameState.ledger
             }
          );
          enqueueTurnForMedia(turn, CharacterId.PLAYER, state.gameState.ledger, undefined, true);
       } else {
           // Fallback if logs are mysteriously empty or malformed
           console.warn("[GameStore] No narrative logs found for startSession. Forcing init.");
           const fallbackContent = 'The air is thick with humidity... (Recovery Mode)';
           const turn = state.registerTurn(
               fallbackContent,
               "The Arrival Dock (Recovery)",
               { location: "The Arrival Dock" }
           );
           enqueueTurnForMedia(turn, CharacterId.PLAYER, state.gameState.ledger, undefined, true);
       }
    }
  }
}));
