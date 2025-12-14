
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { VISUAL_MANDATE, VIDEO_MANDATE } from '../config/visualMandate';
import { useGameStore } from '../state/gameStore'; 
import { generateLocalImage, generateLocalSpeech, distortLocalImage } from './localMediaService';

// Robust API Key Retrieval
const getApiKey = (): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.API_KEY) return import.meta.env.API_KEY;
  } catch (e) {}
  return '';
};

const getAI = () => new GoogleGenAI({ apiKey: getApiKey() });

// --- HELPER: CHECK MODE ---
function isLiteMode(): boolean {
  try {
    return useGameStore.getState().isLiteMode;
  } catch(e) {
    return false;
  }
}

// --- RATE LIMITING QUEUE WITH CIRCUIT BREAKER ---
class RequestQueue {
    private queue: { operation: () => Promise<any>; resolve: (value: any) => void; reject: (reason: any) => void }[] = [];
    private processing = false;
    private lastRequestTime = 0;
    // Conservative throttle: 4500ms min delay (approx 13 requests/min) to stay within safe bounds
    private minDelay = 4500; 
    private pausedUntil = 0;

    async add<T>(operation: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ operation, resolve, reject });
            this.process();
        });
    }

    /**
     * Pauses the queue for a specified duration (e.g., when a 429 occurs).
     */
    pause(duration: number) {
        if (Date.now() + duration > this.pausedUntil) {
            console.warn(`[GeminiMediaService] 🛑 Circuit Breaker: Pausing queue for ${duration/1000}s due to Rate Limit.`);
            this.pausedUntil = Date.now() + duration;
            // Schedule resumption
            setTimeout(() => this.process(), duration + 100);
        }
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;

        const now = Date.now();
        
        // 1. Check Circuit Breaker
        if (now < this.pausedUntil) {
            const wait = this.pausedUntil - now;
            setTimeout(() => this.process(), wait + 100);
            return;
        }

        // 2. Check Rate Limit Throttle
        const timeSinceLast = now - this.lastRequestTime;
        if (timeSinceLast < this.minDelay) {
            this.processing = true;
            await new Promise(r => setTimeout(r, this.minDelay - timeSinceLast));
            this.processing = false;
            // Re-check state after wait
            return this.process();
        }

        this.processing = true;
        const task = this.queue.shift();
        
        if (task) {
            this.lastRequestTime = Date.now();
            try {
                // Execute the actual API call
                const result = await task.operation();
                task.resolve(result);
            } catch (e) {
                task.reject(e);
            }
        }

        this.processing = false;
        
        // Process next item if available
        if (this.queue.length > 0) {
            this.process();
        }
    }
}

const mediaQueue = new RequestQueue();

const MAX_RETRIES = 5; // Increased retries
const BASE_DELAY = 4000; // Increased base delay

export class MediaGenerationError extends Error {
    constructor(public type: 'SAFETY' | 'NETWORK' | 'QUOTA' | 'UNKNOWN' | 'AUTH', message: string) {
        super(message);
    }
}

/**
 * Robustly detects if an error is a Quota/Rate Limit error.
 * Handles various shapes of error objects from Google SDKs and Fetch.
 */
function isQuotaError(error: any): boolean {
    if (!error) return false;
    
    // 1. Status Code checks
    if (error.status === 429 || error.code === 429) return true;
    
    // 2. Nested Error Object checks
    if (error.error?.code === 429 || error.error?.status === 'RESOURCE_EXHAUSTED') return true;
    
    // 3. String matching in message
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
    return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit');
}

// Helper for exponential backoff retries
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
      // Submit operation to the rate-limited queue
      return await mediaQueue.add(operation);
  } catch (error: any) {
    // Categorize Error
    let type: MediaGenerationError['type'] = 'UNKNOWN';
    
    // Check for specific error types
    if (error instanceof MediaGenerationError) {
         type = error.type;
    } else {
         if (isQuotaError(error)) type = 'QUOTA';
         else if (error.message?.includes('SAFETY') || error.response?.promptFeedback?.blockReason) type = 'SAFETY';
         else if (error.message?.includes('API key')) type = 'AUTH';
         else if (error.message?.includes('fetch failed')) type = 'NETWORK';
    }

    if (type === 'SAFETY') {
        console.warn(`[GeminiMediaService] Blocked by Safety settings. No retry.`);
        if (error instanceof MediaGenerationError) throw error;
        throw new MediaGenerationError('SAFETY', error.message || 'Content blocked by safety filters.');
    }

    if (type === 'AUTH') {
         throw new MediaGenerationError('AUTH', 'API Key missing or invalid.');
    }

    if (retries > 0) {
         // Special handling for QUOTA errors: Trip the circuit breaker
         if (type === 'QUOTA') {
             mediaQueue.pause(10000); // Pause globally for 10 seconds
         }

         // Exponential Backoff: 4s, 8s, 16s...
         const attempt = MAX_RETRIES - retries + 1;
         const delay = BASE_DELAY * Math.pow(2, attempt - 1);
         
         console.warn(`[GeminiMediaService] ⚠️ Operation failed (${type}), retrying in ${delay}ms... (Attempts left: ${retries})`);
         
         // Wait for the delay *outside* the queue lock
         await new Promise(resolve => setTimeout(resolve, delay));
         
         // Recursively try again (this adds a new item to the queue)
         return withRetry(operation, retries - 1); 
    }
    
    throw new MediaGenerationError(type, error.message || 'Unknown generation error');
  }
}

