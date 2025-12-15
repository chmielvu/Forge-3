
// Worker Instance Singleton
let mediaWorker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: Function, reject: Function }>();

function getWorker() {
    if (!mediaWorker) {
        // Safe check for import.meta.url availability
        const metaUrl = import.meta.url;
        if (!metaUrl) {
            console.error("[LocalMediaService] Worker initialization failed: import.meta.url is undefined");
            return null;
        }

        try {
            // Initialize worker using standard Vite syntax
            mediaWorker = new Worker(new URL('../workers/media.worker.ts', metaUrl), { type: 'module' });
            
            mediaWorker.onmessage = (e) => {
                const { type, id, payload, error } = e.data;
                
                if (type === 'RESULT' && pendingRequests.has(id)) {
                    pendingRequests.get(id)!.resolve(payload);
                    pendingRequests.delete(id);
                } else if (type === 'ERROR' && pendingRequests.has(id)) {
                    pendingRequests.get(id)!.reject(new Error(error));
                    pendingRequests.delete(id);
                } else if (type === 'progress') {
                    // Optional: handle progress updates
                    // console.debug('[Worker Progress]', payload);
                } else if (type === 'status') {
                    console.log(`[Worker Status] ${payload}`);
                }
            };
            
            mediaWorker.onerror = (e) => {
                console.error("[LocalMediaService] Worker Error:", e);
                // Clean up worker on critical error
                mediaWorker = null;
            };

        } catch (e) {
            console.error("[LocalMediaService] Failed to construct worker:", e);
            mediaWorker = null;
        }
    }
    return mediaWorker;
}

