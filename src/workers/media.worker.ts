
import { pipeline, env } from '@xenova/transformers';

// Skip local model checks to speed up startup if models are cached
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton pipelines
let ttsPipeline: any = null;
let sentimentPipeline: any = null;

// Initialize pipelines lazily
async function getTTS() {
    if (!ttsPipeline) {
        console.log("[Worker] Loading SpeechT5 (Quantized)...");
        ttsPipeline = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
            quantized: true, // Crucial for Lite Mode (reduces VRAM/RAM usage)
            progress_callback: (x: any) => self.postMessage({ type: 'progress', data: x })
        });
    }
    return ttsPipeline;
}

async function getSentiment() {
    if (!sentimentPipeline) {
        console.log("[Worker] Loading DistilBERT for local critique...");
        // 60MB model - instant inference for narrative tone checking
        sentimentPipeline = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
            quantized: true
        });
    }
    return sentimentPipeline;
}

self.onmessage = async (e) => {
    const { type, payload, id } = e.data;

    try {
        if (type === 'GENERATE_SPEECH') {
            const synthesizer = await getTTS();
            const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
            
            const result = await synthesizer(payload.text, { speaker_embeddings });
            
            self.postMessage({
                type: 'RESULT',
                id,
                payload: {
                    audio: result.audio, // Float32Array
                    sampling_rate: result.sampling_rate
                }
            });
        } else if (type === 'ANALYZE_SENTIMENT') {
            const classifier = await getSentiment();
            const result = await classifier(payload.text);
            
            self.postMessage({
                type: 'RESULT',
                id,
                payload: result // [{ label: 'POSITIVE', score: 0.9 }]
            });
        }
    } catch (err: any) {
        self.postMessage({ type: 'ERROR', id, error: err.message });
    }
};
