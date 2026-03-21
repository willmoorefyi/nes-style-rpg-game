import { Sprite, Texture, Rectangle } from 'pixi.js';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type AnimationState = 'idle' | 'walking';

export interface AnimationConfig {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameDuration: number; // in ms
  directions: Record<Direction, number>; // row index for each direction
}

export class SpriteAnimation {
  readonly sprite: Sprite;
  private textures: Map<string, Texture[]> = new Map();
  private currentDirection: Direction = 'down';
  private currentState: AnimationState = 'idle';
  private frameIndex = 0;
  private elapsed = 0;
  private config: AnimationConfig;

  constructor(baseTexture: Texture, config: AnimationConfig) {
    this.config = config;
    this.sprite = new Sprite();
    this.buildFrames(baseTexture);
    this.updateTexture();
  }

  private buildFrames(baseTexture: Texture): void {
    const { frameWidth, frameHeight, frameCount, directions } = this.config;
    const source = baseTexture.source;
    
    // Handle fallback textures (like Texture.WHITE) that are too small to slice
    const isFallback = source.width < frameWidth || source.height < frameHeight;

    for (const [dir, row] of Object.entries(directions)) {
      const frames: Texture[] = [];
      for (let i = 0; i < frameCount; i++) {
        if (isFallback) {
          frames.push(baseTexture);
        } else {
          const frame = new Texture({
            source,
            frame: new Rectangle(i * frameWidth, row * frameHeight, frameWidth, frameHeight),
          });
          frames.push(frame);
        }
      }
      this.textures.set(dir, frames);
    }
  }

  setDirection(direction: Direction): void {
    if (this.currentDirection !== direction) {
      this.currentDirection = direction;
      this.frameIndex = 0;
      this.elapsed = 0;
      this.updateTexture();
    }
  }

  setState(state: AnimationState): void {
    if (this.currentState !== state) {
      this.currentState = state;
      this.frameIndex = 0;
      this.elapsed = 0;
      this.updateTexture();
    }
  }

  update(deltaMs: number): void {
    if (this.currentState === 'idle') return;

    this.elapsed += deltaMs;
    if (this.elapsed >= this.config.frameDuration) {
      this.elapsed -= this.config.frameDuration;
      this.frameIndex = (this.frameIndex + 1) % this.config.frameCount;
      this.updateTexture();
    }
  }

  private updateTexture(): void {
    const frames = this.textures.get(this.currentDirection);
    if (frames && frames.length > 0) {
      const idx = this.currentState === 'idle' ? 0 : this.frameIndex;
      this.sprite.texture = frames[idx];
    }
  }

  get direction(): Direction { return this.currentDirection; }
  get state(): AnimationState { return this.currentState; }
  get frame(): number { return this.frameIndex; }
}
