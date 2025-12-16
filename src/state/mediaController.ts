import { useGameStore } from './gameStore';
import { generateNarrativeImage, generateSpeech, buildVisualPrompt, generateDramaticAudio } from '../services/mediaService';
import { MediaQueueItem, MediaStatus, MultimodalTurn, CharacterId, YandereLedger, PrefectDNA } from '../types';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { INITIAL_LEDGER } from '../constants';
import { selectNarratorMode, NARRATOR_VOICES } from '../services/narratorEngine';
import { TensionManager } from '../services/TensionManager';

// Use number for browser-compatible timer type
let mediaProcessingTimeout: number | null = null;
const MEDIA_PROCESSING_DELAY_MS = 4000;
const MAX_CONCURRENT_MEDIA_GENERATION = 1;

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
    let alignment: any[] | undefined = undefined;

    // Calculate Narrative Beat for visual context
    const kgot = store.kgot;
    const lastTraumaDelta = kgot.nodes['Subject_84']?.attributes?.last_trauma_delta || 0;
    const beat = TensionManager.calculateNarrativeBeat(turn.turnIndex, lastTraumaDelta);

    switch (item.type) {
      case 'image':
        dataUrl = await generateNarrativeImage(
            item.target || CharacterId.PLAYER,
            turn.text, 
            turn.metadata?.ledgerSnapshot || INITIAL_LEDGER,
            item.narrativeText || turn.text,
            item.previousTurn,
            0,
            item.prompt,
            beat
        );
        break;
      case 'audio':
        if (BEHAVIOR_CONFIG.ANIMATION.ENABLE_TTS && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
          if (item.script && item.script.length > 0) {
              const dramaticResult = await generateDramaticAudio(item.script);
              if (dramaticResult) {
                  dataUrl = dramaticResult.audioData;
                  duration = dramaticResult.duration;
                  alignment = dramaticResult.alignment;
              }
          } 
          
          if (!dataUrl) {
              const ledger = turn.metadata?.ledgerSnapshot || INITIAL_LEDGER;
              
              const coherence = buildVisualPrompt(
                  item.target || CharacterId.PLAYER,
                  turn.text,
                  ledger,
                  item.narrativeText || item.prompt,
                  item.previousTurn,
                  item.prompt,
                  beat
              );

              const ttsPrompt = coherence.ttsPrompt || item.narrativeText || item.prompt;
              const mode = selectNarratorMode(ledger);
              const voiceId = NARRATOR_VOICES[mode]?.voiceId || 'Zephyr';

              const result = await generateSpeech(
                 ttsPrompt, 
                 voiceId
              );

              if (result && typeof result !== 'string') {
                 dataUrl = result.audioData;
                 duration = result.duration;
              } else if (typeof result === 'string') {
                 dataUrl = result;
              }
          }
        } else {
          if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn("[MediaController] Audio generation disabled by config.");
        }
        break;
      default:
        console.warn(`[MediaController] Unknown or unsupported media type: ${item.type}`);
    }

    if (dataUrl) {
      markMediaReady(item.turnId, item.type, dataUrl, duration, alignment);
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Successfully generated ${item.type} for turn ${item.turnId}.`);
    } else {
      if (item.type === 'audio' && !BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
          removeMediaFromQueue(item);
          return;
      }
      if (item.type !== 'video') { 
          throw new Error(`Generated ${item.type} data is empty.`);
      } else {
          removeMediaFromQueue(item);
      }
    }
  } catch (error: any) {
    console.error(`[MediaController] Failed to generate ${item.type} for turn ${item.turnId}:`, error);
    markMediaError(item.turnId, item.type, error.message || 'Unknown media generation error');
    
    const updatedStore = useGameStore.getState();
    const failedItem = updatedStore.mediaQueue.failed.find((q) => q.turnId === item.turnId && q.type === item.type);
    
    if (failedItem && (failedItem.retries || 0) < BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.MAX_MEDIA_QUEUE_RETRIES) {
      const isQuota = isRateLimitError(error);
      let delay = 3000; 

      if (isQuota) {
        delay = 5000 * Math.pow(2, failedItem.retries || 0);
        if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) {
            console.warn(`[MediaController] 🛑 Rate limit detected for ${item.type}. Backing off for ${delay/1000}s.`);
        }
      } else {
         if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) {
            console.log(`[MediaController] Retrying ${item.type} for turn ${item.turnId}. Attempt ${(failedItem.retries || 0) + 1} in ${delay}ms`);
         }
      }

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
 * Now exported to be called by store or others.
 */
export const processMediaQueue = async (): Promise<void> => {
  const store = useGameStore.getState();
  const { mediaQueue, markMediaPending } = store;

  if (BEHAVIOR_CONFIG.DEV_MODE.skipMediaGeneration) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Skipping media generation due to DEV_CONFIG.skipMediaGeneration.");
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
    if (mediaProcessingTimeout) window.clearTimeout(mediaProcessingTimeout);
    mediaProcessingTimeout = window.setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
    return;
  }

  if (pending.length === 0 && inProgress.length === 0) {
    mediaProcessingTimeout = null; 
    return;
  }
  
  // Sort by priority (lower is better)
  pending.sort((a, b) => (a.priority || 99) - (b.priority || 99));

  const itemsToProcess = pending.slice(0, availableSlots);

  if (itemsToProcess.length > 0) {
    itemsToProcess.forEach(item => markMediaPending(item));
    itemsToProcess.map(item => processSingleMediaItem(item));
  }

  if (mediaProcessingTimeout) window.clearTimeout(mediaProcessingTimeout);
  mediaProcessingTimeout = window.setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
};

export const regenerateMediaForTurn = async (turnId: string, type?: 'image' | 'audio' | 'video') => {
  const store = useGameStore.getState();
  const turn = store.getTurnById(turnId);
  if (!turn) {
    console.warn(`[MediaController] Cannot regenerate media for non-existent turn ${turnId}`);
    return;
  }

  const previousTurnIndex = turn.turnIndex - 1;
  const previousTurn = previousTurnIndex >= 0 ? store.multimodalTimeline[previousTurnIndex] : undefined;
  
  let target: string | PrefectDNA = CharacterId.PLAYER;
  if (turn.metadata?.activeCharacters && turn.metadata.activeCharacters.length > 0) {
      const prefectId = turn.metadata.activeCharacters[0];
      const prefect = store.prefects.find(p => p.id === prefectId);
      target = prefect || prefectId;
  }

  const itemsToRemove: MediaQueueItem[] = [];
  if (!type || type === 'image') itemsToRemove.push({ turnId, type: 'image', prompt: '', priority: 0 });
  if (!type || type === 'audio') itemsToRemove.push({ turnId, type: 'audio', prompt: '', priority: 0 });

  itemsToRemove.forEach(item => store.removeMediaFromQueue(item));

  useGameStore.setState((state) => ({
    multimodalTimeline: state.multimodalTimeline.map((t) => {
      if (t.id === turnId) {
        const updatedTurn = { ...t };
        if (!type || type === 'image') updatedTurn.imageStatus = MediaStatus.idle;
        if (!type || type === 'audio') updatedTurn.audioStatus = MediaStatus.idle;
        return updatedTurn;
      }
      return t;
    }),
  }));

  const ledgerToUse = turn.metadata?.ledgerSnapshot || store.gameState.ledger;
  store.requestMediaForTurn(turn, target, ledgerToUse, previousTurn, true);
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

      store.requestMediaForTurn(nextTurn, target, ledgerToUse, previousTurn);
    }
  }
};

export const batchRegenerateMedia = async (turnIds: string[]) => {
  for (const turnId of turnIds) {
    await regenerateMediaForTurn(turnId);
  }
};