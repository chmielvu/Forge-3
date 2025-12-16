
import { pipeline, env } from '@xenova/transformers';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning'; // Import config

// Worker Instance Singleton
let mediaWorker: Worker | null = null;
// Track worker availability status: null (unknown), true (available), false (unavailable/disabled)
let workerAvailable: boolean | null = null; 

// Stores pending worker requests, keyed by a unique ID
const pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }>();

// Helper for chatty models (copied from worker for main thread fallback)
function extractJSON(text: string) {
    try {
        const firstBracket = text.indexOf('{');
        const lastBracket = text.lastIndexOf('}');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            const jsonString = text.substring(firstBracket, lastBracket + 1);
            return JSON.parse(jsonString);
        }
        return null;
    } catch {
        return null;
    }
}

function getWorker(): Worker | null {
    // If TEST_MODE is active, explicitly disable workers.
    // This check must happen first.
    if (BEHAVIOR_CONFIG.TEST_MODE) {
        if (workerAvailable !== false) { // Only log once if it's not already marked false
            console.warn("[LocalMediaService] TEST_MODE active: Disabling Web Worker for local LLMs.");
        }
        workerAvailable = false;
        return null;
    }

    // If workers were previously determined unavailable, respect that.
    if (workerAvailable === false) return null;

    if (!mediaWorker) {
        try {
            // Attempt to create worker
            mediaWorker = new Worker(new URL('../workers/media.worker.ts', import.meta.url).href, {
                type: 'module'
            });
            
            mediaWorker.onmessage = (e) => {
                const { type, id, payload, error } = e.data;
                
                if (type === 'RESULT' && pendingRequests.has(id)) {
                    pendingRequests.get(id)!.resolve(payload);
                    pendingRequests.delete(id);
                } else if (type === 'ERROR' && pendingRequests.has(id)) {
                    pendingRequests.get(id)!.reject(new Error(error));
                    pendingRequests.delete(id);
                } else if (type === 'progress') {
                    // console.debug('[Worker Progress]', payload);
                } else if (type === 'status') {
                    console.log(`[Worker Status] ${payload}`);
                }
            };
            
            mediaWorker.onerror = (e) => {
                console.error("[LocalMediaService] Worker Error:", e);
                workerAvailable = false; // Mark as unavailable on error
                mediaWorker = null; // Clean up worker instance
                // Reject all pending requests immediately if the worker crashes
                pendingRequests.forEach(req => req.reject(new Error("Worker crashed unexpectedly.")));
                pendingRequests.clear();
            };
            workerAvailable = true; // Mark as successfully created
        } catch (e) {
            console.error("[LocalMediaService] Failed to construct worker (falling back to main thread):", e);
            workerAvailable = false; // Mark as unavailable
            mediaWorker = null; // Ensure worker is null
            return null;
        }
    }
    return mediaWorker;
}

// Generic Dispatcher
async function dispatchToWorker(type: string, payload: any, timeoutMs = 45000): Promise<any> {
    const worker = getWorker();
    if (!worker) {
        // Fallback to main thread execution if worker not available
        return executeOnMainThread(type, payload);
    }

    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                reject(new Error(`Worker task ${type} timed out`));
            }
        }, timeoutMs);

        pendingRequests.set(id, {
            resolve: (res: any) => { clearTimeout(timeout); resolve(res); },
            reject: (err: any) => { clearTimeout(timeout); reject(err); }
        });

        worker.postMessage({ type, id, payload });
    });
}

// --- MAIN THREAD FALLBACK IMPLEMENTATIONS (Simplified / Mock) ---
async function executeOnMainThread(type: string, payload: any): Promise<any> {
    switch (type) {
        case 'ANALYZE_TONE': {
            const lowerText = payload.text.toLowerCase();
            const isApproved = !lowerText.includes('wholesome') && !lowerText.includes('melodramatic');
            return { isApproved, reason: "Main thread mock tone analysis." };
        }
        case 'SUMMARIZE': {
            const words = payload.text.split(' ').slice(0, 20).join(' '); // Simple truncation
            return `Summary: ${words}...`;
        }
        case 'REPAIR_JSON': {
            try {
                const parsed = extractJSON(payload.jsonString);
                if (parsed) return JSON.stringify(parsed);
            } catch (e) {
                // Attempt a very basic repair, e.g., wrapping in {}
                console.warn("[LocalMediaService:MainThread] Basic JSON repair attempt failed. Returning empty object.", e);
            }
            return JSON.stringify({}); // Fallback to empty JSON
        }
        case 'ANALYZE_INTENT': {
            const lowerText = payload.text.toLowerCase();
            if (lowerText.includes('defy') || lowerText.includes('resist')) {
                return { intent: 'defiance', subtext: 'genuine', intensity: 8 };
            } else if (lowerText.includes('submit') || lowerText.includes('comply')) {
                return { intent: 'submission', subtext: 'genuine', intensity: 7 };
            } else if (lowerText.includes('fear') || lowerText.includes('scared')) {
                return { intent: 'fear', subtext: 'genuine', intensity: 6 };
            }
            return { intent: 'neutral', subtext: 'ambiguous', intensity: 5 };
        }
        case 'GENERATE_SPEECH': {
            // Simplified speech generation on main thread (mock AudioBuffer)
            const text = payload.text;
            const sampleRate = 24000;
            const durationPerChar = 0.08;
            const duration = Math.max(0.5, text.length * durationPerChar);
            const frameCount = sampleRate * duration;
            const audioBuffer = new Float32Array(frameCount);

            for (let i = 0; i < frameCount; i++) {
                audioBuffer[i] = (Math.random() * 0.1 - 0.05); // Just random noise
            }
            return { audio: audioBuffer, sampling_rate: sampleRate };
        }
        default:
            throw new Error(`Unknown main thread execution type: ${type}`);
    }
}

