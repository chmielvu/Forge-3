
import { pipeline, env } from '@xenova/transformers';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

let llamaGenerator: any = null;

// Helper for chatty models
function extractJSON(text: string) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch {
        return null;
    }
}

async function initLlama() {
    if (!llamaGenerator) {
        // Fallback strategy: WebGPU -> WASM
        try {
            llamaGenerator = await pipeline('text-generation', 'Xenova/Llama-3.2-1B-Instruct', { 
                device: 'webgpu',
                dtype: 'q4' 
            } as any);
        } catch (e) {
            console.warn("WebGPU failed, falling back to WASM");
            llamaGenerator = await pipeline('text-generation', 'Xenova/Llama-3.2-1B-Instruct', { 
                device: 'wasm',
                dtype: 'q8' 
            } as any);
        }
    }
}

self.onmessage = async (e: MessageEvent) => {
    if (e.data.type === 'ANALYZE_INTENT') { // Matched to localMediaService
        try {
            await initLlama();
            
            const prompt = `<|system|>
You are a Psychologist. Analyze the INPUT.
Output JSON:
{
  "intent": "submission" | "defiance" | "fear" | "flirtation",
  "subtext": "genuine" | "sarcastic" | "broken" | "manipulative",
  "intensity": 1-10
}
<|user|>
INPUT: "${e.data.payload.text}"
<|assistant|>`;

            const output = await llamaGenerator(prompt, { 
                max_new_tokens: 128,
                return_full_text: false,
                do_sample: false // Deterministic
            });

            const json = extractJSON(output[0].generated_text) || { intent: "neutral", subtext: "ambiguous", intensity: 5 };
            self.postMessage({ type: 'RESULT', id: e.data.id, payload: json });

        } catch (err: any) {
            self.postMessage({ type: 'ERROR', id: e.data.id, error: err.message });
        }
    }
};
