
export class AudioService {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;

  // --- AMBIENT DRONE ENGINE ---
  private droneNodes: {
    source: AudioBufferSourceNode | null;
    filter: BiquadFilterNode | null;
    lfo: OscillatorNode | null;
    lfoGain: GainNode | null;
    masterGain: GainNode | null;
  } = { source: null, filter: null, lfo: null, lfoGain: null, masterGain: null };
  
  private isDronePlaying: boolean = false;

  constructor() {
    // AudioContext will now be lazily initialized in getContext()
    // No-op here
  }

  /**
   * Returns the shared Singleton AudioContext.
   * Initializes or resumes the context only after a user gesture.
   */
  public getContext(): AudioContext {
    // Check if context is missing, closed, or needs a new instance
    if (!this.context || this.context.state === 'closed') {
      const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtor) {
          throw new Error("Web Audio API is not supported in this browser.");
      }
      this.context = new AudioCtor({ sampleRate: 24000 });
      
      // Initialize gainNode here as well, since it depends on a valid context
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
    }
    
    // Always attempt to resume if suspended (common browser policy)
    if (this.context.state === 'suspended') {
      this.context.resume().catch(e => console.error("Audio Context resume failed", e));
    }
    
    return this.context;
  }

  /**
   * Generates a buffer of Brownian noise for the ambient drone.
   */
  private createBrownNoise(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 5; // 5 seconds loop
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Compensate for gain loss
    }
    return buffer;
  }

  /**
   * Starts the procedural ambient drone ("The Thrum").
   */
  public startDrone() {
    if (this.isDronePlaying) return;
    const ctx = this.getContext(); // Ensure context is initialized/resumed

    // 1. Noise Source
    const noiseBuffer = this.createBrownNoise(ctx);
    const droneSource = ctx.createBufferSource();
    droneSource.buffer = noiseBuffer;
    droneSource.loop = true;

    // 2. Low Pass Filter (Muffled atmosphere)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150; // Deep rumble start

    // 3. LFO for "Breathing" effect
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1; // Slow breath (10s cycle)
    
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 50; // Modulate filter freq by +/- 50Hz

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // 4. Master Drone Gain
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.0; // Start silent, fade in

    // Connect Graph: Source -> Filter -> Gain -> Destination
    droneSource.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(ctx.destination);

    droneSource.start();
    lfo.start();

    // Fade in
    droneGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 5);

    this.droneNodes = {
        source: droneSource,
        filter: filter,
        lfo: lfo,
        lfoGain: lfoGain,
        masterGain: droneGain
    };
    this.isDronePlaying = true;
  }

  /**
   * Modulates the drone based on game tension.
   * @param tension 0 to 100
   */
  public updateDrone(tension: number) {
      if (!this.isDronePlaying || !this.droneNodes.filter || !this.droneNodes.lfo) return;
      
      const ctx = this.getContext(); // Ensure context is initialized/resumed
      const t = Math.max(0, Math.min(100, tension)) / 100;

      // Tension increases filter cutoff (brightness/harshness)
      // Base: 100Hz -> Max: 600Hz
      const targetFreq = 100 + (t * 500); 
      this.droneNodes.filter.frequency.linearRampToValueAtTime(targetFreq, ctx.currentTime + 2);

      // Tension increases LFO speed (breathing becomes panting)
      // Base: 0.1Hz -> Max: 2.0Hz
      const targetLfo = 0.1 + (t * 2.0);
      this.droneNodes.lfo.frequency.linearRampToValueAtTime(targetLfo, ctx.currentTime + 2);
      
      // Slight volume boost with tension
      const targetGain = 0.15 + (t * 0.1);
      this.droneNodes.masterGain?.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 2);
  }

  /**
   * Triggers a momentary audio "Pulse" or "Drop" to signify somatic impact.
   * Creates a visceral low-end thud or distortion.
   */
  public triggerSomaticPulse(intensity: number = 0.5) {
      if (!this.isDronePlaying || !this.droneNodes.filter) return;
      const ctx = this.getContext(); // Ensure context is initialized/resumed
      const now = ctx.currentTime;

      // Momentary low-pass drop (The "Void" sensation)
      this.droneNodes.filter.frequency.cancelScheduledValues(now);
      this.droneNodes.filter.frequency.exponentialRampToValueAtTime(50, now + 0.1); // Drop deep
      this.droneNodes.filter.frequency.exponentialRampToValueAtTime(150, now + 2.0); // Recover slowly

      // Create a sub-bass impact
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 0.5); // Pitch drop
      
      gain.gain.setValueAtTime(0.5 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // FIX: Disconnect nodes onended to prevent memory leaks
      osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
      };

      osc.start(now);
      osc.stop(now + 1.0);
  }

  public stopDrone() {
      if (!this.isDronePlaying) return;
      const ctx = this.getContext(); // Ensure context is initialized/resumed
      
      // Fade out
      this.droneNodes.masterGain?.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      
      setTimeout(() => {
          try {
             this.droneNodes.source?.stop();
             this.droneNodes.lfo?.stop();
             this.droneNodes.source?.disconnect();
             this.droneNodes.masterGain?.disconnect();
          } catch(e) { }
          this.isDronePlaying = false;
      }, 2000);
  }

  // --- UI SFX ENGINE ---
  public playSfx(type: 'type' | 'hover' | 'click' | 'glitch' | 'boot') {
      const ctx = this.getContext(); // Ensure context is initialized/resumed
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (type) {
          case 'type': // Subtle high-pitch click
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
              gain.gain.setValueAtTime(0.02, now);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
              osc.start(now);
              osc.stop(now + 0.05);
              break;
          case 'hover': // Low tech thrum
              osc.type = 'sine';
              osc.frequency.setValueAtTime(50, now);
              gain.gain.setValueAtTime(0.0, now);
              gain.gain.linearRampToValueAtTime(0.05, now + 0.05);
              gain.gain.linearRampToValueAtTime(0.0, now + 0.2);
              osc.start(now);
              osc.stop(now + 0.2);
              break;
          case 'click': // Sharp mechanical confirm
              osc.type = 'square';
              osc.frequency.setValueAtTime(200, now);
              osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
              gain.gain.setValueAtTime(0.05, now);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
              osc.start(now);
              osc.stop(now + 0.1);
              break;
          case 'glitch': // Harsh noise burst
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(100, now);
              osc.frequency.linearRampToValueAtTime(1000, now + 0.1);
              gain.gain.setValueAtTime(0.05, now);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
              osc.start(now);
              osc.stop(now + 0.15);
              break;
          case 'boot': // Power up swell
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(50, now);
              osc.frequency.exponentialRampToValueAtTime(400, now + 1.0);
              gain.gain.setValueAtTime(0, now);
              gain.gain.linearRampToValueAtTime(0.1, now + 0.5);
              gain.gain.linearRampToValueAtTime(0, now + 1.5);
              osc.start(now);
              osc.stop(now + 1.5);
              break;
      }
  }

  /**
   * Decodes raw PCM data (Gemini format) into an AudioBuffer.
   */
  public decodePCM(base64: string): AudioBuffer {
    const ctx = this.getContext(); // Ensure context is initialized/resumed
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }

  public async play(base64Data: string, volume: number, playbackRate: number, onEnded: () => void) {
    this.stop(); // Ensure clean slate
    const ctx = this.getContext(); // Ensure context is initialized/resumed
    
    try {
        const buffer = this.decodePCM(base64Data);

        this.source = ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.playbackRate.value = playbackRate;
        
        // gainNode is now guaranteed to be set by getContext()
        if (!this.gainNode) { 
            // This case should ideally not be hit if getContext() is always called first
            this.gainNode = ctx.createGain(); 
            this.gainNode.connect(ctx.destination);
        }
        this.source.connect(this.gainNode);
        this.gainNode.gain.value = volume;
        
        this.source.onended = onEnded;
        this.source.start(0, this.pausedAt); 
        this.startTime = ctx.currentTime - this.pausedAt;
        
    } catch (e) {
        console.error("Audio playback error:", e);
        onEnded(); 
    }
  }

  public stop() {
    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    this.pausedAt = 0;
  }

  public pause() {
    if (this.context && this.source) {
      this.pausedAt = this.context.currentTime - this.startTime;
      try { this.source.stop(); } catch (e) {}
      this.source = null;
    }
  }

  public setPlaybackRate(val: number) {
    if (this.source && this.context) {
        this.source.playbackRate.setValueAtTime(val, this.context.currentTime);
    }
  }

  public getCurrentTime(): number {
    if (!this.context || !this.source) return this.pausedAt;
    return this.context.currentTime - this.startTime;
  }

  public setVolume(volume: number) {
      if (this.gainNode && this.context) {
          this.gainNode.gain.linearRampToValueAtTime(volume, this.context.currentTime + 0.1);
      }
  }
}

export const audioService = new AudioService();