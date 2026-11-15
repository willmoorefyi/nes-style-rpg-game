/**
 * Dev-only scene-wide battle clock (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 10). BattleScene passes its dt through
 * `frameDt` before anything else, so every system (enemy poses, party choreography, effects, shake, overlays,
 * floating numbers, text holds) runs on it:
 *   ?battleStep=1 or ?enemyAnim=step   step mode: time is frozen; each `.` advances exactly one frame
 *   &slow=N                            divides dt (N >= 1)
 * `?enemyAnim=` also drives the enemy loop preview (enemyAnimPreview.ts); `?battleStep=1` does not.
 */
export interface DevClockConfig {
  step: boolean;
  slow: number;
}

export interface KeySource {
  addEventListener(type: 'keydown', fn: (e: { key: string }) => void): void;
  removeEventListener(type: 'keydown', fn: (e: { key: string }) => void): void;
}

/** The clock the URL asks for, or null (normal time). */
export function parseDevClock(search: string): DevClockConfig | null {
  const q = new URLSearchParams(search);
  const step = q.get('battleStep') === '1' || q.get('enemyAnim') === 'step';
  const n = Number(q.get('slow'));
  const slow = Number.isFinite(n) && n >= 1 ? n : 1;
  return step || slow > 1 ? { step, slow } : null;
}

export class BattleDevClock {
  private pending = 0;
  private readonly onKey = (e: { key: string }): void => {
    if (this.cfg.step && e.key === '.') this.pending++;
  };

  constructor(readonly cfg: DevClockConfig, private readonly keys: KeySource | null = null) {
    keys?.addEventListener('keydown', this.onKey);
  }

  get stepping(): boolean { return this.cfg.step; }

  /** The dt every battle system runs with this frame. */
  frameDt(dt: number): number {
    if (!this.cfg.step) return dt / this.cfg.slow;
    if (this.pending === 0) return 0;
    this.pending--;
    return 1;
  }

  dispose(): void {
    this.keys?.removeEventListener('keydown', this.onKey);
  }
}

/** The dev clock for this page (dev builds with a matching URL only), or null. */
export function createBattleDevClock(): BattleDevClock | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null;
  const cfg = parseDevClock(location.search);
  return cfg ? new BattleDevClock(cfg, typeof window === 'undefined' ? null : window) : null;
}
