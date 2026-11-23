/**
 * WR (docs/WORLD_WRAP_PLAN.md 5): on a wrapped map each world object draws at its image nearest the camera's centre.
 * The view (20x11 cells plus a 1-chunk ring) is far smaller than the world, so each object has exactly one image in
 * view. `apply` shifts every child of the world container (but the skipped ones) by whole periods just before Pixi
 * renders; `restore` undoes it before the scene's next update, so the game only ever sees canonical positions.
 *
 * A child whose own `onRender` places it (the parked vehicles, FieldVehicleSprites) must be skipped: its callback runs
 * after `apply` and would overwrite the shift (risk WR3). Any future `onRender` owner in the world container must be
 * skipped the same way.
 */
import type { Container } from 'pixi.js';

/** Layers, the smoke (`aboveZIndex + 1`) and flying parts keep their zIndex: only |zIndex| under this is shifted. */
export const WRAP_Z_LIMIT = 1_000_000;

export interface WrapView {
  /** The camera's top-left in world px. */
  x: number;
  y: number;
  /** The view's size in px (the centre is the top-left plus half of it). */
  width: number;
  height: number;
}

interface Shifted { child: Container; dx: number; dy: number; dz: number }

export class WrapImages {
  private shifted: Shifted[] = [];

  /** Shift each non-skipped child of `world` to its image nearest the view's centre. A zero period is a no-op. */
  apply(world: Container, view: WrapView, period: { x: number; y: number }, skip: (c: Container) => boolean): void {
    this.restore();
    if (period.x <= 0 && period.y <= 0) return;
    const cx = view.x + view.width / 2;
    const cy = view.y + view.height / 2;
    for (const child of world.children) {
      if (skip(child)) continue;
      // the centre of the child's bounds in world space (bounds, not x: a Graphics may draw at absolute coordinates)
      const b = child.getLocalBounds();
      const centreX = child.x + (b.x + b.width / 2 - child.pivot.x) * child.scale.x;
      const centreY = child.y + (b.y + b.height / 2 - child.pivot.y) * child.scale.y;
      const kx = period.x > 0 ? Math.round((cx - centreX) / period.x) : 0;
      const ky = period.y > 0 ? Math.round((cy - centreY) / period.y) : 0;
      if (kx === 0 && ky === 0) continue;
      const dx = kx * period.x;
      const dy = ky * period.y;
      const dz = Math.abs(child.zIndex) < WRAP_Z_LIMIT ? ky * period.y : 0;
      child.x += dx;
      child.y += dy;
      if (dz !== 0) child.zIndex += dz;
      this.shifted.push({ child, dx, dy, dz });
    }
  }

  /** Put every shifted child back where the game left it. */
  restore(): void {
    for (const s of this.shifted) {
      s.child.x -= s.dx;
      s.child.y -= s.dy;
      if (s.dz !== 0) s.child.zIndex -= s.dz;
    }
    this.shifted = [];
  }

  /** How many children the last `apply` moved (tests, the browser check). */
  get count(): number {
    return this.shifted.length;
  }
}
