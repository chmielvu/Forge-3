
import { create } from 'zustand';
import { KnowledgeGraph } from '../lib/types/kgot';
import { submitTurn } from '../actions/submitTurn';
import { INITIAL_LEDGER } from '../constants';
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { LogEntry, CombinedGameStoreState } from '../types';
import { KGotController } from '../controllers/KGotController';

// Initialize the Controller to get the canonical graph
const controller = new KGotController({ nodes: {}, edges: [], global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } });
const INITIAL_GRAPH: KnowledgeGraph = controller.getGraph();

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

  // NEW: Handle Server Action Result directly
  applyServerState: (result: any) => set((state) => {
      const newLogs = [...state.logs];
      if (result.thoughtProcess) {
          newLogs.push({ id: `thought-${Date.now()}`, type: 'thought', content: result.thoughtProcess });
      }
      if (result.narrative) {
          newLogs.push({ id: `narrative-${Date.now()}`, type: 'narrative', content: result.narrative, visualContext: result.visualPrompt });
      }
      
      // Update KGoT if provided
      let nextKgot = state.kgot;
      if (result.updatedGraph) {
          // Could invoke KGotController here if reconciliation needed, 
          // but if server sends full graph, we can replace.
          nextKgot = result.updatedGraph;
      }

      return {
          kgot: nextKgot,
          choices: result.choices || [],
          logs: newLogs,
          isThinking: false
      };
  }),

  applyDirectorUpdates: (response) => set((state) => {
    // 1. Update Ledger (Standard Game State)
    const nextLedger = response.state_updates 
      ? updateLedgerHelper(state.gameState.ledger, response.state_updates) 
      : state.gameState.ledger;

    // 2. Update Graph (Reconcile KGoT using Controller)
    const controller = new KGotController(state.kgot);
    
    // Sync ledger to KGoT node if player node exists
    if (state.kgot.nodes['Subject_84']) {
        controller.updateLedger('Subject_84', nextLedger);
    }
    
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

        if (result.updatedGraph) {
           set({ kgot: result.updatedGraph });
        }
        
    } catch (e) {
        console.error(e);
        set({ isThinking: false });
    }
  },

  resetGame: () => {
    get().resetMultimodalState();
    // Re-initialize controller for fresh graph
    const freshController = new KGotController({ nodes: {}, edges: [], global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } });
    
    set({
      gameState: INITIAL_GAME_STATE,
      kgot: freshController.getGraph(),
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
