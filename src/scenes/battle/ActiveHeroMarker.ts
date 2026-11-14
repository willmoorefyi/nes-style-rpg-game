import { Container, Graphics } from 'pixi.js';

/** BA-8: the hero whose command is being chosen steps this far toward the enemies. */
export const ACTIVE_STEP = 24;
const PULSE_COLOR = { r: 0xff, g: 0xff, b: 0xa0 }; // pale yellow
const PULSE_SPEED = 0.15;

/** Tint between white (k = 0) and pale yellow (k = 1). */
export function pulseTint(k: number): number {
  const mix = (c: number) => Math.round(0xff + (c - 0xff) * k);
  return (mix(PULSE_COLOR.r) << 16) | (mix(PULSE_COLOR.g) << 8) | mix(PULSE_COLOR.b);
}

/**
 * BA-8: marks the active hero during the command phase. The sprite stays fully opaque (the old alpha pulse made it
 * vanish); it steps ACTIVE_STEP px forward, pulses its tint between white and pale yellow, and has an arrow above.
 */
export class ActiveHeroMarker {
  private sprite: Container | null = null;
  private homeX = 0;
  private arrow: Graphics | null = null;
  private clock = 0;

  constructor(private readonly parent: Container) {}

  get current(): Container | null { return this.sprite; }

  /** Mark `sprite` (idempotent per frame); a different sprite releases the previous one first. */
  show(sprite: Container): void {
    if (this.sprite === sprite) return;
    this.hide();
    this.sprite = sprite;
    this.homeX = sprite.x;
    sprite.x = this.homeX - ACTIVE_STEP;
    sprite.alpha = 1;
    const arrow = new Graphics();
    arrow.moveTo(0, 0).lineTo(16, 0).lineTo(8, 16).lineTo(0, 0).fill(0xffffff);
    arrow.position.set(sprite.x + (sprite.width - 16) / 2, sprite.y - 20);
    this.parent.addChild(arrow);
    this.arrow = arrow;
  }

  /**
   * `old` was swapped for `next` (late art replacing a placeholder): when `old` is the marked sprite, mark `next`
   * instead, so the step, the pulse and the arrow follow the art. `next` arrives at its place in line.
   */
  replace(old: Container, next: Container): void {
    if (this.sprite !== old) return;
    const clock = this.clock;
    this.hide();
    this.show(next);
    this.clock = clock;
  }

  /** B10: while the hero picks a target, its own arrow hides so only the (yellow) target arrow shows. */
  setArrowVisible(visible: boolean): void {
    if (this.arrow) this.arrow.visible = visible;
  }

  update(dt: number): void {
    if (!this.sprite) return;
    this.clock += dt;
    this.sprite.alpha = 1;
    this.sprite.tint = pulseTint(0.5 - 0.5 * Math.cos(this.clock * PULSE_SPEED));
  }

  /** Put the sprite back in line, untinted, and remove the arrow. */
  hide(): void {
    if (this.sprite) {
      this.sprite.x = this.homeX;
      this.sprite.tint = 0xffffff;
      this.sprite = null;
    }
    if (this.arrow) {
      this.parent.removeChild(this.arrow);
      this.arrow = null;
    }
    this.clock = 0;
  }
}
