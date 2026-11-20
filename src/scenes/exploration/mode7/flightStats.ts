/**
 * The flight's steady-frame measurements (docs/MODE7_PLAN.md 9): pure, no PixiJS. The p95 window leaves out the
 * first 60 frames after the view shows, and every frame with a recentre, a late chunk or an atlas upload (plus the
 * frame after it, whose `deltaMS` carries that frame's time); those are reported separately, as a max.
 */

/** Steady-flight samples kept for the p95s, and the frames left out after the view shows. */
export const SAMPLES = 600;
export const SETTLE_FRAMES = 60;

/** The 95th percentile (0 when empty). */
export function p95(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

export class FlightStats {
  private steady = 0;
  private sampled = 0;
  private afterHeavy = false;
  private readonly frames: number[] = [];
  private readonly updates: number[] = [];
  /** The largest frame and update times of the frames left out for their uploads. */
  heavyFrameMax = 0;
  heavyUpdateMax = 0;
  heavyFrames = 0;

  /** The view was shown or hidden: the settle window starts again. */
  reset(): void {
    this.steady = 0;
  }

  /** One frame: `drawn` the view showed, `heavy` it drew into a render texture, `updateMs` the update's time and
   *  `frameMs` the ticker's last frame time (undefined without a ticker). */
  push(drawn: boolean, heavy: boolean, updateMs: number, frameMs: number | undefined): void {
    if (!drawn || ++this.steady <= SETTLE_FRAMES) return;
    if (heavy || this.afterHeavy) {
      this.heavyFrames++;
      this.heavyUpdateMax = Math.max(this.heavyUpdateMax, updateMs);
      if (frameMs !== undefined) this.heavyFrameMax = Math.max(this.heavyFrameMax, frameMs);
      this.afterHeavy = heavy;
      return;
    }
    keep(this.updates, updateMs);
    this.sampled++;
    if (frameMs !== undefined) keep(this.frames, frameMs);
  }

  /** Samples so far, and whether the p95s are due for a refresh (once a second of samples: the sort is not free). */
  get samples(): number { return this.frames.length; }
  get due(): boolean { return this.sampled % 60 === 1; }

  summary(): { frameP95: number; updateP95: number } {
    return { frameP95: +p95(this.frames).toFixed(2), updateP95: +p95(this.updates).toFixed(3) };
  }
}

function keep(list: number[], v: number): void {
  list.push(v);
  if (list.length > SAMPLES) list.shift();
}
