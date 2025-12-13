import { create } from 'zustand';
import { KnowledgeGraph } from '../lib/types/kgot';
import { submitTurn } from '../actions/submitTurn';
import { INITIAL_LEDGER } from '../constants';
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { LogEntry, CombinedGameStoreState } from '../types';
import { KGotController } from '../controllers/KGotController';

// Initial State for the KGoT
const INITIAL_GRAPH: KnowledgeGraph = {
  nodes: {
    'FACULTY_SELENE': {
      id: 'FACULTY_SELENE',
      type: 'ENTITY',
      label: 'The Provost',
      attributes: { dominance: 1.0, location: 'The High Tower' }
    },
    'FACULTY_PETRA': {
        id: 'FACULTY_PETRA',
        type: 'ENTITY',
        label: 'The Inquisitor',
        attributes: { aggression: 0.9, location: 'The Courtyard' }
    },
    'LOC_COURTYARD': {
      id: 'LOC_COURTYARD',
      type: 'LOCATION',
      label: 'The Weeping Courtyard',
      attributes: { atmosphere: 'oppressive', weather: 'rain' }
    }
  },
  edges: [],
  global_state: {
    turn_count: 0,
    tension_level: 10,
    narrative_phase: 'ACT_1'
  }
};

const INITIAL_GAME_STATE = {
    ledger: INITIAL_LEDGER,
    location: 'The Arrival Dock',
    turn: 0,
    nodes: [], // Legacy compat
    links: []  // Legacy compat
};

export const useGameStore = create<CombinedGameStoreState>((set, get, api) => ({
  gameState: INITIAL_GAME_STATE,
  // New KGoT State
  kgot: INITIAL_GRAPH,
  
  logs: [],
  choices: [],
  
  isThinking: false,
  isMenuOpen: false,
  isGrimoireOpen: false,
  isDevOverlayOpen: false,
  
  executedCode: undefined,
  lastSimulationLog: undefined,
  lastDirectorDebug: undefined,

  // Initialize multimodal slice
  ...createMultimodalSlice(set, get, api),

  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  setLogs: (logs) => set({ logs }),
  setChoices: (choices) => set({ choices }),
  setThinking: (isThinking) => set({ isThinking }),
  setMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
  setGrimoireOpen: (isGrimoireOpen) => set({ isGrimoireOpen }),
  setDevOverlayOpen: (isDevOverlayOpen) => set({ isDevOverlayOpen }),

  updateGameState: (updates) => set((state) => ({
    gameState: { ...state.gameState, ...updates }
  })),

  // Legacy compat method
  updateLogMedia: (logId, media) => set((state) => ({
    logs: state.logs.map(log => log.id === logId ? { ...log, ...media } : log)
  })),

  applyDirectorUpdates: (response) => set((state) => {
    // 1. Update Ledger
    const nextLedger = response.state_updates 
      ? updateLedgerHelper(state.gameState.ledger, response.state_updates) 
      : state.gameState.ledger;

    // 2. Update Graph (Reconcile KGoT using Controller)
    const controller = new KGotController(state.kgot);
    
    if (response.graph_updates) {
      controller.applyDelta(response.graph_updates);
    }

    const nextKgot = controller.getGraph();
    
    // Increment global turn count in KGoT
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

  // Updated Action Processor using submitTurn
  processPlayerTurn: async (input: string) => {
    const state = get();
    set({ isThinking: true });
    
    try {
        const result = await submitTurn({
            sessionId: 'session-1',
            playerAction: { type: 'INTERACT', payload: input },
            currentGraph: state.kgot
        });

        // Register new multimodal turn
        const newTurn = state.registerTurn(result.narrative, JSON.stringify(result.visuals), {
            ledgerSnapshot: state.gameState.ledger,
            directorDebug: result.thought_process
        });

        set(s => ({
            choices: result.choices,
            logs: [...s.logs, 
                { id: `thought-${Date.now()}`, type: 'thought', content: result.thought_process },
                { id: newTurn.id, type: 'narrative', content: newTurn.text }
            ],
            isThinking: false
        }));

        // Normally we would update KGoT here based on result.updatedGraph, but submitTurn returns the full graph in this mock
        // In a real delta scenario, we'd merge.
        
    } catch (e) {
        console.error(e);
        set({ isThinking: false });
    }
  },

  resetGame: () => {
    get().resetMultimodalState();
    set({
      gameState: INITIAL_GAME_STATE,
      kgot: INITIAL_GRAPH,
      logs: [],
      choices: [],
      isThinking: false,
      executedCode: undefined,
      lastSimulationLog: undefined,
      lastDirectorDebug: undefined,
    });
  },

  saveSnapshot: () => {
      // ... existing logic ...
  },
  loadSnapshot: () => {
      // ... existing logic ...
  }
}));