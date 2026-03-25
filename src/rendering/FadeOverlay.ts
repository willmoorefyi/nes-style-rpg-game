import { Graphics } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/LayoutConstants.js';

/**
 * Full-screen black overlay for fade transitions.
 * Add `overlay` to a Container, then call fadeOut/fadeIn.
 */
export class FadeOverlay {
  readonly overlay: Graphics;
  private animating = false;

  constructor() {
    this.overlay = new Graphics();
    this.overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0x000000);
    this.overlay.alpha = 0;
  }

  /** Fade to black: alpha 0→1 over durationMs. Returns a Promise that resolves when done. */
  fadeOut(durationMs: number): Promise<void> {
    return this.animate(0, 1, durationMs);
  }

  /** Fade from black: alpha 1→0 over durationMs. Returns a Promise that resolves when done. */
  fadeIn(durationMs: number): Promise<void> {
    return this.animate(1, 0, durationMs);
  }

  get isAnimating(): boolean {
    return this.animating;
  }

  private animate(from: number, to: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (durationMs <= 0) {
        this.overlay.alpha = to;
        resolve();
        return;
      }
      this.animating = true;
      this.overlay.alpha = from;
      const start = performance.now();
      const tick = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(elapsed / durationMs, 1);
        this.overlay.alpha = from + (to - from) * t;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          this.animating = false;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }
}
