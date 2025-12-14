
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, ScriptItem } from "../types";
import { BEHAVIOR_CONFIG } from "../config/behaviorTuning"; 
import { visualCoherenceEngine } from './visualCoherenceEngine';
import { CharacterId as CId } from '../types';
import { generateImageAction, generateSpeechAction, distortImageAction } from './geminiMediaService';
import { CHARACTER_VOICE_MAP, resolveVoiceForSpeaker } from '../config/voices';

// Re-export for compatibility
export { CHARACTER_VOICE_MAP, resolveVoiceForSpeaker };

// --- VISUAL PROMPT BUILDERS ---

export function buildVisualPrompt(
  target: PrefectDNA | CharacterId | string, 
  sceneContext: string,
  ledger: YandereLedger,
  narrativeText: string,
  previousTurn?: MultimodalTurn,
  directorVisualPrompt?: string 
): { imagePrompt: string; ttsPrompt: string } {
  return visualCoherenceEngine.buildCoherentPrompt(
    target, 
    sceneContext, 
    ledger, 
    narrativeText,
    previousTurn,
    directorVisualPrompt
  );
}

// --- IMAGEN 3 GENERATION ---

const MAX_IMAGE_RETRIES = 2;

export const generateNarrativeImage = async (
  target: PrefectDNA | CharacterId | string, 
  sceneContext: string,
  ledger: YandereLedger,
  narrativeText: string,
  previousTurn?: MultimodalTurn,
  retryCount: number = 0,
  directorVisualPrompt?: string 
): Promise<string | undefined> => {
  
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Image generation is disabled by config.");
    return undefined;
  }

  // Use the image prompt part of the coherence engine output
  const coherenceOutput = buildVisualPrompt(target, sceneContext, ledger, narrativeText, previousTurn, directorVisualPrompt);
  const finalCoherentPrompt = coherenceOutput.imagePrompt;

  try {
    const imageData = await generateImageAction(finalCoherentPrompt);
    
    if (!imageData) {
       throw new Error("Empty image data received.");
    }
    
    return imageData;
  } catch (error: any) {
    if (error.type === 'AUTH' || error.type === 'SAFETY') {
         console.error(`[mediaService] Critical Image Error (${error.type}): ${error.message}`);
         throw error;
    }

    if (retryCount < MAX_IMAGE_RETRIES) {
      console.warn(`[mediaService] Image generation error on attempt ${retryCount + 1}, retrying...`, error);
      await new Promise(resolve => setTimeout(resolve, 2000 + (retryCount * 2000))); 
      return generateNarrativeImage(target, sceneContext, ledger, narrativeText, previousTurn, retryCount + 1, directorVisualPrompt);
    }
    
    console.error(`[mediaService] Image generation failed after ${MAX_IMAGE_RETRIES + 1} attempts.`, error);
    throw error;
  }
};

// --- AUDIO ENGINE ---

export const generateSpeech = async (narrative: string, voiceIdOverride?: string): Promise<{ audioData: string; duration: number } | undefined> => {
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Audio generation is disabled by config.");
    return Promise.resolve(undefined);
  }

  try {
    const voiceName = voiceIdOverride || resolveVoiceForSpeaker('Narrator');
    return await generateSpeechAction(narrative, voiceName);
  } catch (error: any) {
    console.error("⚠️ Audio generation failed:", error);
    throw new Error(error.message || "Audio generation failed");
  }
};

/**
 * Generates a mixed audio track from a script.
 * 1. Generates audio for each script line using specific character voices.
 * 2. Concatenates them into a single buffer.
 * 3. Returns the blob + timing alignment data for UI highlighting.
 */
export const generateDramaticAudio = async (
    script: ScriptItem[]
): Promise<{ audioData: string; duration: number; alignment: Array<{ index: number; start: number; end: number; speaker: string }> } | undefined> => {
    if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) return undefined;
    if (!script || script.length === 0) return undefined;

    // Filter out extremely short lines that might just be noise or formatting
    const validLines = script.filter(s => s.text && s.text.length > 2);
    if (validLines.length === 0) return undefined;

    try {
        console.log(`[mediaService] Generating dramatic audio for ${validLines.length} lines...`);
        
        // Generate all audio clips in parallel (limit concurrency handled by geminiMediaService queue)
        const clipsPromise = validLines.map(async (line) => {
            const voice = resolveVoiceForSpeaker(line.speaker);
            try {
                const result = await generateSpeechAction(line.text, voice);
                return { ...result, speaker: line.speaker };
            } catch (e) {
                console.warn(`[mediaService] Failed to gen audio for line: "${line.text.substring(0, 20)}..."`, e);
                return null; 
            }
        });

        const clips = await Promise.all(clipsPromise);
        
        // Context for decoding
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        // Decode all valid clips to buffers
        const buffers = await Promise.all(clips.map(async (clip) => {
            if (!clip) return null;
            // Decode Base64 to ArrayBuffer -> AudioBuffer
            const binaryString = atob(clip.audioData);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
            return ctx.decodeAudioData(bytes.buffer.slice(0)); 
        }));

        // Calculate total duration and construct master buffer
        const validBuffers = buffers.filter(b => b !== null) as AudioBuffer[];
        if (validBuffers.length === 0) return undefined;

        // Add 0.3s pause between lines
        const GAP = 0.3; 
        const totalDuration = validBuffers.reduce((acc, b) => acc + b.duration + GAP, 0);
        const totalSamples = Math.ceil(totalDuration * 24000);
        
        const masterBuffer = ctx.createBuffer(1, totalSamples, 24000);
        const channelData = masterBuffer.getChannelData(0);
        
        let offset = 0;
        const alignment: Array<{ index: number; start: number; end: number; speaker: string }> = [];

        validBuffers.forEach((buffer, idx) => {
            const clipData = buffer.getChannelData(0);
            channelData.set(clipData, Math.floor(offset * 24000));
            
            // Record alignment
            const start = offset;
            const end = offset + buffer.duration;
            alignment.push({
                index: idx, // Maps to validLines[idx]
                start,
                end,
                speaker: validLines[idx].speaker
            });

            offset += buffer.duration + GAP;
        });

        // Encode Master Buffer back to Wav/Base64
        const wavBytes = encodeWAVFromFloat32(channelData, 24000);
        const base64 = arrayBufferToBase64(wavBytes);

        return {
            audioData: base64,
            duration: totalDuration,
            alignment
        };

    } catch (e) {
        console.error("[mediaService] Dramatic Audio Composition Failed:", e);
        return undefined;
    }
};

// --- HELPERS (Copied from localMediaService/Worker logic for browser compatibility) ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

function encodeWAVFromFloat32(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); 
  view.setUint16(22, 1, true); 
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

export const distortImage = async (imageB64: string, instruction: string): Promise<string | undefined> => {
    if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) return Promise.resolve(undefined);
    try {
      return await distortImageAction(imageB64, instruction);
    } catch (e) {
      return undefined;
    }
};
