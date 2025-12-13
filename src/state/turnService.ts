
import { LogEntry, CharacterId } from '../types';
import { generateNextTurn } from '../services/geminiService';
import { useGameStore } from './gameStore';
import { enqueueTurnForMedia, preloadUpcomingMedia } from './mediaController';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { visualCoherenceEngine } from '../services/visualCoherenceEngine'; // Import coherence engine

export const turnService = {
  
  /**
   * Initializes the game with the intro sequence
   */
  initGame: async () => {
    const store = useGameStore.getState();
    if (store.multimodalTimeline.length > 0) return; // Already initialized if timeline exists

    // Reset visual coherence engine for a new game
    visualCoherenceEngine.reset();

    const initialNarrative = 'The volcanic ash tastes like copper on your tongue. You stand on the Weeping Dock, the black stone slick with humidity. Ahead, the monolithic gates of The Forge loom, carved from ancient basalt. A woman in crimson velvet robes waits. Provost Selene. She holds a goblet of wine, her gaze dissecting you before you have taken a single step. The silence is heavy, broken only by the distant rhythmic pounding of the magma hammers deep beneath the earth. Your wrists chafe against the cold iron cuffs.';
    const initVisualPrompt = "Magistra Selene standing on the Weeping Dock, black volcanic rock, crimson velvet robes, holding wine goblet, stormy sky, cinematic lighting, highly detailed, baroque brutalism.";
    
    // Register the initial narrative as the first multimodal turn
    const initialTurn = store.registerTurn(initialNarrative, initVisualPrompt, {
        ledgerSnapshot: store.gameState.ledger,
        activeCharacters: [CharacterId.PROVOST, CharacterId.PLAYER], // Indicate active characters
        location: 'The Weeping Dock',
        tags: ['introduction', 'arrival']
    });

    // Record the initial turn in the coherence engine
    visualCoherenceEngine.recordTurn(initialTurn);

    const initialChoices = [
      "Bow your head and approach silently.",
      "Meet her gaze with defiance.",
      "Scan the environment for escape routes."
    ];

    // Add narrative to legacy logs for current UI compatibility
    store.addLog({ 
        id: initialTurn.id, 
        type: 'narrative', 
        content: initialTurn.text,
        visualContext: initialTurn.visualPrompt
    });
    store.setChoices(initialChoices);

    // Enqueue media generation for the initial turn
    // Pass target (Provost Selene) and previousTurn (none for first turn)
    enqueueTurnForMedia(initialTurn, CharacterId.PROVOST, store.gameState.ledger);
  },

  /**
   * Handles a player action choice
   */
  handleAction: async (action: string) => {
    const store = useGameStore.getState();
    
    // 1. UI Updates
    store.setChoices([]);
    store.setThinking(true);
    
    // 2. Add System Log (for legacy logs display)
    const actionLogId = `sys-action-${Date.now()}`;
    const actionLog: LogEntry = {
      id: actionLogId,
      type: 'system',
      content: `> SELECTION: ${action.toUpperCase()}`
    };
    store.addLog(actionLog);

    // 3. Call AI Service
    const historyText = store.logs
      .filter(l => l.type === 'narrative')
      .map(l => l.content);
      
    // Introduce artificial delay for "thinking" feel
    if (BEHAVIOR_CONFIG.GAMEPLAY.TURN_DELAY_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, BEHAVIOR_CONFIG.GAMEPLAY.TURN_DELAY_MS));
    }

    const response = await generateNextTurn(historyText, store.gameState, action);

    // 4. Update Store with Response
    store.setThinking(false);
    store.applyDirectorUpdates(response); // Applies ledger/graph updates, updates turn count, sets debug logs
    
    // Get the previous turn for coherence engine
    const previousTurn = store.multimodalTimeline.find(t => t.id === store.currentTurnId);

    // 5. Register new multimodal turn and enqueue media
    const newMultimodalTurn = store.registerTurn(response.narrative, response.visual_prompt, {
        ledgerSnapshot: store.gameState.ledger,
        activeCharacters: [CharacterId.PROVOST, CharacterId.PLAYER], // TODO: Extract from DirectorResponse if available
        location: store.gameState.location,
        tags: [], // TODO: Extract from DirectorResponse if available
        simulationLog: response.simulationLog,
        directorDebug: response.debugTrace
    });

    // Record the new turn in the coherence engine
    visualCoherenceEngine.recordTurn(newMultimodalTurn);

    // Add narrative to legacy logs for current UI compatibility, linking it to the multimodal turn ID
    store.addLog({ 
        id: newMultimodalTurn.id, 
        type: 'thought', 
        content: response.thought_process 
    });
    store.addLog({ 
        id: newMultimodalTurn.id, 
        type: 'narrative', 
        content: newMultimodalTurn.text,
        visualContext: newMultimodalTurn.visualPrompt
    });

    store.setChoices(response.choices);
    
    // Enqueue media for the new turn, passing target (Provost Selene) and the *previous* turn
    // Defaulting to Provost/Player for now as target extraction is complex
    enqueueTurnForMedia(newMultimodalTurn, CharacterId.PROVOST, store.gameState.ledger, previousTurn);

    // Preload upcoming media if needed
    preloadUpcomingMedia(newMultimodalTurn.id, 2); // Preload next 2 turns
  },

  /**
   * Replays the entire multimodal timeline from the beginning.
   * @param {boolean} autoAdvance Automatically advances through turns.
   */
  replayTimeline: async (autoAdvance: boolean = true) => {
    const store = useGameStore.getState();
    store.pauseAudio();
    store.resetMultimodalState(); // Clear current timeline and playback state
    store.resetGame(); // Reset game state but keep media controller active

    // Reset visual coherence engine for replay
    visualCoherenceEngine.reset();

    // Re-initialize the game to build the timeline
    await turnService.initGame();

    // The logic to "replay" an existing timeline would require saving
    // the Director's full responses for each turn and re-applying them.
    // For now, this effectively restarts the game and generates new media.

    if (autoAdvance) {
      store.toggleAutoAdvance(); // Ensure auto-advance is on
    }
    // Automatically play the first turn (after it's ready)
    const firstTurn = store.multimodalTimeline[0];
    if (firstTurn) {
      const unsubscribe = useGameStore.subscribe((state) => {
        const t = state.multimodalTimeline.find(t => t.id === firstTurn.id);
        const audioStatus = t?.audioStatus;
        if (audioStatus === 'ready') {
          store.playTurn(firstTurn.id);
          unsubscribe();
        }
      });
    }
  },
};
