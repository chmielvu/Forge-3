
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
          // 1. Identify Primary Actor for Visualization
          // Try to find which prefect was most active in the simulation results
          let primaryActor: PrefectDNA | CharacterId | string = CharacterId.PLAYER; // Default to player/POV
          
          if (result.prefectSimulations && result.prefectSimulations.length > 0) {
              // Heuristic: Pick the prefect with the longest public action text, assuming they are the focus
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
              const newTurn = get().registerTurn(result.narrative, result.visualPrompt, {
                  ledgerSnapshot: result.state_updates ? { ...get().gameState.ledger, ...result.state_updates } : get().gameState.ledger,
                  directorDebug: result.thoughtProcess,
                  activeCharacters: typeof primaryActor !== 'string' ? [primaryActor.id] : [primaryActor]
              });
              newTurnId = newTurn.id;
              
              // Trigger media generation pipeline
              enqueueTurnForMedia(
                newTurn, 
                primaryActor, 
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
        
        // 1. Trigger Subject Reactions (client-side, instant)
        let actionType: 'COMPLY' | 'DEFY' | 'OBSERVE' | 'SPEAK' = 'OBSERVE';
        const lower = input.toLowerCase();
        if (lower.includes('submit') || lower.includes('yes')) actionType = 'COMPLY';
        else if (lower.includes('resist') || lower.includes('no')) actionType = 'DEFY';
        else if (lower.includes('speak') || lower.includes('ask')) actionType = 'SPEAK';
        
        get().triggerSubjectReaction(actionType, input);
        
        try {
          const history = state.logs.filter(l => l.type === 'narrative').map(l => l.content);
          
          // 2. Initialize prefects if needed
          let currentPrefects = state.prefects;
          if (currentPrefects.length === 0) {
            // Initialize from prefectManager logic or generate new
            const { initializePrefects } = await import('../lib/agents/PrefectGenerator');
            currentPrefects = initializePrefects(state.gameState.seed);
            set({ prefects: currentPrefects });
          }
          
          // 3. Select 2-3 active prefects (client-side logic, no API calls)
          const activePrefects = selectActivePrefects(
            currentPrefects, 
            state.gameState.ledger, 
            2 // Reduce to 2 for faster inference
          );
          
          // 4. SINGLE API CALL - Unified Director handles everything
          const result = await executeUnifiedDirectorTurn(
            input,
            history,
            state.kgot,
            activePrefects
          );
          
          // 5. Process prefect simulation results (update DNA state)
          if (result.prefectSimulations && result.prefectSimulations.length > 0) {
            const updatedPrefects = [...state.prefects];
            
            result.prefectSimulations.forEach((sim: any) => {
              const prefectIndex = updatedPrefects.findIndex(p => p.id === sim.prefect_id);
              if (prefectIndex !== -1) {
                const prefect = updatedPrefects[prefectIndex];
                
                // Update state from simulation
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
                  ].slice(-10); // Keep last 10
                }
                
                // Handle sabotage/alliance (update relationships)
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
            
            // Create a system log showing prefect simulation summary
            const simLog = result.prefectSimulations
              .map((s: any) => `${s.prefect_name}: "${s.hidden_motivation.substring(0, 40)}..."`)
              .join(' | ');
            
            get().addLog({
              id: `sim-${Date.now()}`,
              type: 'system',
              content: `PREFECT SIMULATION :: ${simLog}`
            });
          }
          
          // 6. Apply the rest of the result (same as before)
          get().applyServerState(result);
          
        } catch (e) {
          console.error("Unified Director Error:", e);
          set({ isThinking: false });
          get().addLog({
            id: `error-${Date.now()}`,
            type: 'system',
            content: 'ERROR: Neuro-Symbolic disconnect. Retrying...'
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
        
        // Initialize Prefects if needed
        if (state.prefects.length === 0) {
            const { initializePrefects } = await import('../lib/agents/PrefectGenerator');
            const newPrefects = initializePrefects(state.gameState.seed);
            set({ prefects: newPrefects });
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
               const result = await executeUnifiedDirectorTurn(
                   "INITIALIZE_SIMULATION", 
                   [], 
                   state.kgot,
                   [] // No active prefects for intro
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
