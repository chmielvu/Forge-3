
import { useGameStore } from './gameStore';
import { generateNarrativeImage, generateSpeech, animateImageWithVeo, buildVisualPrompt } from '../services/mediaService';
import { MediaQueueItem, MediaStatus, MultimodalTurn, CharacterId, YandereLedger, PrefectDNA } from '../types';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { INITIAL_LEDGER } from '../constants';
import { selectNarratorMode, NARRATOR_VOICES } from '../services/narratorEngine';

// Use number for browser-compatible timer type
let mediaProcessingTimeout: number | null = null;
const MEDIA_PROCESSING_DELAY_MS = 3000; // Delay increased to 3s to reduce RPM
const MAX_CONCURRENT_MEDIA_GENERATION = 1; // Strict sequential processing to avoid 429s

/**
 * Helper to detect Rate Limit / Quota errors
 */
const isRateLimitError = (error: any): boolean => {
  const msg = (error.message || '').toLowerCase();
  return msg.includes('429') || msg.includes('quota') || msg.includes('resource exhausted') || msg.includes('rate limit');
};

/**
 * Processes a single media item from the queue.
 */
const processSingleMediaItem = async (item: MediaQueueItem): Promise<void> => {
  const store = useGameStore.getState();
  const { multimodalTimeline, markMediaReady, markMediaError, removeMediaFromQueue, retryFailedMedia } = store;

  const turn = multimodalTimeline.find(t => t.id === item.turnId);

  if (!turn) {
    console.error(`[MediaController] Turn ${item.turnId} not found for media item ${item.type}. Removing from queue.`);
    removeMediaFromQueue(item);
    return;
  }

  try {
    let dataUrl: string | undefined = undefined;
    let duration: number | undefined = undefined;

    switch (item.type) {
      case 'image':
        // Generate image using full context, passing the Director's specific prompt
        dataUrl = await generateNarrativeImage(
            item.target || CharacterId.PLAYER,
            turn.text, // Use narrative text as scene context
            turn.metadata?.ledgerSnapshot || INITIAL_LEDGER,
            item.narrativeText || turn.text,
            item.previousTurn,
            0, // Initial retry count
            item.prompt // Pass the Director's specific visual prompt (stored in item.prompt)
        );
        break;
      case 'audio':
        if (BEHAVIOR_CONFIG.ANIMATION.ENABLE_TTS && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
          // Determine voice ID based on ledger state
          const ledger = turn.metadata?.ledgerSnapshot || INITIAL_LEDGER;
          const mode = selectNarratorMode(ledger);
          const voiceId = NARRATOR_VOICES[mode]?.voiceId || 'Zephyr';

          const result = await generateSpeech(
             item.narrativeText || item.prompt, 
             voiceId
          );

          if (result && typeof result !== 'string') {
             dataUrl = result.audioData;
             duration = result.duration;
          } else if (typeof result === 'string') {
             dataUrl = result;
          }
        } else {
          if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn("[MediaController] Audio generation disabled by config.");
        }
        break;
      case 'video':
        if (BEHAVIOR_CONFIG.ANIMATION.ENABLE_VEO && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo) {
          const imageData = multimodalTimeline.find(t => t.id === item.turnId)?.imageData;
          if (imageData) {
            // Use the coherent prompt stored in item.prompt (built at enqueue time) for video consistency
            dataUrl = await animateImageWithVeo(imageData, item.prompt);
          } else {
            if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn(`[MediaController] Cannot generate video for turn ${item.turnId}: image data not available.`);
          }
        } else {
          if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn("[MediaController] Video generation disabled by config.");
        }
        break;
      default:
        console.warn(`[MediaController] Unknown media type: ${item.type}`);
    }

    if (dataUrl) {
      markMediaReady(item.turnId, item.type, dataUrl, duration);
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Successfully generated ${item.type} for turn ${item.turnId}.`);
    } else {
      // Audio can be undefined if disabled or empty, handle gracefully if not error
      if (item.type === 'audio' && !BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
          removeMediaFromQueue(item);
          return;
      }
      throw new Error(`Generated ${item.type} data is empty.`);
    }
  } catch (error: any) {
    console.error(`[MediaController] Failed to generate ${item.type} for turn ${item.turnId}:`, error);
    markMediaError(item.turnId, item.type, error.message || 'Unknown media generation error');
    
    // Refresh state to get the failed item record with updated status
    const updatedStore = useGameStore.getState();
    const failedItem = updatedStore.mediaQueue.failed.find((q) => q.turnId === item.turnId && q.type === item.type);
    
    // Check retry limits and schedule backoff
    if (failedItem && (failedItem.retries || 0) < BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.MAX_MEDIA_QUEUE_RETRIES) {
      const isQuota = isRateLimitError(error);
      let delay = 2000; // Default retry delay

      if (isQuota) {
        // Exponential backoff for Quota errors: 5s, 10s, 20s...
        delay = 5000 * Math.pow(2, failedItem.retries || 0);
        if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) {
            console.warn(`[MediaController] 🛑 Rate limit detected for ${item.type}. Backing off for ${delay/1000}s.`);
        }
      } else {
         if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) {
            console.log(`[MediaController] Retrying ${item.type} for turn ${item.turnId}. Attempt ${(failedItem.retries || 0) + 1} in ${delay}ms`);
         }
      }

      // Schedule the retry
      setTimeout(() => {
        useGameStore.getState().retryFailedMedia(item.turnId, item.type);
      }, delay);

    } else {
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn(`[MediaController] Max retries reached for ${item.type} on turn ${item.turnId}. Item remains in failed queue.`);
    }
  }
};


/**
 * Processes the media generation queue, allowing for parallel generation.
 */
const processMediaQueue = async (): Promise<void> => {
  const store = useGameStore.getState();
  const { mediaQueue, markMediaPending } = store;

  // Stop if dev mode is set to skip media generation
  if (BEHAVIOR_CONFIG.DEV_MODE.skipMediaGeneration) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Skipping media generation due to DEV_CONFIG.skipMediaGeneration.");
    // Clear queue so it doesn't build up
    if (mediaQueue.pending.length > 0 || mediaQueue.inProgress.length > 0) {
      window.setTimeout(() => useGameStore.setState(s => ({
        mediaQueue: { ...s.mediaQueue, pending: [], inProgress: [] }
      })), 0);
    }
    return;
  }

  const { pending, inProgress } = mediaQueue;
  const availableSlots = MAX_CONCURRENT_MEDIA_GENERATION - inProgress.length;

  if (availableSlots <= 0 && pending.length > 0) {
    // Already processing max concurrent items, and more are pending. Reschedule check.
    if (mediaProcessingTimeout) window.clearTimeout(mediaProcessingTimeout);
    mediaProcessingTimeout = window.setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
    return;
  }

  if (pending.length === 0 && inProgress.length === 0) {
    // Queue is entirely empty
    mediaProcessingTimeout = null; // Clear timeout when queue is truly empty
    return;
  }

  // Take the next batch of items from pending
  const itemsToProcess = pending.slice(0, availableSlots);

  if (itemsToProcess.length > 0) {
    // Move items from pending to inProgress state
    itemsToProcess.forEach(item => markMediaPending(item));

    // Process items in parallel
    itemsToProcess.map(item => processSingleMediaItem(item));
  }

  // Always reschedule to keep checking the queue
  if (mediaProcessingTimeout) window.clearTimeout(mediaProcessingTimeout);
  mediaProcessingTimeout = window.setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
};


/**
 * Enqueues a turn's required media for generation.
 */
export const enqueueTurnForMedia = (
  turn: MultimodalTurn,
  target: PrefectDNA | CharacterId | string,
  ledger: YandereLedger,
  previousTurn?: MultimodalTurn,
  forceEnqueue: boolean = false
) => {
  const store = useGameStore.getState();

  if (BEHAVIOR_CONFIG.DEV_MODE.skipMediaGeneration) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Skipping enqueue for turn ${turn.id} due to DEV_CONFIG.skipMediaGeneration.`);
    return;
  }

  // Use the visualPrompt from the turn (Director Output) if available, otherwise fallback
  const directorVisualPrompt = turn.visualPrompt;

  // Image
  if ((turn.imageStatus === MediaStatus.idle || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'image',
      // Pass the director's visual prompt here. It will be passed to generateNarrativeImage
      // which will then pass it to buildVisualPrompt for coherent styling.
      prompt: directorVisualPrompt || turn.text, 
      narrativeText: turn.text,
      target: target,
      previousTurn: previousTurn,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued image for turn ${turn.id}`);
  }

  // Audio
  if ((turn.audioStatus === MediaStatus.idle || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'audio',
      prompt: turn.text,
      narrativeText: turn.text,
      target: target,
      previousTurn: previousTurn,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued audio for turn ${turn.id}`);
  }

  // Video (conditional)
  const isHighIntensity = (turn.metadata?.ledgerSnapshot?.traumaLevel || 0) > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveTrauma ||
                          (turn.metadata?.ledgerSnapshot?.shamePainAbyssLevel || 0) > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveShame;
  
  if ((turn.videoStatus === MediaStatus.idle || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo && isHighIntensity) {
    // For video, we might want a slightly more stable prompt or the same one
    const coherentVideoPrompt = buildVisualPrompt(
        target, 
        turn.text, 
        ledger, 
        turn.text, 
        previousTurn,
        directorVisualPrompt // Use same visual base
    );

    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'video',
      prompt: coherentVideoPrompt, // Video uses pre-built coherent prompt
      narrativeText: turn.text,
      target: target,
      previousTurn: previousTurn,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued video for turn ${turn.id} (high intensity)`);
  }

  if (!mediaProcessingTimeout) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Starting media queue processing.");
    mediaProcessingTimeout = window.setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
  }
};

/**
 * Regenerates media for a specific turn.
 */
export const regenerateMediaForTurn = async (turnId: string, type?: 'image' | 'audio' | 'video') => {
  const store = useGameStore.getState();
  const turn = store.getTurnById(turnId);
  if (!turn) {
    console.warn(`[MediaController] Cannot regenerate media for non-existent turn ${turnId}`);
    return;
  }

  const previousTurnIndex = turn.turnIndex - 1;
  const previousTurn = previousTurnIndex >= 0 ? store.multimodalTimeline[previousTurnIndex] : undefined;
  
  // Try to find the specific active character from metadata, or fallback to player
  // This improves targeting for re-generations
  let target: string | PrefectDNA = CharacterId.PLAYER;
  if (turn.metadata?.activeCharacters && turn.metadata.activeCharacters.length > 0) {
      // Find matching prefect object if available in store
      const prefectId = turn.metadata.activeCharacters[0];
      const prefect = store.prefects.find(p => p.id === prefectId);
      target = prefect || prefectId;
  }

  const itemsToRemove: MediaQueueItem[] = [];
  if (!type || type === 'image') itemsToRemove.push({ turnId, type: 'image', prompt: '' });
  if (!type || type === 'audio') itemsToRemove.push({ turnId, type: 'audio', prompt: '' });
  if (!type || type === 'video') itemsToRemove.push({ turnId, type: 'video', prompt: '' });

  itemsToRemove.forEach(item => store.removeMediaFromQueue(item));

  useGameStore.setState((state) => ({
    multimodalTimeline: state.multimodalTimeline.map((t) => {
      if (t.id === turnId) {
        const updatedTurn = { ...t };
        if (!type || type === 'image') updatedTurn.imageStatus = MediaStatus.idle;
        if (!type || type === 'audio') updatedTurn.audioStatus = MediaStatus.idle;
        if (!type || type === 'video') updatedTurn.videoStatus = MediaStatus.idle;
        return updatedTurn;
      }
      return t;
    }),
  }));

  // Re-enqueue
  const ledgerToUse = turn.metadata?.ledgerSnapshot || store.gameState.ledger;
  enqueueTurnForMedia(turn, target, ledgerToUse, previousTurn, true);
};

export const preloadUpcomingMedia = (currentTurnId: string, count: number) => {
  const store = useGameStore.getState();
  const { multimodalTimeline } = store;

  const currentIndex = multimodalTimeline.findIndex(t => t.id === currentTurnId);
  if (currentIndex === -1) return;

  for (let i = 1; i <= count; i++) {
    const nextTurn = multimodalTimeline[currentIndex + i];
    if (nextTurn) {
      const previousTurn = multimodalTimeline[currentIndex + i - 1] || multimodalTimeline[currentIndex];
      const target = nextTurn.metadata?.activeCharacters?.[0] || CharacterId.PROVOST;
      const ledgerToUse = nextTurn.metadata?.ledgerSnapshot || store.gameState.ledger;

      enqueueTurnForMedia(nextTurn, target, ledgerToUse, previousTurn);
    }
  }
};

export const batchRegenerateMedia = async (turnIds: string[]) => {
  for (const turnId of turnIds) {
    await regenerateMediaForTurn(turnId);
  }
};