// Generic Dispatcher
async function dispatchToWorker(type: string, payload: any, timeoutMs = 45000): Promise<any> {
    const worker = getWorker();
    if (!worker) throw new Error("Worker unavailable");

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

// --- VISUAL ANALYSIS HELPERS (Kept on main thread as they are lightweight canvas ops) ---

interface VisualParams {
  baseHue: number;
  secondaryHue: number;
  saturation: number;
  lightness: number;
  chaos: number; // 0.0 to 1.0 - determines shape irregularity
  darkness: number; // 0.0 to 1.0 - determines background depth
  shapes: 'organic' | 'geometric' | 'jagged' | 'void';
  composition: 'center' | 'bottom-heavy' | 'top-heavy' | 'scattered';
  texture: 'grain' | 'scratch' | 'liquid' | 'scanline';
}

function analyzePrompt(prompt: string): VisualParams {
  const lower = prompt.toLowerCase();
  
  // Default: Dark, moody, slight amber tint (The Forge default)
  const params: VisualParams = {
    baseHue: 30, // Amber/Orange
    secondaryHue: 0, // Red
    saturation: 60,
    lightness: 20,
    chaos: 0.3,
    darkness: 0.8,
    shapes: 'geometric',
    composition: 'center',
    texture: 'grain'
  };

  // 1. Color Analysis
  if (lower.match(/blood|pain|rage|red|crimson|flesh|wound/)) {
    params.baseHue = 350; // Crimson
    params.secondaryHue = 20;
    params.saturation = 80;
    params.chaos += 0.3;
    params.texture = 'scratch';
  } else if (lower.match(/cold|clinical|blue|cyan|freeze|ice|sterile|lab/)) {
    params.baseHue = 200; // Cyan/Blue
    params.secondaryHue = 240;
    params.saturation = 40;
    params.lightness = 30; // Brighter/Sterile
    params.darkness = 0.4;
    params.texture = 'scanline';
  } else if (lower.match(/sick|toxic|green|poison|envy|rot/)) {
    params.baseHue = 120; // Green
    params.secondaryHue = 60; // Yellow
    params.chaos += 0.3;
    params.texture = 'liquid';
  } else if (lower.match(/void|shadow|dark|abyss|black|nothing/)) {
    params.saturation = 10;
    params.lightness = 10;
    params.darkness = 0.95;
    params.secondaryHue = 270; // Purple tint
    params.shapes = 'void';
  } else if (lower.match(/flesh|skin|touch|warm|intimate|desire/)) {
    params.baseHue = 25; // Skin tones/Warmth
    params.secondaryHue = 340; // Pinkish
    params.lightness = 40;
    params.shapes = 'organic';
    params.texture = 'liquid';
  }

  // 2. Emotion/Chaos & Shape Analysis
  if (lower.match(/scream|chaos|fracture|broken|shatter|panic|violence/)) {
    params.chaos = 0.9;
    params.shapes = 'jagged';
    params.texture = 'scratch';
  } else if (lower.match(/calm|still|quiet|silence|order|perfect/)) {
    params.chaos = 0.1;
    params.shapes = 'geometric';
  } else if (lower.match(/soft|gentle|love|tears|weep|comfort/)) {
    params.chaos = 0.4;
    params.shapes = 'organic';
  }

  // 3. Composition Analysis
  if (lower.match(/kneel|floor|down|bow|heavy|collapse/)) {
    params.composition = 'bottom-heavy';
  } else if (lower.match(/loom|tower|up|above|god|ceiling/)) {
    params.composition = 'top-heavy';
  } else if (lower.match(/surround|everywhere|swarm|many/)) {
    params.composition = 'scattered';
  } else {
    params.composition = 'center';
  }

  return params;
}

/**
 * Generates an abstract visual representation using HTML5 Canvas.
 * Context-aware based on prompt keywords.
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

    // 1. Parse Context
    const params = analyzePrompt(prompt);
    const hash = prompt.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    
    // 2. Render Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 512);
    // Adjust gradient direction based on composition
    if (params.composition === 'top-heavy') {
        bgGradient.addColorStop(0, `hsl(${params.baseHue}, ${params.saturation}%, ${Math.max(10, params.lightness)}%)`);
        bgGradient.addColorStop(1, `rgba(0,0,0,1)`);
    } else if (params.composition === 'bottom-heavy') {
        bgGradient.addColorStop(0, `rgba(0,0,0,1)`);
        bgGradient.addColorStop(1, `hsl(${params.baseHue}, ${params.saturation}%, ${Math.max(10, params.lightness)}%)`);
    } else {
        bgGradient.addColorStop(0, `hsl(${params.baseHue}, ${params.saturation}%, ${Math.max(5, params.lightness - 10)}%)`);
        bgGradient.addColorStop(1, `hsl(${params.secondaryHue}, ${params.saturation}%, ${Math.max(0, params.lightness - 20)}%)`);
    }
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Dark overlay for "Noir" feel
    ctx.fillStyle = `rgba(0, 0, 0, ${params.darkness})`;
    ctx.fillRect(0, 0, 512, 512);

    // 3. Render Procedural Shapes
    ctx.globalCompositeOperation = 'screen'; // Use screen/lighter for glowing effect
    const numShapes = 10 + Math.floor(params.chaos * 40);
    
    for (let i = 0; i < numShapes; i++) {
      // Deterministic pseudo-random positions based on hash + index
      const r1 = Math.abs(Math.sin(hash + i));
      const r2 = Math.abs(Math.cos(hash * i));
      const r3 = Math.abs(Math.sin(hash * i * 2));
      
      let x = r1 * 512;
      let y = r2 * 512;
      const size = (r3 * 150) + 20;

      // Adjust Position based on Composition
      if (params.composition === 'center') {
          // Biased towards center
          x = (x + 256) / 2;
          y = (y + 256) / 2;
      } else if (params.composition === 'bottom-heavy') {
          y = 256 + (r2 * 256); // Lower half
      } else if (params.composition === 'top-heavy') {
          y = r2 * 256; // Upper half
      }
      
      const shapeHue = i % 3 === 0 ? params.baseHue : params.secondaryHue;
      const opacity = (0.1 + (r1 * 0.2)) * (1 - params.darkness * 0.5); 
      
      ctx.fillStyle = `hsla(${shapeHue}, ${params.saturation}%, 50%, ${opacity})`;
      ctx.strokeStyle = `hsla(${shapeHue}, ${params.saturation}%, 70%, ${opacity * 1.5})`;
      ctx.lineWidth = 1 + (params.chaos * 3);

      ctx.beginPath();
      
      if (params.shapes === 'organic' || params.shapes === 'void') {
        // Circles and Blobs
        ctx.arc(x, y, size, 0, Math.PI * 2);
      } else if (params.shapes === 'jagged') {
        // Sharp triangles / lines
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r2 * 100) - 50, y + (r3 * 100) - 50);
        ctx.lineTo(x + (r1 * 100) - 50, y + (r2 * 100) - 50);
        ctx.closePath();
      } else {
        // Geometric Rectangles/Lines
        const w = size;
        const h = size * (r3 + 0.5); // Variable aspect ratio
        ctx.rect(x - w/2, y - h/2, w, h);
      }
      
      ctx.fill();
      // Randomly stroke some shapes for definition
      if (r3 > 0.5) ctx.stroke();
    }

    // 4. Apply Textures
    ctx.globalCompositeOperation = 'overlay';
    
    // Scanlines
    if (params.texture === 'scanline' || params.texture === 'grain') {
        for (let y = 0; y < 512; y += 4) {
            ctx.fillStyle = `rgba(0,0,0,${0.2 + (params.chaos * 0.1)})`;
            ctx.fillRect(0, y, 512, 1);
        }
    }

    // Scratches / Noise
    if (params.texture === 'scratch' || params.texture === 'grain') {
       for(let k=0; k<100; k++) {
           const sx = Math.random() * 512;
           const sy = Math.random() * 512;
           ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
           ctx.fillRect(sx, sy, Math.random() * 2, Math.random() * 20);
       }
    }

    // 5. Text Overlay (Contextual Debug - The "Terminal" Look)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px monospace';
    ctx.fillText(`FORGE_RENDER :: [${params.shapes.toUpperCase()}]`, 20, 480);
    ctx.fillText(`COMPOSITION :: ${params.composition.toUpperCase()}`, 20, 492);
    ctx.fillText(`PALETTE :: ${params.baseHue}/${params.secondaryHue}`, 20, 504);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    resolve(dataUrl.split(',')[1]);
  });
}

/**
 * Optimally generates speech using the off-main-thread worker.
 */
export async function generateLocalSpeech(text: string): Promise<{ audioData: string; duration: number }> {
    const worker = getWorker();
    
    // If worker failed to initialize, return empty result to skip processing gracefully
    if (!worker) {
        console.warn("[LocalMediaService] Skipping speech gen: Worker unavailable.");
        // Return valid but empty object to prevent downstream errors
        return { audioData: "", duration: 0 };
    }

    try {
        const data = await dispatchToWorker('GENERATE_SPEECH', { text });
        // Convert Float32Array to WAV (Base64) for HTML5 Audio
        const wavBuffer = encodeWAV(data.audio, data.sampling_rate);
        return {
            audioData: arrayBufferToBase64(wavBuffer),
            duration: data.audio.length / data.sampling_rate
        };
    } catch (e) {
        console.error("Local Speech Gen failed", e);
        return { audioData: "", duration: 0 };
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