/**
 * Generate Image
 */
export async function generateImageAction(prompt: string): Promise<string | undefined> {
  // LITE MODE CHECK
  if (isLiteMode()) {
    console.log("[MediaService] Lite Mode: Delegating to Local Canvas");
    return generateLocalImage(prompt);
  }

  const apiKey = getApiKey();
  if (!apiKey) throw new MediaGenerationError('AUTH', "API key is missing.");

  return withRetry(async () => {
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

      const candidate = response.candidates?.[0];
      
      // 1. Check for Inline Data (Success)
      const imagePart = candidate?.content?.parts?.find(p => p.inlineData);
      if (imagePart?.inlineData?.data) {
          return imagePart.inlineData.data;
      }

      // 2. Check for Text Refusal (Model refused but didn't throw standard safety error)
      const textPart = candidate?.content?.parts?.find(p => p.text);
      if (textPart?.text) {
          console.warn("[GeminiMediaService] Model Refused Image Generation:", textPart.text);
          // Treat textual refusal as SAFETY to prevent retries
          throw new MediaGenerationError('SAFETY', `Model Refusal: ${textPart.text.substring(0, 120)}...`);
      }

      // 3. Check for explicit finish reason
      if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION' || candidate?.finishReason === 'OTHER') {
          throw new MediaGenerationError('SAFETY', `Generation stopped: ${candidate.finishReason}`);
      }

      throw new Error("No image data returned from Gemini (Unknown reason).");
  });
}

/**
 * Generate Speech
 */
export async function generateSpeechAction(text: string, voiceName: string): Promise<{ audioData: string; duration: number } | undefined> {
  // LITE MODE CHECK
  if (isLiteMode()) {
    console.log("[MediaService] Lite Mode: Delegating to Local Transformers.js");
    return generateLocalSpeech(text);
  }

  const apiKey = getApiKey();
  if (!apiKey) throw new MediaGenerationError('AUTH', "API key is missing.");

  return withRetry(async () => {
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

      // Calculate approximate duration
      const base64Length = audioData.length;
      const byteLength = (base64Length * 3) / 4; 
      const sampleCount = byteLength / 2; 
      const duration = sampleCount / 24000; 

      return { audioData, duration };
  });
}

/**
 * Generate Video (Veo)
 */
export async function generateVideoAction(
  imageB64: string, 
  visualPrompt: string, 
  aspectRatio: '16:9' | '9:16'
): Promise<string | undefined> {
  // LITE MODE CHECK
  if (isLiteMode()) {
    console.warn("[MediaService] Lite Mode: Video generation skipped to save resources.");
    return undefined; 
  }

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

    // 1. Initiate Generation (Queued)
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

    // 2. Polling Loop (Not Queued, runs independently)
    let attempts = 0;
    const MAX_POLL_ATTEMPTS = 40; 
    
    while (!operation.done && attempts < MAX_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, 3000)); 
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
 */
export async function distortImageAction(imageB64: string, instruction: string): Promise<string | undefined> {
  // LITE MODE CHECK
  if (isLiteMode()) {
    return distortLocalImage(imageB64);
  }

  const apiKey = getApiKey();
  if (!apiKey) return undefined;

  return withRetry(async () => {
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

      const candidate = response.candidates?.[0];
      const data = candidate?.content?.parts?.[0]?.inlineData?.data;
      
      if (!data) {
          const text = candidate?.content?.parts?.[0]?.text;
          if (text) throw new MediaGenerationError('SAFETY', `Distortion Refused: ${text}`);
          throw new Error("No distortion data returned.");
      }
      return data;
  });
}
