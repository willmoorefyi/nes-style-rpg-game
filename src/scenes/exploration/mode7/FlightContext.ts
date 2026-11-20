/**
 * The flight view's WebGL context loss and restore (docs/MODE7_PLAN.md 7, R6; tranche M7-6): pure, no PixiJS.
 *
 * - `watchFlightContext` listens on the canvas. On `webglcontextlost` it reports `lost`: the view hides and the
 *   top-down world shows (the diagnostics banner stays until the restore). On `webglcontextrestored` (Pixi's own
 *   listener, added at init, has run first and re-created its GL objects) it runs `restore`: the atlas reloads its
 *   freed source and recomposes, the near detail redraws its window. Then it reports `restored`, or `failed` with the
 *   error when that rejects or throws.
 * - `FlightFallback` is the view's side: `lost` while the context is gone or the restore runs, and the session's
 *   fallbacks with their log lines (`failed` with `console.error`, the frame-time switch with `console.warn`).
 */
import { setSlowSession, SLOW_P95_MS, SLOW_WINDOW } from './mode7Toggle.js';

export type ContextEvent = 'lost' | 'restored' | 'failed';

export interface ContextTarget {
  addEventListener?(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
}

/** Listen on `canvas` (none, or one without events: nothing to watch); returns the unsubscribe. */
export function watchFlightContext(canvas: ContextTarget | null | undefined, restore: () => Promise<void>,
  report: (event: ContextEvent, err?: unknown) => void): () => void {
  const on = canvas?.addEventListener?.bind(canvas);
  const off = canvas?.removeEventListener?.bind(canvas);
  if (!on || !off) return () => {};
  let generation = 0;
  const lost = (): void => {
    generation++;
    report('lost');
  };
  const restored = (): void => {
    const gen = ++generation;
    let run: Promise<void>;
    try {
      run = restore();
    } catch (err) {
      run = Promise.reject(err);
    }
    run.then(() => { if (gen === generation) report('restored'); },
      (err: unknown) => { if (gen === generation) report('failed', err); });
  };
  on('webglcontextlost', lost);
  on('webglcontextrestored', restored);
  return () => {
    generation++;
    off('webglcontextlost', lost);
    off('webglcontextrestored', restored);
  };
}

export class FlightFallback {
  /** The context is lost, or restored but not yet redrawn: the view must not show. */
  lost = false;

  /** `fail` drops the renderer and marks the view `failed` for the session (top-down from then on). */
  constructor(private readonly fail: () => void) {}

  context(event: ContextEvent, err?: unknown): void {
    this.lost = event === 'lost';
    if (event !== 'failed') return;
    console.error('Mode 7: the flight view could not be redrawn after the WebGL context was restored; the airship '
      + 'flies top-down', err);
    this.fail();
  }

  /** The frame-time switch held: `slow` for the session, logged. Returns whether the view stays on (`stillOn`, read
   *  after `slow` is set: `?mode7=1` overrides it). */
  slow(frameP95: number, stillOn: () => boolean): boolean {
    setSlowSession(true);
    const kept = stillOn();
    const then = kept ? 'the URL keeps the view on'
      : 'the airship flies top-down this session (re-choose Mode 7 in Config to retry)';
    console.warn(`Mode 7: steady-flight frame time p95 ${frameP95.toFixed(1)} ms over ${SLOW_WINDOW} frames is above `
      + `${SLOW_P95_MS} ms; ${then}`);
    return kept;
  }
}
