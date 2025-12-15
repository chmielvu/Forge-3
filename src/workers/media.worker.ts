
import { pipeline, env } from '@xenova/transformers';

// SKIP LOCAL CHECKS (Critical for browser speed)
env.allowLocalModels = false;
env.useBrowserCache = true;

// --- SINGLETON PIPELINES ---
let ttsPipeline: any = null;       // Speech
let aesthetePipeline: any = null;  // Qwen 0.5B (Tone/Vibe)
let gruntPipeline: any = null;     // SmolLM2 135M (JSON/Summary)

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
        // Qwen 0.5B Chat - The smartest "small" model for nuanced tone
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
        // SmolLM2 - The fastest instruction follower for mechanical tasks
        gruntPipeline = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-135M-Instruct', {
            dtype: 'q8',
            device: 'webgpu',
        } as any);
    }
    return gruntPipeline;
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
                
                // Prompt Engineering for Qwen
                // We force it to act as a literary critic
                const messages = [
                    { role: 'system', content: `Analyze the tone.
Options:
- DARK (Horror, cynicism, violence, clinical detachment, dark humor)
- LIGHT (Hope, joy, melodrama, wholesomeness, safety)
Answer with one word.` },
                    { role: 'user', content: `Text: "${payload.text.slice(0, 500)}"` }
                ];

                const output = await generator(messages, { 
                    max_new_tokens: 5,
                    temperature: 0.1, // Deterministic
                    do_sample: false
                });
                
                // Parse response (Qwen output format)
                // Qwen output is usually in the last generated message content
                let responseText = "";
                if (output && output[0] && output[0].generated_text) {
                    const gen = output[0].generated_text;
                    if (Array.isArray(gen)) {
                        responseText = gen[gen.length - 1]?.content || "";
                    } else {
                        // fallback if structure differs
                        responseText = JSON.stringify(gen);
                    }
                }
                
                const isDark = responseText.toUpperCase().includes("DARK");
                
                self.postMessage({ type: 'RESULT', id, payload: { isApproved: isDark, reason: responseText } });
                break;
            }

            // 3. JSON REPAIR (The Grunt)
            case 'REPAIR_JSON': {
                // Heuristic First (Zero Cost)
                try {
                    const clean = payload.jsonString.replace(/```json|```/g, '').trim();
                    JSON.parse(clean); 
                    self.postMessage({ type: 'RESULT', id, payload: clean });
                    return;
                } catch(e) {}

                // Neural Fallback
                const generator = await getGrunt();
                const messages = [
                    { role: 'system', content: "You are a JSON repair tool. Output only the valid JSON string. No markdown." },
                    { role: 'user', content: `Fix this broken JSON:\n${payload.jsonString}` }
                ];
                const output = await generator(messages, { max_new_tokens: 1024, temperature: 0.1 });
                const genText = output[0].generated_text;
                const fixed = genText[genText.length - 1].content;
                self.postMessage({ type: 'RESULT', id, payload: fixed });
                break;
            }

            // 4. SUMMARIZATION (The Grunt)
            case 'SUMMARIZE': {
                const generator = await getGrunt();
                const messages = [
                    { role: 'user', content: `Summarize this narrative log into one dense paragraph of lore:\n\n${payload.text}` }
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
