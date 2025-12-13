
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn } from "../types";
import { BEHAVIOR_CONFIG } from "../config/behaviorTuning"; 
import { visualCoherenceEngine } from './visualCoherenceEngine';
import { CharacterId as CId } from '../types';
import { generateImageAction, generateSpeechAction, generateVideoAction, distortImageAction } from '../app/media-actions';

// Voice Mapping for specific characters
export const CHARACTER_VOICE_MAP: Record<string, string> = {
  [CId.PROVOST]: 'Zephyr', // Authoritative, Calm
  [CId.INQUISITOR]: 'Fenrir', // Aggressive, Wild
  [CId.LOGICIAN]: 'Charon', // Deep, Analytical
  [CId.CONFESSOR]: 'Kore', // Soft, Whispering
  [CId.ASTRA]: 'Puck', // Anxious, Higher pitch
  [CId.OBSESSIVE]: 'Kore', // Dere-mode (Soft)
  [CId.LOYALIST]: 'Puck', // Brittle, Sharp
  [CId.DISSIDENT]: 'Fenrir', // Intense
  'Subject_84': 'Charon' // Internal monologue
};

export const getCharacterVoiceId = (charId: string): string => {
  return CHARACTER_VOICE_MAP[charId] || 'Zephyr';
};

// --- VISUAL PROMPT BUILDERS ---

/**
 * Builds a coherent visual prompt by integrating character DNA, scene context, ledger state,
 * and historical visual memory from the VisualCoherenceEngine.
 */
export function buildVisualPrompt(
  target: PrefectDNA | CharacterId | string, 
  sceneContext: string,
  ledger: YandereLedger,
  narrativeText: string,
  previousTurn?: MultimodalTurn 
): string {
  // Delegate to the VisualCoherenceEngine for detailed prompt construction
  return visualCoherenceEngine.buildCoherentPrompt(
    target, 
    sceneContext, 
    ledger, 
    narrativeText,
    previousTurn
  );
}

// --- IMAGEN 3 GENERATION ---

const MAX_IMAGE_RETRIES = 2;

/**
 * Generates a narrative image using the VisualCoherenceEngine to construct the prompt
 * and the Server Action to execute the generation.
 */
export const generateNarrativeImage = async (
  target: PrefectDNA | CharacterId | string, 
  sceneContext: string,
  ledger: YandereLedger,
  narrativeText: string,
  previousTurn?: MultimodalTurn,
  retryCount: number = 0
): Promise<string | undefined> => {
  
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Image generation is disabled by config.");
    return undefined;
  }

  // 1. Build the coherent prompt internally (Client Side State)
  const finalCoherentPrompt = buildVisualPrompt(target, sceneContext, ledger, narrativeText, previousTurn);

  try {
    // 2. Call Server Action (Server Side Execution)
    const imageData = await generateImageAction(finalCoherentPrompt);
    
    if (!imageData) {
      if (retryCount < MAX_IMAGE_RETRIES) {
        console.warn(`[mediaService] Image generation attempt ${retryCount + 1} failed (no data), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 + (retryCount * 1000))); 
        return generateNarrativeImage(target, sceneContext, ledger, narrativeText, previousTurn, retryCount + 1);
      } else {
        console.error(`[mediaService] Image generation failed after ${MAX_IMAGE_RETRIES + 1} attempts (no data).`);
        return undefined;
      }
    }
    
    return imageData;
  } catch (error) {
    if (retryCount < MAX_IMAGE_RETRIES) {
      console.warn(`[mediaService] Image generation error on attempt ${retryCount + 1}, retrying...`, error);
      await new Promise(resolve => setTimeout(resolve, 2000 + (retryCount * 2000))); 
      return generateNarrativeImage(target, sceneContext, ledger, narrativeText, previousTurn, retryCount + 1);
    }
    console.error(`[mediaService] Image generation failed after ${MAX_IMAGE_RETRIES + 1} attempts.`, error);
    throw error;
  }
};

// --- AUDIO ENGINE ---

/**
 * Heuristic fallback if no explicit voice ID is provided
 */
const selectVoiceForNarrative = (narrative: string): string => {
  const lower = narrative.toLowerCase();
  if (lower.includes('shout') || lower.includes('fury') || lower.includes('petra')) return 'Fenrir';
  if (lower.includes('whisper') || lower.includes('calista') || lower.includes('kaelen')) return 'Kore';
  if (lower.includes('analyze') || lower.includes('lysandra') || lower.includes('elara')) return 'Puck';
  return 'Zephyr'; // Selene/Default
};

export const generateSpeech = async (narrative: string, voiceIdOverride?: string): Promise<{ audioData: string; duration: number } | undefined> => {
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Audio generation is disabled by config.");
    return Promise.resolve(undefined);
  }

  try {
    const voiceName = voiceIdOverride || selectVoiceForNarrative(narrative);
    // Call Server Action
    return await generateSpeechAction(narrative, voiceName);
  } catch (error) {
    console.error("⚠️ Audio generation failed:", error);
    return undefined;
  }
};

// --- VEO 3.1 VIDEO GENERATION ---

export const animateImageWithVeo = async (
  imageB64: string, 
  visualPrompt: string, 
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string | undefined> => {
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Video generation is disabled by config.");
    return Promise.resolve(undefined);
  }

  try {
    // Call Server Action
    // Note: Motion prompt construction logic moved to Server Action to ensure visual mandate security
    return await generateVideoAction(imageB64, visualPrompt, aspectRatio);
  } catch (e) {
    console.error("Veo Animation Failed:", e);
    return undefined;
  }
};

// --- ORCHESTRATOR ---

export const generateEnhancedMedia = async (
  narrative: string,
  visualPrompt: string, 
  ledger: YandereLedger,
  target: PrefectDNA | CharacterId, 
  previousTurn?: MultimodalTurn,
  narratorVoiceId?: string
): Promise<{ audioData?: string, imageData?: string, videoData?: string }> => {
  
  // 1. Generate Image (Internal buildVisualPrompt call)
  const imagePromise = generateNarrativeImage(target, visualPrompt, ledger, narrative, previousTurn);
  
  // 2. Generate Audio
  const audioPromise = generateSpeech(narrative, narratorVoiceId);

  let videoPromise: Promise<string | undefined> = Promise.resolve(undefined);
  
  const isHighIntensity = (ledger.traumaLevel > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveTrauma || 
                          ledger.shamePainAbyssLevel > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveShame) &&
                          BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo; 

  if (isHighIntensity) {
    videoPromise = (async () => {
      try {
        const imageBase64 = await imagePromise; 
        if (!imageBase64) {
          console.warn("Image not available for video generation.");
          return undefined;
        }
        // Build coherent prompt for video
        const coherentPrompt = buildVisualPrompt(target, visualPrompt, ledger, narrative, previousTurn);
        return await animateImageWithVeo(imageBase64, coherentPrompt, '16:9');
      } catch (e) {
        console.error("Conditional video generation failed:", e);
        return undefined;
      }
    })();
  }

  const [imageBytes, audioResult, videoBytes] = await Promise.all([imagePromise, audioPromise, videoPromise]);
  
  return {
    imageData: imageBytes,
    audioData: audioResult?.audioData,
    videoData: videoBytes
  };
};

export const distortImage = async (imageB64: string, instruction: string): Promise<string | undefined> => {
    if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
        if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Image distortion is disabled by config.");
        return Promise.resolve(undefined);
    }

    try {
      return await distortImageAction(imageB64, instruction);
    } catch (e) {
      console.error("Image Distortion Failed:", e);
      return undefined;
    }
  };
