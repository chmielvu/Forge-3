
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, ScriptItem } from "../types";
import { BEHAVIOR_CONFIG } from "../config/behaviorTuning"; 
import { visualCoherenceEngine } from './visualCoherenceEngine';
import { CharacterId as CId } from '../types';
import { 
  generateImageAction, 
  generateSpeechAction, 
  generateMultiSpeakerSpeechAction, 
  distortImageAction 
} from './geminiMediaService';
import { CHARACTER_VOICE_MAP, resolveVoiceForSpeaker } from '../config/voices';
import { audioService } from './AudioService';
import { NarrativeBeat } from "./TensionManager";

// Re-export for compatibility
export { CHARACTER_VOICE_MAP, resolveVoiceForSpeaker };
export { generateSpeechAction as generateSpeech }; 

// --- VISUAL PROMPT BUILDERS ---

export function buildVisualPrompt(
  target: PrefectDNA | CharacterId | string, 
  sceneContext: string,
  ledger: YandereLedger,
  narrativeText: string,
  previousTurn?: MultimodalTurn,
  directorVisualPrompt?: string,
  beat?: NarrativeBeat
): { imagePrompt: string; ttsPrompt: string } {
  return visualCoherenceEngine.buildCoherentPrompt(
    target, 
    sceneContext, 
    ledger, 
    narrativeText,
    previousTurn,
    directorVisualPrompt,
    beat
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
  directorVisualPrompt?: string,
  beat?: NarrativeBeat
): Promise<string | undefined> => {
  
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Image generation is disabled by config.");
    return undefined;
  }

  // Use the image prompt part of the coherence engine output
  const coherenceOutput = buildVisualPrompt(target, sceneContext, ledger, narrativeText, previousTurn, directorVisualPrompt, beat);
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
      return generateNarrativeImage(target, sceneContext, ledger, narrativeText, previousTurn, retryCount + 1, directorVisualPrompt, beat);
    }
    
    console.error(`[mediaService] Image generation failed after ${MAX_IMAGE_RETRIES + 1} attempts.`, error);
    return undefined;
  }
};

/**
 * Generates dramatic multi-speaker audio from a structured script.
 */
export const generateDramaticAudio = async (
  script: ScriptItem[]
): Promise<{ audioData: string; duration: number; alignment: Array<{ index: number, start: number, end: number, speaker: string }> } | undefined> => {
  if (!BEHAVIOR_CONFIG.ANIMATION.ENABLE_TTS) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] TTS generation disabled by config.");
    return undefined;
  }

  try {
    // Map script items to speakerVoiceConfigs required by multi-speaker TTS
    const speakerVoiceConfigs = script.map(item => ({
      speaker: item.speaker,
      voiceConfig: { prebuiltVoiceConfig: { voiceName: resolveVoiceForSpeaker(item.speaker) } }
    }));

    // Construct multi-speaker prompt by joining script items
    const multiSpeakerText = script.map(item => `${item.speaker}: ${item.text}`).join('\n');

    let multiSpeakerResult: { audioData: string; duration: number } | undefined;
    try {
        multiSpeakerResult = await generateMultiSpeakerSpeechAction(multiSpeakerText, speakerVoiceConfigs);
    } catch (e) {
        console.warn("[mediaService] Multi-speaker generation API call failed, falling back to sequential generation.", e);
        multiSpeakerResult = undefined; // Ensure it's undefined on error
    }

    if (multiSpeakerResult && typeof multiSpeakerResult.audioData === 'string' && multiSpeakerResult.audioData.length > 0) {
        return {
            audioData: multiSpeakerResult.audioData,
            duration: multiSpeakerResult.duration,
            alignment: script.map((item, index) => ({
                index,
                start: (index / script.length) * multiSpeakerResult!.duration, // Approximate alignment
                end: ((index + 1) / script.length) * multiSpeakerResult!.duration,
                speaker: item.speaker
            }))
        };
    }
    
    // Fallback: Generate individual lines and stitch them (if multi-speaker fails or returns nothing)
    // This provides better alignment data but is slower/more expensive
    console.log("[mediaService] Multi-speaker generation returned empty or failed, falling back to sequential generation.");
    
    const clipsPromise = script.map(async (line) => {
        const voice = resolveVoiceForSpeaker(line.speaker);
        try {
            const clipResult = await generateSpeechAction(line.text, voice);
            return { ...clipResult, speaker: line.speaker };
        } catch (e) {
            console.warn(`[mediaService] Failed to gen audio for line: "${line.text.substring(0, 20)}..."`, e);
            return null; 
        }
    });

    const clips = await Promise.all(clipsPromise);
    const validClips = clips.filter(c => c !== null) as Array<{ audioData: string, duration: number, speaker: string }>;

    if (validClips.length === 0) return undefined;

    // Stitching logic using AudioService
    const ctx = audioService.getContext();
    const buffers = validClips.map(clip => audioService.decodePCM(clip.audioData)); // CRITICAL FIX: Use decodePCM
    
    const GAP = 0.1; // Silence between lines
    const totalDuration = validClips.reduce((acc, c) => acc + c.duration + GAP, 0);
    const totalSamples = Math.ceil(totalDuration * 24000);
    
    const masterBuffer = ctx.createBuffer(1, totalSamples, 24000);
    const channelData = masterBuffer.getChannelData(0);
    
    let offset = 0;
    const alignment: Array<{ index: number, start: number, end: number, speaker: string }> = [];

    buffers.forEach((buffer, idx) => {
        const clipData = buffer.getChannelData(0);
        channelData.set(clipData, Math.floor(offset * 24000));
        
        alignment.push({
            index: idx,
            start: offset,
            end: offset + buffer.duration,
            speaker: validClips[idx].speaker
        });
        
        offset += buffer.duration + GAP;
    });

    // Encode back to Base64 (WAV)
    const wavBytes = encodeWAVFromFloat32(channelData, 24000);
    const base64 = arrayBufferToBase64(wavBytes);

    return {
        audioData: base64,
        duration: totalDuration,
        alignment
    };

  } catch (error) {
    console.error("[mediaService] generateDramaticAudio failed:", error);
    return undefined; // Fail gracefully
  }
};

// --- HELPERS for Stitching ---

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