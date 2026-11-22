/**
 * One prop light (AR-P2) drawn in the world container: the glow (additive, under the characters) and the flicker of
 * the prop's flame pixels (over its art, sorted with the characters by the prop's foot). Every bitmap, the 8 flame
 * frames of a mask and the 8 glow frames of a radius, is a GraphicsContext built once per shape, style and art scale
 * and shared; a frame only swaps two contexts, so it allocates nothing.
 */
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import type { FlameEffect, FlameMask } from '../../../types/ambient.js';
import { AMBIENT_CELL_PX } from '../../../types/ambient.js';
import { shapeRuns } from '../smoke/smokeShapes.js';
import { FLAME_STYLE, liftColour } from './flameStyles.js';
import { FLAME_FRAMES, flameFrame, frameAt, glowRadius, glowShape, lightPhaseMs, shapeSeed } from './flameMotion.js';

const flameCache = new Map<string, GraphicsContext[]>();
const glowCache = new Map<string, GraphicsContext[]>();

function runs(ctx: GraphicsContext, rows: string[], x0: number, y0: number, px: number, colour: (k: number) => number) {
  for (const [x, y, len, k] of shapeRuns(rows)) ctx.rect((x0 + x) * px, (y0 + y) * px, len * px, px).fill(colour(k));
}

function flameArt(e: FlameEffect, mask: FlameMask, px: number): GraphicsContext[] {
  const key = `${e.style}|${px}|${mask.dx},${mask.dy}|${mask.tongue}|${mask.rows.join('/')}`;
  const hit = flameCache.get(key);
  if (hit) return hit;
  const ramp = FLAME_STYLE[e.style].ramp, seed = shapeSeed(mask.rows);
  const frames = Array.from({ length: FLAME_FRAMES }, (_, f) => {
    const ctx = new GraphicsContext();
    runs(ctx, flameFrame(mask.rows, mask.tongue, f, seed), mask.dx, mask.dy, px, (k) => ramp[k]);
    return ctx;
  });
  flameCache.set(key, frames);
  return frames;
}

function glowArt(e: FlameEffect, ax: number, ay: number, px: number): GraphicsContext[] {
  const key = `${e.style}|${px}|${e.glow}|${ax & 3},${ay & 3}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const lift = liftColour(FLAME_STYLE[e.style]);
  const frames = Array.from({ length: FLAME_FRAMES }, (_, f) => {
    const r = glowRadius(e.glow, f), ctx = new GraphicsContext();
    const rows = glowShape(r, ax, ay);
    runs(ctx, rows, -(rows[0].length - 1) / 2, -r, px, () => lift);
    return ctx;
  });
  glowCache.set(key, frames);
  return frames;
}

export class FlameLight {
  /** The glow, under every character (additive: the floor keeps its own art). */
  readonly glow: Graphics;
  /** The flame pixels, at the prop's foot in the character order; null for a light with no prop. */
  readonly flame: Graphics | null;
  private readonly glowArt: GraphicsContext[];
  private readonly flameArt: GraphicsContext[] | null;
  private readonly phaseMs: number;
  private shown = -1;

  /** `tilePx`: screen px per map cell. */
  constructor(readonly effect: FlameEffect, tilePx: number) {
    const px = tilePx / AMBIENT_CELL_PX;
    const ax = effect.x * AMBIENT_CELL_PX + (effect.ox ?? 24), ay = effect.y * AMBIENT_CELL_PX + (effect.oy ?? 24);
    this.phaseMs = lightPhaseMs(effect.x, effect.y);
    this.glowArt = glowArt(effect, ax, ay, px);
    this.glow = new Graphics(this.glowArt[0]);
    this.glow.blendMode = 'add';
    this.glow.position.set(ax * px, ay * px);
    this.glow.zIndex = 0;
    this.flameArt = effect.mask ? flameArt(effect, effect.mask, px) : null;
    this.flame = this.flameArt ? new Graphics(this.flameArt[0]) : null;
    if (this.flame) {
      this.flame.position.set(ax * px, ay * px);
      this.flame.zIndex = (effect.foot + 1) * tilePx + 1;
    }
  }

  /** Every display object of the light, to add to the world container. */
  get nodes(): Container[] {
    return this.flame ? [this.glow, this.flame] : [this.glow];
  }

  /** The frame (0-7) of the last draw. */
  get frame(): number {
    return this.shown;
  }

  draw(ms: number): void {
    const f = frameAt(ms, this.phaseMs);
    if (f === this.shown) return;
    this.shown = f;
    this.glow.context = this.glowArt[f];
    if (this.flame && this.flameArt) this.flame.context = this.flameArt[f];
  }

  destroy(): void {
    for (const n of this.nodes) n.destroy();   // the shared contexts stay cached
  }
}
