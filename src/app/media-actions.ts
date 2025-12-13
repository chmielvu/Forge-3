'use server';

import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { VISUAL_MANDATE, VIDEO_MANDATE } from '../config/visualMandate';

// Lazy initialization function to prevent top-level errors if API KEY is missing during build
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

// Helper for exponential backoff retries
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0) {
      const isRetryable = error.status === 503 || error.status === 429 || error.message?.includes('fetch failed');
      if (isRetryable || retries > 1) { // Retry most errors except explicit 400s unless completely broken
         const delay = BASE_DELAY * (MAX_RETRIES - retries + 1);
         console.warn(`[ServerAction] Operation failed, retrying in ${delay}ms... (Attempts left: ${retries})`);
         await new Promise(resolve => setTimeout(resolve, delay));
         return withRetry(operation, retries - 1);
      }
    }
    throw error;
  }
}

/**
 * Server Action: Generate Image
 * securely calls Gemini Image model using the provided prompt.
 */
export async function generateImageAction(prompt: string): Promise<string | undefined> {
  return withRetry(async () => {
    try {
      const ai = getAI();
      // Ensure the prompt adheres to the JSON configuration expected by the prompt engineering in visualCoherenceEngine
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
          ],
          temperature: 0.7, 
        }
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error("No image data returned from Gemini.");
      return data;
    } catch (error) {
      console.error("[ServerAction] Image Generation Failed:", error);
      throw error; // Propagate for retry
    }
  });
}

/**
 * Server Action: Generate Speech
 * securely calls Gemini TTS model.
 */
export async function generateSpeechAction(text: string, voiceName: string): Promise<{ audioData: string; duration: number } | undefined> {
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

      // Calculate duration on server to keep client light
      const base64Length = audioData.length;
      const byteLength = (base64Length * 3) / 4; 
      const sampleCount = byteLength / 2; 
      const duration = sampleCount / 24000; 

      return { audioData, duration };

    } catch (error) {
      console.error("[ServerAction] Audio Generation Failed:", error);
      throw error;
    }
  });
}

/**
 * Server Action: Generate Video (Veo)
 * securely calls Veo model, polls for completion, and fetches result using API key.
 */
export async function generateVideoAction(
  imageB64: string, 
  visualPrompt: string, 
  aspectRatio: '16:9' | '9:16'
): Promise<string | undefined> {
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

    // 2. Polling Loop (Not wrapped in global retry, handles its own lifecycle)
    let attempts = 0;
    const MAX_POLL_ATTEMPTS = 30; // Increased to 30 (approx 90-100s) for reliability
    
    while (!operation.done && attempts < MAX_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3s interval
      try {
        operation = await ai.operations.getVideosOperation({ operation: operation });
      } catch (pollError) {
        console.warn(`[ServerAction] Polling transient error:`, pollError);
        // Continue loop despite transient poll errors
      }
      attempts++;
    }

    if (!operation.done) {
        throw new Error(`Veo Generation Timed Out after ${attempts} attempts`);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
      // 3. Fetch Result (Retryable)
      return await withRetry(async () => {
        // Securely fetch the video binary using the API KEY on the server side
        const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
        if (!response.ok) throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
        
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return `data:video/mp4;base64,${buffer.toString('base64')}`;
      });
    }
    return undefined;
  } catch (e) {
    console.error("[ServerAction] Veo Generation Failed:", e);
    return undefined; // Return undefined to allow client-side handling/logging
  }
}

/**
 * Server Action: Distort Image
 */
export async function distortImageAction(imageB64: string, instruction: string): Promise<string | undefined> {
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

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error("No distortion data returned.");
      return data;
    } catch (e) {
      console.error("[ServerAction] Image Distortion Failed:", e);
      throw e;
    }
  });
}