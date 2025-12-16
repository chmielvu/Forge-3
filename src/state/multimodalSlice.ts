
import { StateCreator } from 'zustand';
import {
  MultimodalTurn,
  MediaStatus,
  MediaQueueItem,
  CombinedGameStoreState,
  MultimodalSliceExports,
  ScriptItem
} from '../types';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { INITIAL_LEDGER } from '@/constants';
import { audioService } from '../services/AudioService';

// Helper to generate a unique ID
const generateId = () => `mm_turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const createMultimodalSlice: StateCreator<
  CombinedGameStoreState,
  [],
  [],
  MultimodalSliceExports 
> = (set, get) => ({
  multimodalTimeline: [],
  currentTurnId: null,
  mediaQueue: {
    pending: [],
    inProgress: [],
    failed: [],
  },
  audioPlayback: {
    currentPlayingTurnId: null,
    isPlaying: false,
    volume: 0.7, // Default volume
    playbackRate: 1.0,
    autoAdvance: false,
    hasUserInteraction: false, // Must be true for browser autoplay
  },

  registerTurn: (text, visualPrompt, audioMarkup, metadata, script) => {
    // Access root state and safely drill down to gameState
    const state = get(); 
    // Fallback to INITIAL_LEDGER if ledger is not yet ready to prevent undefined access
    const currentLedger = state.gameState?.ledger || INITIAL_LEDGER; 
    const currentLocation = state.gameState?.location || "Unknown";

    const newTurnIndex = state.multimodalTimeline.length;
    const newTurn: MultimodalTurn = {
      id: generateId(),
      turnIndex: newTurnIndex,
      text,
      script, // NEW: Store the script
      visualPrompt,
      // Updated to use strict MediaStatus enum members
      imageStatus: MediaStatus.idle,
      audioStatus: MediaStatus.idle,
      videoStatus: MediaStatus.idle,
      metadata: {
        ledgerSnapshot: metadata?.ledgerSnapshot || { ...currentLedger },
        activeCharacters: metadata?.activeCharacters || [],
        location: metadata?.location || currentLocation,
        tags: metadata?.tags || [],
        simulationLog: metadata?.simulationLog,
        directorDebug: metadata?.directorDebug,
        audioMarkup: audioMarkup || undefined,
      },
    };
    set((state) => ({
      multimodalTimeline: [...state.multimodalTimeline, newTurn],
      currentTurnId: newTurn.id, // Automatically set new turn as current
    }));
    return newTurn;
  },

  setCurrentTurn: (turnId) => {
    const turn = get().multimodalTimeline.find((t) => t.id === turnId);
    if (turn) {
      set({ currentTurnId: turnId });
      // If audio is playing and we switch turn, pause it
      if (get().audioPlayback.currentPlayingTurnId !== turnId && get().audioPlayback.isPlaying) {
        get().pauseAudio();
      }
    } else {
      console.warn(`Attempted to set current turn to non-existent ID: ${turnId}`);
    }
  },

  goToNextTurn: () => {
    const { currentTurnId, multimodalTimeline } = get();
    if (!currentTurnId) return;
    const currentIndex = multimodalTimeline.findIndex((t) => t.id === currentTurnId);
    if (currentIndex !== -1 && currentIndex < multimodalTimeline.length - 1) {
      get().setCurrentTurn(multimodalTimeline[currentIndex + 1].id);
    }
  },

  goToPreviousTurn: () => {
    const { currentTurnId, multimodalTimeline } = get();
    if (!currentTurnId) return;
    const currentIndex = multimodalTimeline.findIndex((t) => t.id === currentTurnId);
    if (currentIndex > 0) {
      get().setCurrentTurn(multimodalTimeline[currentIndex - 1].id);
    }
  },

  getTurnById: (turnId) => {
    return get().multimodalTimeline.find((t) => t.id === turnId);
  },

  getTimelineStats: () => {
    const { multimodalTimeline, mediaQueue } = get();
    const totalTurns = multimodalTimeline.length;
    const loadedTurns = multimodalTimeline.filter(
      (t) => t.imageStatus === MediaStatus.ready && t.audioStatus === MediaStatus.ready && t.videoStatus !== MediaStatus.pending
    ).length;
    const pendingMedia = mediaQueue.pending.length + mediaQueue.inProgress.length;
    const failedMedia = mediaQueue.failed.length;
    const completionRate = totalTurns > 0 ? (loadedTurns / totalTurns) * 100 : 0;
    return { totalTurns, loadedTurns, pendingMedia, failedMedia, completionRate };
  },

  pruneOldTurns: (keepCount) => {
    set((state) => ({
      multimodalTimeline: state.multimodalTimeline.slice(-keepCount),
    }));
  },

  enqueueMediaForTurn: (item) => {
    set((state) => {
      // Avoid duplicate enqueues for the same turnId and type
      const alreadyPending = state.mediaQueue.pending.some(
        (q) => q.turnId === item.turnId && q.type === item.type
      );
      const alreadyInProgress = state.mediaQueue.inProgress.some(
        (q) => q.turnId === item.turnId && q.type === item.type
      );
      if (alreadyPending || alreadyInProgress) {
        if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MultimodalSlice] Skipping duplicate enqueue for ${item.type} on turn ${item.turnId}`);
        return state;
      }
      return {
        mediaQueue: {
          ...state.mediaQueue,
          pending: [...state.mediaQueue.pending, { ...item, addedAt: Date.now(), retries: 0 }],
        },
      };
    });
  },

  markMediaPending: (item) => {
    set((state) => ({
      mediaQueue: {
        ...state.mediaQueue,
        pending: state.mediaQueue.pending.filter(
          (q) => !(q.turnId === item.turnId && q.type === item.type)
        ),
        inProgress: [...state.mediaQueue.inProgress, item],
      },
      multimodalTimeline: state.multimodalTimeline.map((turn) =>
        turn.id === item.turnId
          ? { ...turn, [`${item.type}Status`]: MediaStatus.inProgress } // Use strict Enum
          : turn
      ),
    }));
  },

  markMediaReady: (turnId, type, dataUrl, duration, alignment) => {
    set((state) => ({
      mediaQueue: {
        ...state.mediaQueue,
        inProgress: state.mediaQueue.inProgress.filter(
          (q) => !(q.turnId === turnId && q.type === type)
        ),
      },
      multimodalTimeline: state.multimodalTimeline.map((turn) => {
        if (turn.id === turnId) {
          const update: Partial<MultimodalTurn> = { [`${type}Status`]: MediaStatus.ready }; // Use strict Enum
          if (type === 'image') update.imageData = dataUrl;
          if (type === 'audio') {
            update.audioUrl = dataUrl;
            update.audioDuration = duration;
            if (alignment) update.audioAlignment = alignment;
          }
          if (type === 'video') update.videoUrl = dataUrl;
          return { ...turn, ...update };
        }
        return turn;
      }),
    }));
  },

  markMediaError: (turnId, type, errorMessage) => {
    set((state) => {
      const item = state.mediaQueue.inProgress.find((q) => q.turnId === turnId && q.type === type);
      const newFailed = item ? [...state.mediaQueue.failed, { ...item, errorMessage }] : state.mediaQueue.failed;
      return {
        mediaQueue: {
          ...state.mediaQueue,
          inProgress: state.mediaQueue.inProgress.filter(
            (q) => !(q.turnId === turnId && q.type === type)
          ),
          failed: newFailed,
        },
        multimodalTimeline: state.multimodalTimeline.map((turn) =>
          turn.id === turnId
            ? { ...turn, [`${type}Status`]: MediaStatus.error, [`${type}Error`]: errorMessage } // Use strict Enum
            : turn
        ),
      };
    });
  },

  removeMediaFromQueue: (item) => {
    set((state) => ({
      mediaQueue: {
        pending: state.mediaQueue.pending.filter((q) => q.turnId !== item.turnId || q.type !== item.type),
        inProgress: state.mediaQueue.inProgress.filter((q) => q.turnId !== item.turnId || q.type !== item.type),
        failed: state.mediaQueue.failed.filter((q) => q.turnId !== item.turnId || q.type !== item.type),
      },
    }));
  },

  retryFailedMedia: (turnId, type) => {
    set((state) => {
      const failedItems = state.mediaQueue.failed.filter((q) => q.turnId === turnId && (!type || q.type === type));
      if (failedItems.length === 0) return state;

      const newPending: MediaQueueItem[] = [];
      const newFailed = state.mediaQueue.failed.filter((q) => {
        if (q.turnId === turnId && (!type || q.type === type)) {
          if ((q.retries || 0) < BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.MAX_MEDIA_QUEUE_RETRIES) {
            newPending.push({ ...q, retries: (q.retries || 0) + 1, addedAt: Date.now() });
            return false; // Remove from failed, add to pending
          }
          return true; // Keep in failed if max retries reached
        }
        return true;
      });

      // Reset status in timeline for retried items
      const newTimeline = state.multimodalTimeline.map((turn) => {
        if (turn.id === turnId) {
          const updatedTurn = { ...turn };
          failedItems.forEach(item => {
            if (!type || item.type === type) {
              updatedTurn[`${item.type}Status`] = MediaStatus.idle; // Reset to IDLE for retry
              delete updatedTurn[`${item.type}Error`]; // Clear error message
            }
          });
          return updatedTurn;
        }
        return turn;
      });

      return {
        mediaQueue: {
          ...state.mediaQueue,
          pending: [...state.mediaQueue.pending, ...newPending],
          failed: newFailed,
        },
        multimodalTimeline: newTimeline,
      };
    });
  },

  playTurn: async (turnId) => {
    const { multimodalTimeline, setHasUserInteraction } = get();
    const turn = multimodalTimeline.find((t) => t.id === turnId);

    if (!turn || turn.audioStatus !== MediaStatus.ready || !turn.audioUrl) {
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn(`[MultimodalSlice] Cannot play turn ${turnId}: not ready or no audioUrl.`);
      return;
    }

    setHasUserInteraction();

    set((state) => ({
      audioPlayback: { ...state.audioPlayback, isPlaying: true, currentPlayingTurnId: turnId },
    }));

    await audioService.play(
      turn.audioUrl,
      get().audioPlayback.volume,
      get().audioPlayback.playbackRate,
      () => {
        const { audioPlayback: ap, multimodalTimeline: currentTimeline } = get();
        if (ap.autoAdvance) {
          const currentIndex = currentTimeline.findIndex(t => t.id === turnId);
          if (currentIndex !== -1 && currentIndex < currentTimeline.length - 1) {
            const nextTurn = currentTimeline[currentIndex + 1];
            window.setTimeout(() => {
              get().setCurrentTurn(nextTurn.id);
              get().playTurn(nextTurn.id);
            }, 100);
            return;
          }
        }
        set((state) => ({
          audioPlayback: { ...state.audioPlayback, isPlaying: false },
        }));
      }
    );
  },

  pauseAudio: () => {
    audioService.pause();
    set((state) => ({
      audioPlayback: { ...state.audioPlayback, isPlaying: false },
    }));
  },

  resumeAudio: () => {
    const { currentPlayingTurnId } = get().audioPlayback;
    if (currentPlayingTurnId) {
        get().playTurn(currentPlayingTurnId);
    }
  },

  seekAudio: (time) => {
    console.warn("[MultimodalSlice] Audio seeking is not supported with the current stateless architecture.");
  },

  setVolume: (volume) => {
    audioService.setVolume(volume);
    set((state) => ({
      audioPlayback: { ...state.audioPlayback, volume },
    }));
  },

  setPlaybackRate: (rate) => {
    audioService.setPlaybackRate(rate);
    set((state) => ({
      audioPlayback: { ...state.audioPlayback, playbackRate: rate },
    }));
  },

  toggleAutoAdvance: () => {
    set((state) => ({
      audioPlayback: { ...state.audioPlayback, autoAdvance: !state.audioPlayback.autoAdvance },
    }));
  },

  setHasUserInteraction: () => {
    set((state) => ({
      audioPlayback: { ...state.audioPlayback, hasUserInteraction: true },
    }));
  },

  getCoherenceReport: (turnId) => {
    const turn = get().multimodalTimeline.find((t) => t.id === turnId);
    if (!turn) {
      return {
        hasText: false,
        hasImage: false,
        hasAudio: false,
        hasVideo: false,
        isFullyLoaded: false,
        hasErrors: false,
        completionPercentage: 0,
      };
    }

    const hasText = !!turn.text;
    const hasImage = turn.imageStatus === MediaStatus.ready && !!turn.imageData;
    const hasAudio = turn.audioStatus === MediaStatus.ready && !!turn.audioUrl;
    const hasVideo = turn.videoStatus === MediaStatus.ready && !!turn.videoUrl;

    const totalModalities = 4;
    let loadedModalities = 0;
    if (hasText) loadedModalities++;
    if (hasImage) loadedModalities++;
    if (hasAudio) loadedModalities++;
    if (hasVideo) loadedModalities++;

    const isFullyLoaded = hasText && hasImage && hasAudio && hasVideo;
    const hasErrors = turn.imageStatus === MediaStatus.error || turn.audioStatus === MediaStatus.error || turn.videoStatus === MediaStatus.error;
    const completionPercentage = (loadedModalities / totalModalities) * 100;

    return {
      hasText,
      hasImage,
      hasAudio,
      hasVideo,
      isFullyLoaded,
      hasErrors,
      completionPercentage,
    };
  },

  resetMultimodalState: () => {
    // Explicitly stop audio service to prevent ghosts
    audioService.stop();

    set({
      multimodalTimeline: [],
      currentTurnId: null,
      mediaQueue: {
        pending: [],
        inProgress: [],
        failed: [],
      },
      audioPlayback: {
        currentPlayingTurnId: null,
        isPlaying: false,
        volume: 0.7,
        playbackRate: 1.0,
        hasUserInteraction: false,
        autoAdvance: false, // Ensure autoAdvance is reset
      },
    });
  },
});