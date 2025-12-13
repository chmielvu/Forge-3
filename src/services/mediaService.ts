
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn } from "../types";
import { BEHAVIOR_CONFIG } from "../config/behaviorTuning"; 
import { visualCoherenceEngine } from './visualCoherenceEngine';
import { VISUAL_MANDATE, VIDEO_MANDATE } from '../config/visualMandate';
import { CharacterId as CId } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
 * Generates a narrative image using the VisualCoherenceEngine to construct the prompt.
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

  // 1. Build the coherent prompt internally
  const finalCoherentPrompt = buildVisualPrompt(target, sceneContext, ledger, narrativeText, previousTurn);

  // Wrap the JSON prompt with a generation directive
  const qualityEnforcedPrompt = `
    GENERATE AN IMAGE BASED ON THIS STRICT JSON CONFIGURATION:
    \`\`\`json
    ${finalCoherentPrompt}
    \`\`\`
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: { parts: [{ text: qualityEnforcedPrompt }] },
      config: {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        temperature: 0.7, 
      }
    });

    const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: { parts: [{ text: narrative }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        },
      }
    });
    
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) return undefined;

    const base64Length = audioData.length;
    const byteLength = (base64Length * 3) / 4; 
    const sampleCount = byteLength / 2; 
    const duration = sampleCount / 24000; 

    return { audioData, duration };

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
    // Construct the motion prompt using centralized constants
    const motionPrompt = `
      ${VISUAL_MANDATE.ZERO_DRIFT_HEADER}
      ${VIDEO_MANDATE.STYLE}
      Scene: ${visualPrompt}
      Directives: ${VIDEO_MANDATE.DIRECTIVES}
      Aesthetic: ${VISUAL_MANDATE.STYLE}
    `;

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: motionPrompt,
      image: {
        imageBytes: imageB64,
        mimeType: 'image/jpeg',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });

    let attempts = 0;
    while (!operation.done && attempts < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
      attempts++;
    }

    if (!operation.done) return undefined;

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
      const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return undefined;
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
        // Build coherent prompt for video (since generateNarrativeImage handles it internally for image)
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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: imageB64,
                mimeType: 'image/jpeg',
              },
            },
            { text: `${VISUAL_MANDATE.ZERO_DRIFT_HEADER} ${instruction}` }, 
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });
  
      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData) {
        return part.inlineData.data;
      }
      return undefined;
    } catch (e) {
      console.error("Image Distortion Failed:", e);
      return undefined;
    }
  };
