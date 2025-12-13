
export class AudioService {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;

  constructor() {
    // Lazy initialization
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
    }
    return this.context;
  }

  // Decodes raw PCM data (Gemini format)
  private decodePCM(base64: string): AudioBuffer {
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

  public async play(base64Data: string, volume: number, onEnded: () => void) {
    this.stop(); // Ensure clean slate
    const ctx = this.getContext();
    const buffer = this.decodePCM(base64Data);

    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    
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
    
    if (ctx.state === 'suspended') await ctx.resume();
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

  public setVolume(val: number) {
    if (this.gainNode) this.gainNode.gain.value = val;
  }

  // Returns precise current time for UI animation
  public getCurrentTime(): number {
    if (!this.context || !this.source) return this.pausedAt;
    return this.context.currentTime - this.startTime;
  }
}

export const audioService = new AudioService();
