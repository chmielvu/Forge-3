
import { pipeline } from '@xenova/transformers';

// Singleton for TTS pipeline
let ttsSynthesizer: any = null;

const getSynthesizer = async () => {
  if (!ttsSynthesizer) {
    console.log("[LocalMedia] Loading Transformers.js TTS...");
    // Initialize the pipeline
    ttsSynthesizer = await pipeline('text-to-speech', 'Xenova/speecht5_tts', { quantized: true });
  }
  return ttsSynthesizer;
};

/**
 * Generates an abstract visual representation using HTML5 Canvas.
 * Zero API cost, instant generation.
 */
export async function generateLocalImage(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        resolve(''); // Fail gracefully
        return;
    }

    // Deterministic "art" based on prompt hash
    const hash = prompt.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    const hue = Math.abs(hash) % 360;

    // Background
    ctx.fillStyle = `hsl(${hue}, 20%, 10%)`;
    ctx.fillRect(0, 0, 512, 512);

    // Procedural Shapes (The "Forge" Aesthetic)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 15; i++) {
      const x = ((Math.sin(hash + i) + 1) / 2) * 512;
      const y = ((Math.cos(hash * i) + 1) / 2) * 512;
      const s = (Math.sin(i) * 50) + 100;
      
      ctx.fillStyle = `hsla(${hue + (i * 20)}, 60%, 50%, 0.1)`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = `hsla(${hue}, 80%, 80%, 0.2)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - s/2, y - s/2, s, s);
    }

    // Text Overlay (Debug/Style)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px monospace';
    ctx.fillText("FORGE_LITE :: LOCAL_RENDER", 20, 20);
    ctx.fillText(`HASH: ${hash.toString(16).toUpperCase()}`, 20, 35);

    // Resolve as base64 without prefix (Gemini service expects raw base64 often, but checking consumers)
    // The consumers usually expect `data:image/...` or raw. geminiMediaService returns raw base64.
    // toDataURL returns `data:image/png;base64,.....`
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    resolve(dataUrl.split(',')[1]);
  });
}

/**
 * Generates speech using on-device Transformers.js (SpeechT5).
 */
export async function generateLocalSpeech(text: string): Promise<{ audioData: string; duration: number }> {
  try {
    const synthesizer = await getSynthesizer();
    // Speaker embeddings for 'slt' (CMU Arctic) - usually default or fetched
    const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
    
    const result = await synthesizer(text, { speaker_embeddings });
    
    // Transformers.js returns Float32Array audio, convert to WAV/Base64
    // result.audio is Float32Array, result.sampling_rate is number
    const wavBuffer = encodeWAV(result.audio, result.sampling_rate);
    const base64 = arrayBufferToBase64(wavBuffer);
    
    return {
      audioData: base64,
      duration: result.audio.length / result.sampling_rate
    };
  } catch (e) {
    console.error("[LocalMedia] TTS Failed:", e);
    // Fallback stub if transformers fails
    return { audioData: '', duration: 0 };
  }
}

/**
 * Applies distortion effects via Canvas pixel manipulation.
 */
export async function distortLocalImage(imageB64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageB64); return; }
      
      // Draw original
      ctx.drawImage(img, 0, 0);
      
      // Apply "Glitch" - Red Shift & Noise
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const amount = 30; 

      for (let i = 0; i < data.length; i += 4) {
        // Randomly shift red channel
        if (Math.random() < 0.2) {
           data[i] = Math.min(255, data[i] + amount); 
        }
        // Scanline effect
        const row = Math.floor((i / 4) / canvas.width);
        if (row % 4 === 0) {
            data[i] *= 0.8;
            data[i+1] *= 0.8;
            data[i+2] *= 0.8;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.onerror = () => resolve(imageB64);
    img.src = `data:image/jpeg;base64,${imageB64}`;
  });
}

// Helpers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  
  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  
  // data subchunk
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
