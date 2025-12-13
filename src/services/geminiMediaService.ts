
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { VISUAL_MANDATE, VIDEO_MANDATE } from '../config/visualMandate';

// Robust API Key Retrieval
const getApiKey = (): string => {
  // 1. Try process.env.API_KEY (injected by Vite define or Node)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
      // @ts-ignore
      return process.env.API_KEY;
    }
  } catch (e) {}

  // 2. Try import.meta.env.VITE_GEMINI_API_KEY (Vite standard)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}

  // 3. Fallback check for direct replacement or other vars
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.API_KEY) {
      // @ts-ignore
      return import.meta.env.API_KEY;
    }
  } catch (e) {}

  console.warn("API Key not found in process.env.API_KEY or VITE_GEMINI_API_KEY");
  return '';
};

const getAI = () => new GoogleGenAI({ apiKey: getApiKey() });

const MAX_RETRIES = 2; // Lowered to fail fast
const BASE_DELAY = 1000;

export class MediaGenerationError extends Error {
    constructor(public type: 'SAFETY' | 'NETWORK' | 'QUOTA' | 'UNKNOWN', message: string) {
        super(message);
    }
}

// Helper for exponential backoff retries
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Categorize Error
    let type: MediaGenerationError['type'] = 'UNKNOWN';
    if (error.status === 429) type = 'QUOTA';
    else if (error.message?.includes('SAFETY') || error.response?.promptFeedback?.blockReason) type = 'SAFETY';
    else if (error.message?.includes('fetch failed')) type = 'NETWORK';

    if (type === 'SAFETY') {
        console.warn(`[GeminiMediaService] Blocked by Safety settings. No retry.`);
        throw new MediaGenerationError('SAFETY', 'Content blocked by safety filters.');
    }

    if (retries > 0 && (type === 'NETWORK' || type === 'QUOTA' || type === 'UNKNOWN')) {
         const delay = BASE_DELAY * (MAX_RETRIES - retries + 1);
         console.warn(`[GeminiMediaService] Operation failed (${type}), retrying in ${delay}ms... (Attempts left: ${retries})`);
         await new Promise(resolve => setTimeout(resolve, delay));
         return withRetry(operation, retries - 1);
    }
    
    throw new MediaGenerationError(type, error.message || 'Unknown generation error');
  }
}

/**
 * Generate Image
 * Uses Gemini 2.5 Flash Image (Nano Banana) for high-speed, coherent visual generation.
 */
export async function generateImageAction(prompt: string): Promise<string | undefined> {
  const apiKey = getApiKey();
  if (!apiKey) {
      throw new Error("API key is missing. Please provide a valid API key.");
  }

  return withRetry(async () => {
    try {
      const ai = getAI();
      // Enforce the strict visual mandate JSON wrapper for the model
      const qualityEnforcedPrompt = `
      GENERATE AN IMAGE BASED ON THIS STRICT JSON CONFIGURATION:
      \`\`\`json
      ${prompt}
      \`\`\`
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [{ text: qualityEnforcedPrompt }] },
        config: {
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          ],
          temperature: 0.7, 
        }
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error("No image data returned from Gemini.");
      return data;
    } catch (error) {
      throw error;
    }
  });
}

/**
 * Generate Speech
 * Uses Gemini 2.5 Flash TTS for character-specific voice synthesis.
 */
export async function generateSpeechAction(text: string, voiceName: string): Promise<{ audioData: string; duration: number } | undefined> {
  const apiKey = getApiKey();
  if (!apiKey) {
      throw new Error("API key is missing. Please provide a valid API key.");
  }

  return withRetry(async () => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          },
        }
      });
      
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!audioData) throw new Error("No audio data returned from Gemini.");

      // Calculate approximate duration on server to keep client logic simple
      // PCM 24kHz, 1 channel, 16-bit depth usually
      const base64Length = audioData.length;
      const byteLength = (base64Length * 3) / 4; 
      const sampleCount = byteLength / 2; // 16-bit = 2 bytes per sample
      const duration = sampleCount / 24000; 

      return { audioData, duration };

    } catch (error) {
      throw error;
    }
  });
}

/**
 * Generate Video (Veo)
 * Uses Veo 3.1 Fast Preview for atmospheric video loops.
 */
export async function generateVideoAction(
  imageB64: string, 
  visualPrompt: string, 
  aspectRatio: '16:9' | '9:16'
): Promise<string | undefined> {
  const apiKey = getApiKey();
  if (!apiKey) return undefined;

  try {
    const ai = getAI();
    const motionPrompt = `
      ${VISUAL_MANDATE.ZERO_DRIFT_HEADER}
      ${VIDEO_MANDATE.STYLE}
      Scene: ${visualPrompt}
      Directives: ${VIDEO_MANDATE.DIRECTIVES}
      Aesthetic: ${VISUAL_MANDATE.STYLE}
    `;

    // 1. Initiate Generation (Retryable)
    let operation = await withRetry(async () => {
        return await ai.models.generateVideos({
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
    });

    // 2. Polling Loop
    let attempts = 0;
    const MAX_POLL_ATTEMPTS = 40; 
    
    while (!operation.done && attempts < MAX_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3s interval
      try {
        operation = await ai.operations.getVideosOperation({ operation: operation });
      } catch (pollError) {
        console.warn(`[GeminiMediaService] Polling transient error:`, pollError);
      }
      attempts++;
    }

    if (!operation.done) {
        throw new Error(`Veo Generation Timed Out after ${attempts} attempts`);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
      // 3. Fetch Result
      return await withRetry(async () => {
        const response = await fetch(`${videoUri}&key=${apiKey}`);
        if (!response.ok) throw new Error(`Failed to fetch video asset: ${response.status}`);
        
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        
        // Browser native base64 conversion
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);

        return `data:video/mp4;base64,${base64}`;
      });
    }
    return undefined;
  } catch (e) {
    console.error("[GeminiMediaService] Veo Generation Failed:", e);
    return undefined; 
  }
}

/**
 * Distort Image
 * Uses Gemini Image to apply psychological distortion effects.
 */
export async function distortImageAction(imageB64: string, instruction: string): Promise<string | undefined> {
  const apiKey = getApiKey();
  if (!apiKey) return undefined;

  return withRetry(async () => {
    try {
      const ai = getAI();
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
            { text: `${VISUAL_MANDATE.ZERO_DRIFT_HEADER} EFFECT: ${instruction}` }, 
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error("No distortion data returned.");
      return data;
    } catch (e) {
      console.error("[GeminiMediaService] Image Distortion Failed:", e);
      throw e;
    }
  });
}
