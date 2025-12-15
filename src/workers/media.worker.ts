
import { pipeline, env } from '@xenova/transformers';

// SKIP LOCAL CHECKS (Critical for browser speed)
env.allowLocalModels = false;
env.useBrowserCache = true;

// --- SINGLETON PIPELINES ---
let ttsPipeline: any = null;       // Speech
let aesthetePipeline: any = null;  // Qwen 0.5B (Tone/Vibe)
let gruntPipeline: any = null;     // SmolLM2 135M (JSON/Summary)
let empathPipeline: any = null;    // Llama 3.2 1B (Intent/Telemetry)

// --- LAZY LOADERS ---

async function getTTS() {
    if (!ttsPipeline) {
        self.postMessage({ type: 'status', payload: 'Loading Neural Voice...' });
        ttsPipeline = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
            quantized: true,
            progress_callback: (x: any) => self.postMessage({ type: 'progress', data: x })
        });
    }
    return ttsPipeline;
}

async function getAesthete() {
    if (!aesthetePipeline) {
        self.postMessage({ type: 'status', payload: 'Loading Aesthete (Qwen 0.5B)...' });
        aesthetePipeline = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat', {
            dtype: 'q8', 
            device: 'webgpu',
        } as any);
    }
    return aesthetePipeline;
}

async function getGrunt() {
    if (!gruntPipeline) {
        self.postMessage({ type: 'status', payload: 'Loading Grunt (SmolLM 135M)...' });
        gruntPipeline = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-135M-Instruct', {
            dtype: 'q8',
            device: 'webgpu',
        } as any);
    }
    return gruntPipeline;
}

async function getEmpath() {
    if (!empathPipeline) {
        self.postMessage({ type: 'status', payload: 'Loading Empath (Llama 3.2 1B)...' });
        // Using Llama 3.2 1B Instruct for advanced telemetry
        empathPipeline = await pipeline('text-generation', 'Xenova/Llama-3.2-1B-Instruct', {
            dtype: 'q4', // Aggressive quantization for browser
            device: 'webgpu',
        } as any);
    }
    return empathPipeline;
}

// --- MAIN EVENT LOOP ---

self.onmessage = async (e) => {
    const { type, payload, id } = e.data;

    try {
        switch (type) {
            // 1. SPEECH SYNTHESIS
            case 'GENERATE_SPEECH': {
                const synthesizer = await getTTS();
                const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
                const result = await synthesizer(payload.text, { speaker_embeddings });
                self.postMessage({
                    type: 'RESULT',
                    id,
                    payload: {
                        audio: result.audio,
                        sampling_rate: result.sampling_rate
                    }
                });
                break;
            }

            // 2. TONE ANALYSIS (The Aesthete)
            case 'ANALYZE_TONE': {
                const generator = await getAesthete();
                const messages = [
                    { role: 'system', content: `Analyze tone. Options: DARK (Horror/Clinical), LIGHT (Hope/Safety). One word.` },
                    { role: 'user', content: `Text: "${payload.text.slice(0, 500)}"` }
                ];
                const output = await generator(messages, { max_new_tokens: 5, temperature: 0.1 });
                const gen = output[0].generated_text;
                const responseText = Array.isArray(gen) ? gen[gen.length - 1]?.content : JSON.stringify(gen);
                const isDark = responseText.toUpperCase().includes("DARK");
                self.postMessage({ type: 'RESULT', id, payload: { isApproved: isDark, reason: responseText } });
                break;
            }

            // 3. INTENT TELEMETRY (The Empath - Llama 3.2)
            case 'ANALYZE_INTENT': {
                const generator = await getEmpath();
                const input = payload.text.slice(0, 300);
                const messages = [
                    { role: 'system', content: `Analyze the user's input.
Return JSON ONLY: { "intent": "submission" | "defiance" | "fear" | "neutral", "subtext": "sarcastic" | "genuine" | "desperate", "intensity": 1-10 }` },
                    { role: 'user', content: `Input: "${input}"` }
                ];
                
                const output = await generator(messages, { 
                    max_new_tokens: 100, 
                    temperature: 0.1,
                    do_sample: false
                });
                
                const gen = output[0].generated_text;
                const responseText = Array.isArray(gen) ? gen[gen.length - 1]?.content : "";
                
                // Extract JSON from response
                let result = { intent: 'neutral', subtext: 'genuine', intensity: 5 };
                try {
                    const match = responseText.match(/\{.*\}/s);
                    if (match) {
                        result = JSON.parse(match[0]);
                    }
                } catch (e) {
                    console.warn("Llama JSON parse failed", e);
                }
                
                self.postMessage({ type: 'RESULT', id, payload: result });
                break;
            }

            // 4. JSON REPAIR (The Grunt)
            case 'REPAIR_JSON': {
                try {
                    const clean = payload.jsonString.replace(/```json|```/g, '').trim();
                    JSON.parse(clean); 
                    self.postMessage({ type: 'RESULT', id, payload: clean });
                    return;
                } catch(e) {}

                const generator = await getGrunt();
                const messages = [
                    { role: 'system', content: "Fix this JSON string." },
                    { role: 'user', content: payload.jsonString }
                ];
                const output = await generator(messages, { max_new_tokens: 1024, temperature: 0.1 });
                const genText = output[0].generated_text;
                const fixed = genText[genText.length - 1].content;
                self.postMessage({ type: 'RESULT', id, payload: fixed });
                break;
            }

            // 5. SUMMARIZATION (The Grunt)
            case 'SUMMARIZE': {
                const generator = await getGrunt();
                const messages = [
                    { role: 'user', content: `Summarize:\n\n${payload.text}` }
                ];
                const output = await generator(messages, { max_new_tokens: 200, temperature: 0.3 });
                const genText = output[0].generated_text;
                const summary = genText[genText.length - 1].content;
                self.postMessage({ type: 'RESULT', id, payload: summary });
                break;
            }
        }
    } catch (err: any) {
        console.error(`[Worker Error] ${type}:`, err);
        self.postMessage({ type: 'ERROR', id, error: err.message });
    }
};
