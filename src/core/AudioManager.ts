export interface AudioManifest {
  music: Record<string, string>;
  sfx: Record<string, string>;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private manifest: AudioManifest | null = null;
  private audioCache = new Map<string, AudioBuffer>();
  private failedLoads = new Set<string>();
  private currentMusic: { source: AudioBufferSourceNode; gain: GainNode; trackId: string } | null = null;
  private musicVolume = 1;
  private sfxVolume = 1;
  private muted = false;
  /** When disabled nothing is ever played and no AudioContext is created. */
  private disabled = false;
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
      // best-effort: the context may not resume before a user gesture
      this.ctx.resume().catch((e) => console.debug('AudioContext resume deferred:', e));
    }
    return this.ctx;
  }

  private async loadAudio(path: string): Promise<AudioBuffer | null> {
    if (this.audioCache.has(path)) return this.audioCache.get(path)!;
    if (this.failedLoads.has(path)) return null;
    const ctx = this.ensureContext();
    if (!ctx) return null;
    try {
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`Audio file not found: ${path}`);
        this.failedLoads.add(path);
        return null;
      }
      const buffer = await response.arrayBuffer();
      const audio = await ctx.decodeAudioData(buffer);
      this.audioCache.set(path, audio);
      return audio;
    } catch (e) {
      console.warn(`Failed to load audio: ${path}`, e);
      this.failedLoads.add(path);
      return null;
    }
  }

  /** Turn audio off for the session (dev `?mute=1`). */
  disable(): void {
    this.disabled = true;
    this.stopMusic(0);
  }

  get isDisabled(): boolean { return this.disabled; }

  /** Increments on every playMusic call; a load that finishes after a newer request is dropped. */
  private musicRequest = 0;
  /** Track whose file is still loading (counts as current for the same-track check). */
  private requestedTrack: string | null = null;

  async playMusic(trackId: string, loop = true): Promise<void> {
    if (this.disabled) return;
    // the latest request wins, even when an earlier one's file finishes loading later
    if ((this.requestedTrack ?? this.currentMusic?.trackId) === trackId) return;
    const path = this.manifest?.music[trackId];
    if (!path) {
      console.warn(`Unknown music track: ${trackId}`);
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.requestedTrack = trackId;
    const request = ++this.musicRequest;
    const buffer = await this.loadAudio(path);
    if (request !== this.musicRequest) return;      // superseded while loading
    this.requestedTrack = null;
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
    // a track still loading must not start after a stop
    this.musicRequest++;
    this.requestedTrack = null;
    if (!this.currentMusic) return;
    const { source, gain } = this.currentMusic;
    if (fadeMs > 0 && this.ctx) {
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeMs / 1000);
      setTimeout(() => AudioManager.stopSource(source), fadeMs);
    } else {
      AudioManager.stopSource(source);
    }
    this.currentMusic = null;
  }

  /** Web Audio's stop() throws when the source has already stopped; that is expected, so it is only logged at debug. */
  private static stopSource(source: AudioBufferSourceNode): void {
    try {
      source.stop();
    } catch (e) {
      console.debug('Music source already stopped:', e);
    }
  }

  async playSFX(sfxId: string): Promise<void> {
    if (this.disabled) return;
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