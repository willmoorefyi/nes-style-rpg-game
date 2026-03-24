export interface AudioManifest {
  music: Record<string, string>;
  sfx: Record<string, string>;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private manifest: AudioManifest | null = null;
  private audioCache = new Map<string, AudioBuffer>();
  private currentMusic: { source: AudioBufferSourceNode; gain: GainNode; trackId: string } | null = null;
  private musicVolume = 1;
  private sfxVolume = 1;
  private muted = false;
  private paused = false;

  async init(manifest: AudioManifest): Promise<void> {
    this.manifest = manifest;
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch (e) {
        console.warn('AudioContext not available:', e);
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { /* Resume is best-effort; context may not be ready for user interaction yet */ });
    }
    return this.ctx;
  }

  private async loadAudio(path: string): Promise<AudioBuffer | null> {
    if (this.audioCache.has(path)) return this.audioCache.get(path)!;
    const ctx = this.ensureContext();
    if (!ctx) return null;
    try {
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`Audio file not found: ${path}`);
        return null;
      }
      const buffer = await response.arrayBuffer();
      const audio = await ctx.decodeAudioData(buffer);
      this.audioCache.set(path, audio);
      return audio;
    } catch (e) {
      console.warn(`Failed to load audio: ${path}`, e);
      return null;
    }
  }

  async playMusic(trackId: string, loop = true): Promise<void> {
    if (this.currentMusic?.trackId === trackId) return;
    const path = this.manifest?.music[trackId];
    if (!path) {
      console.warn(`Unknown music track: ${trackId}`);
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    const buffer = await this.loadAudio(path);
    if (!buffer) return;
    this.stopMusic(0);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = this.muted ? 0 : this.musicVolume;
    source.start();
    this.currentMusic = { source, gain, trackId };
  }

  stopMusic(fadeMs = 500): void {
    if (!this.currentMusic) return;
    const { source, gain } = this.currentMusic;
    if (fadeMs > 0 && this.ctx) {
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeMs / 1000);
      setTimeout(() => { try { source.stop(); } catch { /* Web Audio source.stop() throws if already stopped — safe to ignore */ } }, fadeMs);
    } else {
      try { source.stop(); } catch { /* Web Audio source.stop() throws if already stopped — safe to ignore */ }
    }
    this.currentMusic = null;
  }

  async playSFX(sfxId: string): Promise<void> {
    const path = this.manifest?.sfx[sfxId];
    if (!path) {
      console.warn(`Unknown SFX: ${sfxId}`);
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    const buffer = await this.loadAudio(path);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = this.muted ? 0 : this.sfxVolume;
    source.start();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.currentMusic && !this.muted) {
      this.currentMusic.gain.gain.value = this.musicVolume;
    }
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  mute(): void {
    this.muted = true;
    if (this.currentMusic) this.currentMusic.gain.gain.value = 0;
  }

  unmute(): void {
    this.muted = false;
    if (this.currentMusic) this.currentMusic.gain.gain.value = this.musicVolume;
  }

  get isMuted(): boolean { return this.muted; }
  get currentTrack(): string | null { return this.currentMusic?.trackId ?? null; }
  get isPaused(): boolean { return this.paused; }

  pauseMusic(): void {
    if (this.paused || !this.currentMusic) return;
    this.paused = true;
    this.currentMusic.gain.gain.value = 0;
  }

  resumeMusic(): void {
    if (!this.paused || !this.currentMusic) return;
    this.paused = false;
    this.currentMusic.gain.gain.value = this.muted ? 0 : this.musicVolume;
  }
}