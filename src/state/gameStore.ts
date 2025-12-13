
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
    nodes: [], // Legacy compat
    links: []  // Legacy compat
};

// Initial Logs to display on first load
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
  // New KGoT State
  kgot: INITIAL_GRAPH,
  
  logs: INITIAL_LOGS,
  choices: ['Observe the surroundings', 'Check your restraints', 'Recall your purpose'],
  prefects: [], // Initialize empty, populated by startSession
  
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
  updatePrefects: (prefects) => set({ prefects }),

  updateGameState: (updates) => set((state) => ({
    gameState: { ...state.gameState, ...updates }
  })),

  // Legacy compat method
  updateLogMedia: (logId, media) => set((state) => ({
    logs: state.logs.map(log => log.id === logId ? { ...log, ...media } : log)
  })),

  // Handle Logic Result
  applyServerState: (result: any) => {
      // 1. Register Multimodal Turn if valid narrative exists
      let newTurnId: string | null = null;
      if (result.narrative) {
          const newTurn = get().registerTurn(result.narrative, result.visualPrompt, {
              ledgerSnapshot: result.state_updates ? { ...get().gameState.ledger, ...result.state_updates } : get().gameState.ledger,
              directorDebug: result.thoughtProcess
          });
          newTurnId = newTurn.id;
          
          // Trigger media generation
          enqueueTurnForMedia(
            newTurn, 
            'Subject_84', 
            get().gameState.ledger
          );
      }

      // 2. Update Core State
      set((state) => {
          const newLogs = [...state.logs];
          
          if (result.thoughtProcess) {
              newLogs.push({ id: `thought-${Date.now()}`, type: 'thought', content: result.thoughtProcess });
          }
          
          // Add narrative log linked to multimodal turn if possible
          if (result.narrative) {
              newLogs.push({ 
                  id: newTurnId || `narrative-${Date.now()}`, 
                  type: 'narrative', 
                  content: result.narrative, 
                  visualContext: result.visualPrompt 
              });
          }

          // Add psychosis text if present
          if (result.psychosisText) {
              newLogs.push({
                  id: `psychosis-${Date.now()}`,
                  type: 'psychosis',
                  content: result.psychosisText
              });
          }
          
          // Update KGoT if provided
          let nextKgot = state.kgot;
          if (result.updatedGraph) {
              nextKgot = result.updatedGraph;
          }

          // Update Ledger if provided
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

  // Updated Action Processor using client-side Director AND Prefect System
  processPlayerTurn: async (input: string) => {
    const state = get();
    set({ isThinking: true });
    
    try {
        const history = state.logs.filter(l => l.type === 'narrative').map(l => l.content);
        
        // 1. Run Prefect Simulation
        const { thoughts, updatedDNA } = await prefectManager.simulateTurn(
            state.gameState, 
            history, 
            input
        );
        
        // Update Prefect State in Store
        get().updatePrefects(updatedDNA);

        // Map Thoughts to Decisions for Director Consumption
        const prefectDecisions: PrefectDecision[] = thoughts.map(t => ({
            prefectId: t.agentId,
            action: 'act', // simplified for mapping
            actionDetail: t.publicAction,
            publicUtterance: null,
            hiddenProposal: t.hiddenMotivation,
            targetId: null,
            stateDelta: {},
            confidence: t.emotionalState.confidence
        }));

        // Log Prefect Thoughts for Debug
        if (thoughts.length > 0) {
            get().addLog({
                id: `prefect-sim-${Date.now()}`,
                type: 'system',
                content: `PREFECT SIMULATION: ${thoughts.map(t => `${t.agentId} plans: ${t.hiddenMotivation}`).join(' | ')}`
            });
        }

        // 2. Execute Director Logic (with Prefect Context)
        const result = await executeDirectorTurn(
            input, 
            history, 
            state.kgot,
            prefectDecisions // Pass prefect context
        );

        // 3. Apply state updates
        get().applyServerState(result);
        
    } catch (e) {
        console.error("Critical Client Director Error:", e);
        set({ isThinking: false });
        // Fallback or error log
        get().addLog({
            id: `error-${Date.now()}`,
            type: 'system',
            content: 'CRITICAL: NEURO-SYMBOLIC DISCONNECT. RETRYING CONNECTION...'
        });
    }
  },

  resetGame: () => {
    get().resetMultimodalState();
    // Re-initialize controller for fresh graph
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
    // Immediately start session after reset
    get().startSession();
  },

  saveSnapshot: () => {
      // ... existing logic ...
  },
  loadSnapshot: () => {
      // ... existing logic ...
  },

  // Bootstraps the first turn from INITIAL_LOGS to generate visuals
  startSession: () => {
    const state = get();
    
    // Initialize Prefect Manager
    prefectManager.initialize(Date.now());
    set({ prefects: prefectManager.getPrefects() });

    // Only start if timeline is empty and we have logs
    if (state.multimodalTimeline.length === 0 && state.logs.length > 0) {
       const firstNarrative = state.logs.find(l => l.type === 'narrative');
       if (firstNarrative) {
          const turn = state.registerTurn(
             firstNarrative.content, 
             "The Arrival Dock, volcanic ash, oppressed atmosphere.", 
             {
               location: "The Arrival Dock",
               tags: ['intro']
             }
          );
          // Trigger media generation
          enqueueTurnForMedia(turn, CharacterId.PLAYER, state.gameState.ledger);
       }
    }
  }
}));
