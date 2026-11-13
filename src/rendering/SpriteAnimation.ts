import { Sprite, Texture, Rectangle } from 'pixi.js';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type AnimationState = 'idle' | 'walking';

export interface AnimationConfig {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameDuration: number; // in ms
  directions: Record<Direction, number>; // row index for each direction
  /** Top-left of this character's block inside a shared atlas (defaults to 0,0). */
  originX?: number;
  originY?: number;
  /** Column order used while walking, e.g. [1, 0, 2, 0]. Defaults to 0..frameCount-1. */
  walkSequence?: number[];
}

/** Position in the walk cycle for a character moving tile by tile: each tile shows a step pose for its first half
 *  and the passing (standing) pose for its second half, and consecutive tiles alternate the stepping foot, so a
 *  [stepL, stand, stepR, stand] cycle plays exactly once every two tiles at any walking speed. */
export function walkCycleIndex(stepsTaken: number, tileProgress: number): number {
  return stepsTaken * 2 + (tileProgress < 0.5 ? 0 : 1);
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
            frame: new Rectangle((this.config.originX ?? 0) + i * frameWidth, (this.config.originY ?? 0) + row * frameHeight, frameWidth, frameHeight),
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

  /** Show a walk-cycle position directly (movement-driven animation; see walkCycleIndex). */
  setWalkFrame(cycleIndex: number): void {
    if (this.currentState !== 'walking') this.currentState = 'walking';
    const next = ((cycleIndex % this.cycleLength) + this.cycleLength) % this.cycleLength;
    if (next !== this.frameIndex) {
      this.frameIndex = next;
    }
    this.updateTexture();
  }

  update(deltaMs: number): void {
    if (this.currentState === 'idle') return;

    this.elapsed += deltaMs;
    if (this.elapsed >= this.config.frameDuration) {
      this.elapsed -= this.config.frameDuration;
      this.frameIndex = (this.frameIndex + 1) % this.cycleLength;
      this.updateTexture();
    }
  }

  private updateTexture(): void {
    const frames = this.textures.get(this.currentDirection);
    if (frames && frames.length > 0) {
      const seq = this.config.walkSequence;
      const idx = this.currentState === 'idle' ? 0 : (seq ? seq[this.frameIndex % seq.length] : this.frameIndex);
      this.sprite.texture = frames[idx] ?? frames[0];
    }
  }

  private get cycleLength(): number {
    return this.config.walkSequence?.length ?? this.config.frameCount;
  }

  get direction(): Direction { return this.currentDirection; }
  get state(): AnimationState { return this.currentState; }
  get frame(): number { return this.frameIndex; }
}
