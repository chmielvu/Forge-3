import { pipeline, env } from '@xenova/transformers';

// Configuration
env.allowLocalModels = true;
env.useBrowserCache = true;

let llamaGenerator: any = null;
let qwenSummarizer: any = null; // For tone check and summarization

// Helper for chatty models
function extractJSON(text: string) {
    try {
        // Find the first and last curly braces to robustly extract JSON
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

async function initLlama() {
    if (!llamaGenerator) {
        self.postMessage({ type: 'status', payload: "Initializing Llama-3.2-1B-Instruct..." });
        try {
            llamaGenerator = await pipeline('text-generation', 'Xenova/Llama-3.2-1B-Instruct', { 
                device: 'webgpu',
                dtype: 'q4' 
            } as any);
        } catch (e) {
            self.postMessage({ type: 'status', payload: "WebGPU failed for Llama, falling back to WASM" });
            llamaGenerator = await pipeline('text-generation', 'Xenova/Llama-3.2-1B-Instruct', { 
                device: 'wasm',
                dtype: 'q8' 
            } as any);
        }
        self.postMessage({ type: 'status', payload: "Llama-3.2-1B-Instruct initialized." });
    }
}

async function initQwen() {
    if (!qwenSummarizer) {
        self.postMessage({ type: 'status', payload: "Initializing Qwen-0.5B-Chat-AWQ..." });
        try {
            qwenSummarizer = await pipeline('text2text-generation', 'Xenova/Qwen1.5-0.5B-Chat-AWQ', {
                device: 'webgpu',
                dtype: 'q4'
            } as any);
        } catch (e) {
            self.postMessage({ type: 'status', payload: "WebGPU failed for Qwen, falling back to WASM" });
            qwenSummarizer = await pipeline('text2text-generation', 'Xenova/Qwen1.5-0.5B-Chat-AWQ', {
                device: 'wasm',
                dtype: 'q8'
            } as any);
        }
        self.postMessage({ type: 'status', payload: "Qwen-0.5B-Chat-AWQ initialized." });
    }
}


self.onmessage = async (e: MessageEvent) => {
    const { type, id, payload } = e.data;

    try {
        switch (type) {
            case 'ANALYZE_TONE': { // Qwen for Tone Check
                await initQwen();
                const prompt = `<|system|>You are a narrative critic for 'The Forge's Loom'. Your task is to analyze if the following text maintains a 'DARK' (clinical, cynical, gothic, sensual) tone, or if it deviates to 'LIGHT' (wholesome, melodramatic). Respond ONLY with JSON: { "isApproved": true | false, "reason": "string" }<|user|>${payload.text}<|assistant|>`;
                const output = await qwenSummarizer(prompt, { max_new_tokens: 50, do_sample: false });
                const json = extractJSON(output[0].generated_text);
                self.postMessage({ type: 'RESULT', id, payload: json || { isApproved: true, reason: "Tone check inconclusive, defaulting to approved." } });
                break;
            }
            case 'SUMMARIZE': { // Qwen for Summarization
                await initQwen();
                const prompt = `<|system|>You are a concise summarizer. Summarize the following text in 50 words or less.<|user|>${payload.text}<|assistant|>`;
                const output = await qwenSummarizer(prompt, { max_new_tokens: 50, do_sample: false });
                self.postMessage({ type: 'RESULT', id, payload: output[0].generated_text });
                break;
            }
            case 'REPAIR_JSON': { // Llama for JSON Repair
                await initLlama();
                // Provide context for JSON structure expectation to help LLM
                const repairPrompt = `<|system|>You are a JSON repair bot. You will be given a malformed JSON string that is expected to conform to the following structure (example, not exact):
{
  "meta_analysis": { "selected_engine": "PROTOCOL", "player_psych_profile": "Error" },
  "reasoning_graph": { "nodes": [], "selected_path": [] },
  "narrative_text": "...",
  "visual_prompt": "...",
  "choices": ["...", "..."],
  "prefect_simulations": []
}
Your task is to fix the malformed JSON string and return ONLY the valid JSON, ensuring it fits a similar narrative structure. If you cannot parse it, try to return an empty but valid JSON structure for fallback.
<|user|>Fix this JSON: ${payload.jsonString}<|assistant|>`;
                const output = await llamaGenerator(repairPrompt, { max_new_tokens: 512, return_full_text: false, do_sample: false });
                const repairedJson = extractJSON(output[0].generated_text);
                if (!repairedJson) throw new Error("JSON repair failed to produce valid JSON.");
                self.postMessage({ type: 'RESULT', id, payload: JSON.stringify(repairedJson) });
                break;
            }
            case 'ANALYZE_INTENT': { // Llama for Intent Analysis
                await initLlama();
                const prompt = `<|system|>You are a Psychologist. Analyze the INPUT.
Output JSON:
{
  "intent": "submission" | "defiance" | "fear" | "flirtation" | "neutral",
  "subtext": "genuine" | "sarcastic" | "broken" | "manipulative" | "ambiguous",
  "intensity": 1-10
}
<|user|>
INPUT: "${payload.text}"
<|assistant|>`;
                const output = await llamaGenerator(prompt, { 
                    max_new_tokens: 128,
                    return_full_text: false,
                    do_sample: false // Deterministic
                });
                const json = extractJSON(output[0].generated_text) || { intent: "neutral", subtext: "ambiguous", intensity: 5 };
                self.postMessage({ type: 'RESULT', id, payload: json });
                break;
            }
            case 'GENERATE_SPEECH': {
                // Placeholder for local speech synthesis - improved dummy generation
                const text = payload.text;
                const sampleRate = 24000; // Consistent with Gemini
                const durationPerChar = 0.08; // Average 80ms per character
                const duration = Math.max(0.5, text.length * durationPerChar); // Min 0.5s, max ~8s for 100 chars
                const frameCount = sampleRate * duration;
                const audioBuffer = new Float32Array(frameCount);

                // Simple sine wave + noise for dummy output, for a more "voice-like" sound
                const frequency = 120; // Base frequency (Hz)
                const noiseFactor = 0.1; // Amount of noise
                const amplitude = 0.2; // Max amplitude

                for (let i = 0; i < frameCount; i++) {
                    const t = i / sampleRate;
                    const sineWave = amplitude * Math.sin(2 * Math.PI * frequency * t);
                    const noise = (Math.random() * 2 - 1) * noiseFactor;
                    audioBuffer[i] = sineWave + noise;
                }

                self.postMessage({ type: 'RESULT', id, payload: { audio: audioBuffer, sampling_rate: sampleRate } });
                break;
            }
            default:
                self.postMessage({ type: 'ERROR', id, error: `Unknown message type: ${type}` });
        }
    } catch (err: any) {
        self.postMessage({ type: 'ERROR', id, error: `Worker processing error for type ${type}: ${err.message}` });
    }
};

export {};