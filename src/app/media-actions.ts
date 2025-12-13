'use server';

import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { VISUAL_MANDATE, VIDEO_MANDATE } from '../config/visualMandate';

// Lazy initialization function to prevent top-level errors if API KEY is missing during build
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Server Action: Generate Image
 * securely calls Gemini Image model using the provided prompt.
 */
export async function generateImageAction(prompt: string): Promise<string | undefined> {
  try {
    const ai = getAI();
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

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("[ServerAction] Image Generation Failed:", error);
    return undefined;
  }
}

/**
 * Server Action: Generate Speech
 * securely calls Gemini TTS model.
 */
export async function generateSpeechAction(text: string, voiceName: string): Promise<{ audioData: string; duration: number } | undefined> {
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
    
    if (!audioData) return undefined;

    // Calculate duration on server to keep client light
    const base64Length = audioData.length;
    const byteLength = (base64Length * 3) / 4; 
    const sampleCount = byteLength / 2; 
    const duration = sampleCount / 24000; 

    return { audioData, duration };

  } catch (error) {
    console.error("[ServerAction] Audio Generation Failed:", error);
    return undefined;
  }
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

    // Polling Loop
    let attempts = 0;
    while (!operation.done && attempts < 20) { // Increased polling attempts
      await new Promise(resolve => setTimeout(resolve, 3000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
      attempts++;
    }

    if (!operation.done) {
        console.error("[ServerAction] Veo Generation Timed Out");
        return undefined;
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
      // Securely fetch the video binary using the API KEY on the server side
      const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return `data:video/mp4;base64,${buffer.toString('base64')}`;
    }
    return undefined;
  } catch (e) {
    console.error("[ServerAction] Veo Generation Failed:", e);
    return undefined;
  }
}

/**
 * Server Action: Distort Image
 */
export async function distortImageAction(imageB64: string, instruction: string): Promise<string | undefined> {
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

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
    console.error("[ServerAction] Image Distortion Failed:", e);
    return undefined;
  }
}