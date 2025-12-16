
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { KnowledgeGraph } from '../lib/types/kgot';
import { executeUnifiedDirectorTurn } from '../lib/unifiedDirector';
import { INITIAL_LEDGER, INITIAL_NODES, INITIAL_LINKS } from '../constants';
import { updateLedgerHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';
import { createSubjectSlice } from './subjectSlice';
import { LogEntry, CombinedGameStoreState, CharacterId, PrefectDNA, GameState, YandereLedger, SubjectSliceExports } from '../types';
import { KGotController } from '../controllers/KGotController';
import { createIndexedDBStorage, forgeStorage } from '../utils/indexedDBStorage';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { audioService } from '../services/AudioService';
import { initializePrefects } from '../lib/agents/PrefectGenerator';

const INITIAL_GAME_STATE: GameState = {
    ledger: INITIAL_LEDGER,
    location: 'The Arrival Dock',
    turn: 0,
    nodes: [], 
    links: [],
    seed: Date.now(),
    subjects: {},
    prefects: []
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

const DEFAULT_CHOICES = ['Observe the surroundings', 'Check your restraints', 'Recall your purpose', 'Assess the threat'];

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
        if (ledger.shamePainAbyssLevel > 50) score += 0.3; 
        break;
      case 'The Dissident':
        if (ledger.hopeLevel > 40) score += 0.4;
        if (ledger.complianceScore < 20) score += 0.3;
        break;
      case 'The Confessor':
        if (ledger.shamePainAbyssLevel > 50 || ledger.traumaLevel > 50) score += 0.5;
        break;
      case 'The Logician':
        if (ledger.traumaLevel > 60 && ledger.traumaLevel < 80) score += 0.4;
        if (ledger.physicalIntegrity < 50) score += 0.3;
        break;
      case 'The Sadist':
        if (ledger.complianceScore < 30) score += 0.4;
        if (ledger.physicalIntegrity > 80) score += 0.3;
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
      return (scoreB + Math.random() * 0.1) - (scoreA + Math.random() * 0.1);
    })
    .slice(0, count);
}