// --- LOCAL GRUNT API ---
export const localGrunt = {
    // 1. The Aesthete (Qwen) - Tone Check
    async checkTone(text: string): Promise<boolean> {
        try {
            const result = await dispatchToWorker('ANALYZE_TONE', { text });
            return result.isApproved;
        } catch (e) {
            console.warn("[Local Service] Tone check failed/timed out:", e);
            return true; // Fail open to allow gameplay
        }
    },

    // 2. The Grunt (SmolLM) - Summarization
    async summarizeHistory(text: string): Promise<string> {
        try {
            return await dispatchToWorker('SUMMARIZE', { text });
        } catch (e) {
            console.warn("[Local Service] Summarization failed:", e);
            return "";
        }
    },

    // 3. The Grunt (SmolLM) - Repair
    async repairJson(jsonString: string): Promise<string> {
        return dispatchToWorker('REPAIR_JSON', { jsonString });
    }
};

// --- LOCAL EMPATH API (Llama 3.2) ---
export const localMediaService = {
    async analyzeIntent(text: string): Promise<{ intent: string, subtext: string, intensity: number }> {
        try {
            return await dispatchToWorker('ANALYZE_INTENT', { text });
        } catch (e) {
            console.warn("[LocalMediaService] Intent analysis failed, using fallback.", e);
            return { intent: 'neutral', subtext: 'genuine', intensity: 5 };
        }
    }
};

// --- VISUAL ANALYSIS HELPERS (Kept on main thread as they are lightweight canvas ops) ---

interface VisualParams {
  baseHue: number;
  secondaryHue: number;
  saturation: number;
  lightness: number;
  chaos: number; 
  darkness: number;
  shapes: 'organic' | 'geometric' | 'jagged' | 'void';
  composition: 'center' | 'bottom-heavy' | 'top-heavy' | 'scattered';
  texture: 'grain' | 'scratch' | 'liquid' | 'scanline';
}

function analyzePrompt(prompt: string): VisualParams {
  const lower = prompt.toLowerCase();
  
  const params: VisualParams = {
    baseHue: 30, 
    secondaryHue: 0,
    saturation: 60,
    lightness: 20,
    chaos: 0.3,
    darkness: 0.8,
    shapes: 'geometric',
    composition: 'center',
    texture: 'grain'
  };

  if (lower.match(/blood|pain|rage|red|crimson|flesh|wound/)) {
    params.baseHue = 350; 
    params.secondaryHue = 20;
    params.saturation = 80;
    params.chaos += 0.3;
    params.texture = 'scratch';
  } else if (lower.match(/cold|clinical|blue|cyan|freeze|ice|sterile|lab/)) {
    params.baseHue = 200; 
    params.secondaryHue = 240;
    params.saturation = 40;
    params.lightness = 30; 
    params.darkness = 0.4;
    params.texture = 'scanline';
  }

  // ... (simplified for brevity, main logic retained) ...

  return params;
}

export async function generateLocalImage(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(''); return; }

    const params = analyzePrompt(prompt);
    
    // Simple abstract render
    ctx.fillStyle = `hsl(${params.baseHue}, ${params.saturation}%, 10%)`;
    ctx.fillRect(0, 0, 512, 512);
    
    // Add noise
    for(let k=0; k<200; k++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = `hsla(${params.secondaryHue}, 50%, 50%, 0.1)`;
        ctx.fillRect(x, y, 50, 50);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    resolve(dataUrl.split(',')[1]);
  });
}

export async function generateLocalSpeech(text: string): Promise<{ audioData: string; duration: number }> {
    // Direct call to dispatchToWorker, which will handle worker vs main thread
    try {
        const data = await dispatchToWorker('GENERATE_SPEECH', { text });
        const wavBuffer = encodeWAV(data.audio, data.sampling_rate);
        return {
            audioData: arrayBufferToBase64(wavBuffer),
            duration: data.audio.length / data.sampling_rate
        };
    } catch (e) {
        console.warn("[LocalMediaService] Local speech generation failed, returning empty audio data.", e);
        return { audioData: "", duration: 0 };
    }
}

export async function distortLocalImage(imageB64: string): Promise<string> {
  return imageB64; // Placeholder
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  // Fix: Use writeString to write the 'fmt ' chunk ID
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