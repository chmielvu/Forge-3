
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn } from "../types";
import { BEHAVIOR_CONFIG } from "../config/behaviorTuning"; 
import { visualCoherenceEngine } from './visualCoherenceEngine';
import { CharacterId as CId } from '../types';
import { generateImageAction, generateSpeechAction, generateVideoAction, distortImageAction } from './geminiMediaService';

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
    // 2. Call Service (Client Side Execution)
    const imageData = await generateImageAction(finalCoherentPrompt);
    
    if (!imageData) {
       // Should be caught by service error throwing, but safety check
       throw new Error("Empty image data received.");
    }
    
    return imageData;
  } catch (error: any) {
    // Critical errors are rethrown immediately without retry loop if they are permanent
    if (error.type === 'AUTH' || error.type === 'SAFETY') {
         console.error(`[mediaService] Critical Image Error (${error.type}): ${error.message}`);
         throw error;
    }

    if (retryCount < MAX_IMAGE_RETRIES) {
      console.warn(`[mediaService] Image generation error on attempt ${retryCount + 1}, retrying...`, error);
      // Backoff handled in service mostly, but here we retry the whole logic (e.g. prompt rebuild)
      await new Promise(resolve => setTimeout(resolve, 2000 + (retryCount * 2000))); 
      return generateNarrativeImage(target, sceneContext, ledger, narrativeText, previousTurn, retryCount + 1);
    }
    
    console.error(`[mediaService] Image generation failed after ${MAX_IMAGE_RETRIES + 1} attempts.`, error);
    throw error; // Propagate error so UI can show it
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
    // Call Service
    return await generateSpeechAction(narrative, voiceName);
  } catch (error: any) {
    console.error("⚠️ Audio generation failed:", error);
    // Throw error so it bubbles to UI
    throw new Error(error.message || "Audio generation failed");
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
    // Call Service
    // Note: Motion prompt construction logic moved to Service to ensure visual mandate security
    return await generateVideoAction(imageB64, visualPrompt, aspectRatio);
  } catch (e: any) {
    console.error("Veo Animation Failed:", e);
    // Throw error so it bubbles to UI (optional for video as it's an enhancement)
    throw new Error(e.message || "Video generation failed");
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
  // Use allSettled to allow partial success (e.g., Image works, Audio fails)
  
  const imagePromise = generateNarrativeImage(target, visualPrompt, ledger, narrative, previousTurn)
    .catch(e => { console.warn("Image gen failed in orchestrator:", e); return undefined; });
  
  const audioPromise = generateSpeech(narrative, narratorVoiceId)
    .catch(e => { console.warn("Audio gen failed in orchestrator:", e); return undefined; });

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