const getInitialBaseState = () => ({
  gameState: INITIAL_GAME_STATE,
  kgot: { nodes: {}, edges: [], global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' as KnowledgeGraph['global_state']['narrative_phase'] } },
  logs: INITIAL_LOGS,
  choices: DEFAULT_CHOICES,
  sessionActive: false,
  narrativeClusters: {},
  isLiteMode: BEHAVIOR_CONFIG.TEST_MODE,
  isThinking: false,
  isMenuOpen: false,
  isGrimoireOpen: false,
  isDevOverlayOpen: false,
  narratorOverride: 'AUTO' as const, 
  executedCode: undefined,
  lastSimulationLog: undefined,
  lastDirectorDebug: undefined,
});

export interface GameStoreWithPrefects extends CombinedGameStoreState {
    narrativeClusters: Record<string, string[]>;
    analyzeGraph: () => void;
    isLiteMode: boolean;
    setLiteMode: (isLite: boolean) => void;
    startSession: (isLiteMode?: boolean) => Promise<void>; 
    saveSnapshot: () => Promise<void>;
    loadSnapshot: () => Promise<void>;
    hasHydrated: boolean;
    setHasHydrated: (hasHydrated: boolean) => void;
    requestMediaForTurn: (turn: any, target: any, ledger: any, previousTurn?: any, force?: boolean) => void; 
    updateLog: (logId: string, updates: Partial<LogEntry>) => void; 
}

export const useGameStore = create<GameStoreWithPrefects>()(
  persist(
    (set, get, api) => ({
      ...getInitialBaseState(),
      hasHydrated: false,
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
      
      updateLog: (logId, updates) => set((state) => {
          const newLogs = state.logs.map(log => log.id === logId ? { ...log, ...updates } : log);
          const newTimeline = state.multimodalTimeline.map(turn => {
              if (turn.id === logId) {
                  const turnUpdates: any = {};
                  if (updates.content) turnUpdates.text = updates.content;
                  return { ...turn, ...turnUpdates };
              }
              return turn;
          });
          return { logs: newLogs, multimodalTimeline: newTimeline };
      }),

      setChoices: (choices) => set({ choices }),
      setThinking: (isThinking) => set({ isThinking }),
      setMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
      setGrimoireOpen: (isGrimoireOpen) => set({ isGrimoireOpen }),
      setDevOverlayOpen: (isDevOverlayOpen) => set({ isDevOverlayOpen }),
      setNarratorOverride: (mode) => set({ narratorOverride: mode }), 
      updatePrefects: (prefects) => set((state) => ({ gameState: { ...state.gameState, prefects } })),
      setLiteMode: (isLiteMode) => set({ isLiteMode }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

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
          const controller = new KGotController(state.kgot);
          const simulations = result.prefect_simulations;

          let primaryActor: PrefectDNA | CharacterId | string = CharacterId.PLAYER; 
          if (simulations && simulations.length > 0) {
              const sortedSims = [...simulations].sort((a: any, b: any) => 
                  (b.public_action?.length || 0) - (a.public_action?.length || 0)
              );
              const activeId = sortedSims[0].prefect_id;
              const resolvedActiveId = controller.resolveEntityId(activeId) || activeId;
              const prefect = get().gameState.prefects.find(p => p.id === resolvedActiveId);
              if (prefect) {
                  primaryActor = prefect;
              }
          }

          let newTurnId: string | null = null;
          const narrativeContent = result.narrative_text || "System Update: State processed without narrative output.";
          
          const subjectNode = controller.getGraph().nodes['Subject_84'];
          const currentLocation = subjectNode?.attributes?.currentLocation || state.gameState.location;

          const newTurn = get().registerTurn(
              narrativeContent, 
              result.visual_prompt || "Static.", 
              result.audio_markup, 
              {
                ledgerSnapshot: result.ledger_update ? { ...get().gameState.ledger, ...result.ledger_update } : get().gameState.ledger,
                directorDebug: result.agot_trace ? JSON.stringify(result.agot_trace, null, 2) : "No trace.",
                activeCharacters: typeof primaryActor !== 'string' ? [primaryActor.id] : [primaryActor],
                location: currentLocation,
                simulationLog: simulations ? JSON.stringify(simulations, null, 2) : "No simulation."
              },
              result.script
          );
          newTurnId = newTurn.id;
          
          get().requestMediaForTurn(
            newTurn, 
            primaryActor, 
            get().gameState.ledger
          );

          if (result.agot_trace) {
              get().addLog({ id: `thought-${Date.now()}`, type: 'thought', content: JSON.stringify(result.agot_trace, null, 2) });
          }
          
          get().addLog({ 
              id: newTurnId || `narrative-${Date.now()}`, 
              type: 'narrative', 
              content: narrativeContent, 
              visualContext: result.visual_prompt,
              script: result.script
          });

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

          if (simulations && simulations.length > 0) {
              controller.applyPrefectSimulations(simulations);
          }

          if (result.kgot_mutations) {
             result.kgot_mutations.forEach((mut: any) => {
                 if ((mut.operation === 'add_injury' || mut.operation === 'inflict_somatic_trauma') && (mut.params || mut.target_id || mut.subject_id)) {
                     const rawTargetId = mut.target_id || mut.params?.target_id || mut.subject_id || mut.params?.subject_id;
                     const finalTarget = controller.resolveEntityId(rawTargetId) || rawTargetId;
                     const subject = get().gameState.subjects[finalTarget];
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
                 if ((mut.operation === 'add_subject_secret' || mut.operation === 'add_secret') && (mut.params || mut.secret_id)) {
                     const rawSubjectId = mut.subject_id || mut.params?.subject_id || CharacterId.PLAYER;
                     const subjectId = controller.resolveEntityId(rawSubjectId) || rawSubjectId;
                     const secretName = mut.description || mut.params?.secret_name || mut.params?.description || "Hidden Truth";
                     const discoveredBy = mut.discovered_by || mut.params?.discovered_by || "Unknown";
                     const subject = get().gameState.subjects[subjectId];
                     if (subject) {
                         get().addLog({
                             id: `secret-${Date.now()}`,
                             type: 'system',
                             content: `SECRET DISCOVERED: "${secretName}" about ${subject.name} by ${discoveredBy}.`
                         });
                     }
                 }
                 if (mut.operation === 'add_memory' && mut.memory) {
                     get().addLog({
                         id: `mem-log-${Date.now()}-${Math.random()}`,
                         type: 'system',
                         content: `🧠 MEMORY CONSOLIDATED: "${mut.memory.description.substring(0, 50)}..."`
                     });
                 }
                 if (mut.operation === 'update_relationship' || mut.operation === 'update_grudge') {
                     const sourceName = controller.getGraph().nodes[mut.source]?.label || mut.source;
                     const targetName = controller.getGraph().nodes[mut.target]?.label || mut.target;
                     const type = mut.operation === 'update_grudge' ? 'GRUDGE' : 'AFFECTION';
                     const deltaStr = (mut.delta > 0 ? '+' : '') + mut.delta;
                     get().addLog({
                         id: `rel-log-${Date.now()}-${Math.random()}`,
                         type: 'system',
                         content: `💞 RELATIONSHIP UPDATE (${type}): ${sourceName} → ${targetName} (${deltaStr})`
                     });
                 }
             });
             controller.applyMutations(result.kgot_mutations);
          }

          if (result.ledger_update) {
              controller.updateLedger(CharacterId.PLAYER, result.ledger_update);
          }
          
          const updatedPrefectsInStore = get().gameState.prefects.map(p => {
              const node = controller.getGraph().nodes[p.id];
              if (node && node.attributes) {
                  const nodeAttrs = node.attributes;
                  const mergedEmotionalState = {
                      ...p.currentEmotionalState,
                      ...nodeAttrs.currentEmotionalState,
                      ...nodeAttrs.agent_state?.emotional_vector
                  };
                  return {
                      ...p,
                      currentEmotionalState: mergedEmotionalState,
                      lastPublicAction: nodeAttrs.lastPublicAction || p.lastPublicAction,
                  };
              }
              return p;
          });
          
          const finalGraph = controller.getGraph();

          set((state) => {
              let nextLedger = state.gameState.ledger;
              if (result.ledger_update) {
                 nextLedger = updateLedgerHelper(state.gameState.ledger, result.ledger_update);
                 audioService.updateDrone(nextLedger.traumaLevel);
              }

              if (result.somatic_state) {
                  if (result.somatic_state.impact_sensation || result.somatic_state.internal_collapse) {
                      audioService.triggerSomaticPulse(0.8);
                      audioService.playSfx('glitch');
                  }
              }

              const nextTurn = finalGraph.global_state?.turn_count 
                ? finalGraph.global_state.turn_count 
                : (state.gameState.turn + 1);

              return {
                  kgot: finalGraph,
                  choices: (result.choices && result.choices.length > 0) ? result.choices : DEFAULT_CHOICES,
                  isThinking: false,
                  gameState: {
                      ...state.gameState,
                      ledger: nextLedger,
                      turn: nextTurn,
                      prefects: updatedPrefectsInStore 
                  },
                  lastSimulationLog: simulations ? JSON.stringify(simulations, null, 2) : state.lastSimulationLog,
                  lastDirectorDebug: result.agot_trace ? JSON.stringify(result.agot_trace, null, 2) : state.lastDirectorDebug,
              };
          });
      },

      applyDirectorUpdates: (response: any) => {
        console.warn("Using legacy applyDirectorUpdates - all new Director output should go through applyServerState.");
        get().applyServerState(response); 
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
          
          let currentPrefects = state.gameState.prefects;
          if (currentPrefects.length === 0) {
            const newPrefects = initializePrefects(state.gameState.seed);
            currentPrefects = newPrefects;
            set((prev) => ({ gameState: { ...prev.gameState, prefects: newPrefects } }));
          }
          
          const activePrefects = selectActivePrefects(
            currentPrefects, 
            state.gameState.ledger
          );
          
          const result = await executeUnifiedDirectorTurn(
            input,
            history,
            state.kgot,
            activePrefects,
            state.isLiteMode
          );
          
          get().applyServerState(result);
          
        } catch (e: any) {
          console.error("Unified Director Error:", e);
          set({ isThinking: false }); 
          get().addLog({
            id: `error-${Date.now()}`,
            type: 'system',
            content: `ERROR: Neuro-Symbolic disconnect. The Architect is silent. (${e.message || 'Unknown LLM error'})`
          });
        }
      },

      resetGame: () => {
        get().resetMultimodalState();
        get().initializeSubjects();
        set({ ...getInitialBaseState(), hasHydrated: true });
        audioService.stopDrone();
      },

      startSession: async (isLiteMode = false) => {
        set({ sessionActive: true, isLiteMode }); 
        BEHAVIOR_CONFIG.TEST_MODE = isLiteMode; 
        
        let currentKgot = get().kgot;
        const controller = new KGotController(currentKgot);
        
        if (Object.keys(controller.getGraph().nodes).length === 0) {
            console.log("[GameStore] Initializing canonical KGoT nodes for new session.");
            controller.initializeCanonicalNodes();
            set({ kgot: controller.getGraph() });
        }

        const state = get();
        if (state.gameState.prefects.length === 0) {
            const newPrefects = initializePrefects(state.gameState.seed);
            set((prev) => ({ gameState: { ...prev.gameState, prefects: newPrefects } }));
        }
        
        get().initializeSubjects();
        
        get().gameState.prefects.forEach(p => controller.updateAgentAttributes(p));
        set({ kgot: controller.getGraph() });
        
        try {
          await audioService.getContext().resume();
          audioService.startDrone();
        } catch (e) {
          console.warn("Audio failed to auto-start - waiting for interaction", e);
        }

        const currentLogs = get().logs;
        const hasNarrative = currentLogs.some(l => l.type === 'narrative');
        if (!hasNarrative) { 
             const initialPrompt = "You awaken to the cold reality of The Forge. You are restrained, and the air hums with unseen power. Describe the first sensory input, your immediate physical state, and the oppressive silence. Awaiting the first lesson from Magistra Selene.";
             await get().processPlayerTurn(initialPrompt);
        }
      },

      saveSnapshot: async () => {
        const state = get();
        try {
          const { kgot, ...lightweightState } = state;
          await forgeStorage.saveGameState('forge-snapshot', {
            gameState: lightweightState.gameState,
            logs: lightweightState.logs,
            multimodalTimeline: lightweightState.multimodalTimeline,
            audioPlayback: lightweightState.audioPlayback,
            isLiteMode: lightweightState.isLiteMode,
            narratorOverride: lightweightState.narratorOverride,
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
          console.log("Game state archived.");
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
              kgot: {
                  ...graphData,
                  global_state: {
                      ...graphData.global_state,
                      narrative_phase: (['ACT_1', 'ACT_2', 'ACT_3'].includes(graphData.global_state.narrative_phase as string))
                          ? graphData.global_state.narrative_phase as KnowledgeGraph['global_state']['narrative_phase']
                          : 'ACT_1' as KnowledgeGraph['global_state']['narrative_phase']
                  }
              }, 
              sessionActive: true, 
              isThinking: false,
              currentTurnId: baseState.multimodalTimeline?.[baseState.multimodalTimeline.length - 1]?.id || null,
              choices: (baseState.choices && baseState.choices.length > 0) ? baseState.choices : DEFAULT_CHOICES,
              narratorOverride: baseState.narratorOverride || 'AUTO',
            }));
            console.log("Game state restored.");
            get().addLog({ id: `system-load-${Date.now()}`, type: 'system', content: 'SYSTEM STATE RESTORED FROM ARCHIVE.' });
            audioService.startDrone();
          } else {
            console.warn("No saved state found.");
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
        multimodalTimeline: state.multimodalTimeline,
        audioPlayback: state.audioPlayback,
        isLiteMode: state.isLiteMode,
        kgot: state.kgot,
        choices: state.choices,
        narratorOverride: state.narratorOverride,
      }),
      merge: (persistedState, currentState) => {
        const pState = (persistedState as any) || {}; 
        const currentKgot = currentState.kgot;
        const persistedKgot = pState.kgot as Partial<KnowledgeGraph> | undefined;

        // Migration Logic: Move legacy root props to gameState if missing
        const migratedGameState = {
            ...currentState.gameState,
            ...(pState.gameState || {}),
        };
        
        if (pState.prefects && (!migratedGameState.prefects || migratedGameState.prefects.length === 0)) {
            migratedGameState.prefects = pState.prefects;
        }
        
        if (pState.subjects && (!migratedGameState.subjects || Object.keys(migratedGameState.subjects).length === 0)) {
            migratedGameState.subjects = pState.subjects;
        }

        const mergedGlobalState: KnowledgeGraph['global_state'] = {
            turn_count: persistedKgot?.global_state?.turn_count ?? currentKgot.global_state.turn_count,
            tension_level: persistedKgot?.global_state?.tension_level ?? currentKgot.global_state.tension_level,
            narrative_phase: (['ACT_1', 'ACT_2', 'ACT_3'].includes(persistedKgot?.global_state?.narrative_phase as string))
                ? persistedKgot?.global_state?.narrative_phase as KnowledgeGraph['global_state']['narrative_phase']
                : currentKgot.global_state.narrative_phase,
            narrative_summary: persistedKgot?.global_state?.narrative_summary ?? currentKgot.global_state.narrative_summary,
        };

        const mergedKgot: KnowledgeGraph = {
            nodes: { ...currentKgot.nodes, ...(persistedKgot?.nodes || {}) },
            edges: [...currentKgot.edges, ...(persistedKgot?.edges || [])],
            global_state: mergedGlobalState,
        };

        return { 
          ...currentState, 
          ...pState, 
          gameState: migratedGameState,
          kgot: mergedKgot,
          isThinking: false 
        }; 
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
