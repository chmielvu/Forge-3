import { pipeline, env } from '@xenova/transformers';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning'; 
import { GoogleGenAI } from "@google/genai";
import { PrefectDNA } from '../types';

// --- API CONFIGURATION ---
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
const LITE_MODEL = 'gemini-2.5-flash';

// --- WORKER SETUP (KEPT FOR AUDIO/CANVAS ONLY) ---
// Worker Instance Singleton
let mediaWorker: Worker | null = null;
// Track worker availability status: null (unknown), true (available), false (unavailable/disabled)
let workerAvailable: boolean | null = null; 

// Stores pending worker requests, keyed by a unique ID
const pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }>();

function getWorker(): Worker | null {
    // If TEST_MODE is active, explicitly disable workers.
    if (BEHAVIOR_CONFIG.TEST_MODE) {
        if (workerAvailable !== false) { 
            workerAvailable = false;
        }
        return null;
    }

    if (workerAvailable === false) return null;

    if (!mediaWorker) {
        try {
            // Attempt to create worker with robust URL handling
            const workerUrl = new URL('../workers/media.worker.ts', import.meta.url);
            mediaWorker = new Worker(workerUrl.href, {
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
                }
            };
            
            mediaWorker.onerror = (e) => {
                console.error("[LocalMediaService] Worker Error:", e);
                workerAvailable = false; 
                mediaWorker = null; 
                pendingRequests.forEach(req => req.reject(new Error("Worker crashed unexpectedly.")));
                pendingRequests.clear();
            };
            workerAvailable = true; 
        } catch (e) {
            console.error("[LocalMediaService] Failed to construct worker (falling back to main thread):", e);
            workerAvailable = false; 
            mediaWorker = null; 
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

// --- MAIN THREAD FALLBACK IMPLEMENTATIONS ---
async function executeOnMainThread(type: string, payload: any): Promise<any> {
    switch (type) {
        case 'GENERATE_SPEECH': {
            const text = payload.text;
            const sampleRate = 24000;
            const durationPerChar = 0.08;
            const duration = Math.max(0.5, text.length * durationPerChar);
            const frameCount = sampleRate * duration;
            const audioBuffer = new Float32Array(frameCount);
            for (let i = 0; i < frameCount; i++) {
                audioBuffer[i] = (Math.random() * 0.1 - 0.05); 
            }
            return { audio: audioBuffer, sampling_rate: sampleRate };
        }
        default:
            // For logic tasks, we now use API, so main thread fallback is minimal/unused
            return null;
    }
}

// --- GEMINI LITE HELPERS ---

async function callGeminiLite(prompt: string, jsonMode = false): Promise<string> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing for Gemini Lite");

    try {
        const ai = getAI();
        const config = jsonMode ? { responseMimeType: 'application/json' } : {};
        const response = await ai.models.generateContent({
            model: LITE_MODEL,
            contents: prompt,
            config
        });
        return response.text || "";
    } catch (e) {
        console.warn("[LocalMediaService] Gemini Lite call failed:", e);
        throw e;
    }
}

// --- INTELLIGENCE API (Replaces Local Grunt Worker) ---
export const localGrunt = {
    async checkTone(text: string): Promise<boolean> {
        try {
            const result = await callGeminiLite(
                `Analyze the tone of this text. It should be DARK (clinical, cynical, gothic, sensual). If it is LIGHT (wholesome, melodramatic, cheerful), reject it.
                Text: "${text.substring(0, 500)}"
                Return JSON: { "isApproved": boolean, "reason": "string" }`,
                true
            );
            const parsed = JSON.parse(result);
            return parsed.isApproved;
        } catch (e) {
            console.warn("[Local Service] Tone check failed, defaulting true.");
            return true; 
        }
    },
    async summarizeHistory(text: string): Promise<string> {
        try {
            return await callGeminiLite(`Summarize this narrative text in less than 50 words, focusing on key events and tension:\n"${text}"`);
        } catch (e) {
            return text.substring(0, 100) + "...";
        }
    },
    async repairJson(jsonString: string): Promise<string> {
        try {
            const repaired = await callGeminiLite(
                `You are a JSON repair engine. Fix this malformed JSON string and return ONLY the valid JSON object. No markdown.
                
                Input:
                ${jsonString}`,
                true
            );
            return repaired;
        } catch (e) {
            console.error("Critical JSON Repair Failed:", e);
            // Last ditch fallback: empty valid state
            return JSON.stringify({ 
                narrative_text: "System Error: Narrative Matrix Corrupted.", 
                choices: ["Reboot", "Wait"],
                reasoning_graph: { nodes: [], selected_path: [] },
                meta_analysis: { selected_engine: "ERROR", player_psych_profile: "Unknown" }
            });
        }
    },
    // --- NEW: THE CRITIC (Quality Control) ---
    async runCritic(narrative: string): Promise<{ score: number, violations: string[] }> {
        try {
            const result = await callGeminiLite(`
                You are THE AESTHETE. Strict Critic Mode.
                Check for:
                1. Euphemisms (e.g. "manhood" instead of "groin").
                2. Generic emotion (e.g. "felt sad" instead of somatic "stomach dropped").
                3. Tone mismatch (Cheerfulness in a dark setting).
                
                Text: "${narrative.substring(0, 500)}"
                
                Return JSON: { "score": number (0-100), "violations": string[] }
            `, true);
            return JSON.parse(result);
        } catch (e) {
            return { score: 100, violations: [] };
        }
    },
    // --- NEW: AGENT SIMULATION (Prefects/Subjects) ---
    async simulateAgent(agent: PrefectDNA, context: string): Promise<{ internal_monologue: string, action: string }> {
        try {
            const result = await callGeminiLite(`
                Roleplay as ${agent.displayName} (${agent.archetype}).
                Traits: ${JSON.stringify(agent.traitVector)}.
                Drive: ${agent.drive}.
                Context: "${context}"
                
                What do you think and do?
                Return JSON: { "internal_monologue": "string", "action": "string" }
            `, true);
            return JSON.parse(result);
        } catch (e) {
            return { internal_monologue: "Observing.", action: "Watches silently." };
        }
    }
};

// --- EMPATH API (Replaces Llama Worker) ---
export const localMediaService = {
    async analyzeIntent(text: string): Promise<{ intent: string, subtext: string, intensity: number }> {
        try {
            const result = await callGeminiLite(
                `Analyze the player's input in a dark psychological thriller game.
                Input: "${text}"
                Return JSON:
                {
                  "intent": "submission" | "defiance" | "fear" | "flirtation" | "neutral",
                  "subtext": "genuine" | "sarcastic" | "broken" | "manipulative" | "ambiguous",
                  "intensity": 1-10
                }`,
                true
            );
            return JSON.parse(result);
        } catch (e) {
            console.warn("[LocalMediaService] Intent analysis failed, using fallback.");
            return { intent: 'neutral', subtext: 'genuine', intensity: 5 };
        }
    }
};

// --- VISUAL ANALYSIS HELPERS (Canvas Fallback) ---
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
    baseHue: 30, secondaryHue: 0, saturation: 60, lightness: 20,
    chaos: 0.3, darkness: 0.8, shapes: 'geometric', composition: 'center', texture: 'grain'
  };
  if (lower.match(/blood|pain|rage|red|crimson|flesh|wound/)) {
    params.baseHue = 350; params.secondaryHue = 20; params.saturation = 80; params.chaos += 0.3; params.texture = 'scratch';
  } else if (lower.match(/cold|clinical|blue|cyan|freeze|ice|sterile|lab/)) {
    params.baseHue = 200; params.secondaryHue = 240; params.saturation = 40; params.lightness = 30; params.darkness = 0.4; params.texture = 'scanline';
  }
  return params;
}

export async function generateLocalImage(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const performGeneration = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        const params = analyzePrompt(prompt);
        ctx.fillStyle = `hsl(${params.baseHue}, ${params.saturation}%, 10%)`;
        ctx.fillRect(0, 0, 512, 512);
        for(let k=0; k<200; k++) {
            const x = Math.random() * 512; const y = Math.random() * 512;
            ctx.fillStyle = `hsla(${params.secondaryHue}, 50%, 50%, 0.1)`;
            ctx.fillRect(x, y, 50, 50);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.split(',')[1]);
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(performGeneration);
    } else {
        setTimeout(performGeneration, 0);
    }
  });
}

// --- LOCAL SPEECH (Worker fallback for dummy audio) ---
export async function generateLocalSpeech(text: string): Promise<{ audioData: string; duration: number }> {
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
  return imageB64; 
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