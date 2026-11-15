/**
 * The heavy attack's screen shake (docs/FEEDBACK_PLAN_2026-11-14.md item 7): 8 frames, up to 6 px, decaying to 0.
 * Pure timing; BattleLayers applies the offset to `actors` and `fx` only (never `ui` or `hud`).
 */
export const SHAKE_FRAMES = 8;
export const SHAKE_PX = 6;

export class ScreenShake {
  private t = SHAKE_FRAMES;

  /** Start (or restart) a shake. */
  start(): void {
    this.t = 0;
  }

  get active(): boolean {
    return this.t < SHAKE_FRAMES;
  }

  update(dt: number): void {
    if (this.active) this.t = Math.min(SHAKE_FRAMES, this.t + dt);
  }

  /** Whole-px offset now: alternating left / right (and a half-size bob), the amplitude falling linearly to 0. */
  offset(): { x: number; y: number } {
    if (!this.active) return { x: 0, y: 0 };
    const f = Math.floor(this.t);
    const amp = SHAKE_PX * (1 - f / SHAKE_FRAMES);
    return { x: Math.round(f % 2 === 0 ? amp : -amp) || 0, y: Math.round(Math.floor(f / 2) % 2 === 0 ? -amp / 2 : amp / 2) || 0 };
  }
}
