
export class AudioService {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;

  constructor() {
    // Lazy initialization in getContext()
  }

  /**
   * Returns the shared Singleton AudioContext.
   * Re-initializes if the context is null or closed.
   */
  public getContext(): AudioContext {
    // Check if context is missing or closed (garbage collected or released)
    if (!this.context || this.context.state === 'closed') {
      const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtor) {
          throw new Error("Web Audio API is not supported in this browser.");
      }
      this.context = new AudioCtor({ sampleRate: 24000 });
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
   * Decodes raw PCM data (Gemini format) into an AudioBuffer.
   * This is made public for reuse in other services (e.g., mediaService.ts)
   */
  public decodePCM(base64: string): AudioBuffer {
    const ctx = this.getContext();
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
    const ctx = this.getContext();
    
    // Decode logic wrapped in try/catch for safety
    try {
        const buffer = this.decodePCM(base64Data);

        this.source = ctx.createBufferSource();
        this.source.buffer = buffer;
        
        // Apply playback rate
        this.source.playbackRate.value = playbackRate;
        
        // Ensure gain node exists and is connected
        if (!this.gainNode) {
            this.gainNode = ctx.createGain();
            this.gainNode.connect(ctx.destination);
        }
        this.source.connect(this.gainNode);
        
        this.gainNode.gain.value = volume;
        
        this.source.onended = onEnded;
        this.source.start(0, this.pausedAt); // Support resume
        this.startTime = ctx.currentTime - this.pausedAt;
        
    } catch (e) {
        console.error("Audio playback error:", e);
        onEnded(); // Trigger end callback to avoid UI hanging
    }
  }

  public stop() {
    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.source = null;
    }
    this.pausedAt = 0;
  }

  public pause() {
    if (this.context && this.source) {
      this.pausedAt = this.context.currentTime - this.startTime;
      try {
        this.source.stop();
      } catch (e) {
        // Ignore
      }
      this.source = null;
    }
  }

  public setPlaybackRate(val: number) {
    if (this.source) {
        this.source.playbackRate.value = val;
    }
  }

  // Returns precise current time for UI animation
  public getCurrentTime(): number {
    if (!this.context || !this.source) return this.pausedAt;
    return this.context.currentTime - this.startTime;
  }
}

export const audioService = new AudioService();
