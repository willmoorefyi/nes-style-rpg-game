/**
 * Field diagnostics for the unexplained drops to the Title or a black screen (P1-1-01, P3-07; docs/PLAYTEST_FIX_PLAN.md
 * FX-C). Two parts:
 *
 * - a trace of scene changes, unhandled errors and page unloads, OFF by default (`?trace=1` in the URL or
 *   `localStorage.ff1_trace = '1'`); lines go to `console.info` and to `window.__trace`;
 * - WebGL context loss and a halted game loop, always on: both show a message over the canvas instead of leaving a black
 *   or frozen screen with nothing said.
 *
 * Everything takes its DOM pieces as parameters, so the logic runs under the node test environment.
 */

/** The search string or storage says the trace is wanted. */
export function traceEnabled(search: string, storage?: { getItem(key: string): string | null } | null): boolean {
  if (/[?&]trace=1(?:&|$)/.test(search)) return true;
  try {
    return storage?.getItem('ff1_trace') === '1';
  } catch (e) {
    console.warn('Trace flag unreadable:', e);
    return false;
  }
}

/** A line sink with a ring buffer (the last `limit` lines stay readable from `window.__trace`). */
export class TraceLog {
  readonly lines: string[] = [];
  constructor(private readonly sink: (line: string) => void = (l) => console.info(l),
    private readonly now: () => number = () => Date.now(), private readonly limit = 500) {}

  log(kind: string, detail = ''): void {
    const line = `[trace ${new Date(this.now()).toISOString()}] ${kind}${detail ? ` ${detail}` : ''}`;
    this.lines.push(line);
    if (this.lines.length > this.limit) this.lines.shift();
    this.sink(line);
  }
}

/** Trace unhandled errors, rejections and page unloads (a reload or a close is the only way the page falls to Title
 *  without a scene change in the trace). */
export function traceWindow(win: Pick<Window, 'addEventListener'>, trace: TraceLog): void {
  win.addEventListener('error', (e) => trace.log('window.error', String(e.message)));
  win.addEventListener('unhandledrejection', (e) => trace.log('unhandledrejection', String(e.reason)));
  win.addEventListener('pagehide', () => trace.log('pagehide', 'the page is unloading (a reload or a close)'));
}

/** A message shown over the canvas. */
export interface Overlay {
  show(message: string): void;
  hide(): void;
}

export const CONTEXT_LOST_TEXT = 'The graphics context was lost. Waiting for the browser to restore it...';
export const CONTEXT_STUCK_TEXT = 'The graphics context was not restored. Reload the page; your saves are kept.';
export const HALTED_TEXT = 'The game stopped after repeated errors. Reload the page; your saves are kept.';

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/**
 * A lost WebGL context leaves a black canvas (Pixi re-creates its resources once the browser restores it): say so, and
 * after `stuckAfterMs` without a restore tell the player to reload.
 */
export function watchContext(canvas: Pick<EventTarget, 'addEventListener'>, overlay: Overlay, trace: TraceLog | null,
  timers: Timers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as number) },
  stuckAfterMs = 8000): void {
  let timer: unknown = null;
  canvas.addEventListener('webglcontextlost', () => {
    trace?.log('webglcontextlost');
    console.error('WebGL context lost');
    overlay.show(CONTEXT_LOST_TEXT);
    if (timer !== null) timers.clearTimeout(timer);
    timer = timers.setTimeout(() => { overlay.show(CONTEXT_STUCK_TEXT); timer = null; }, stuckAfterMs);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    trace?.log('webglcontextrestored');
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    overlay.hide();
  });
}

/** A fixed banner at the top of the page (the same look as main.ts's error bar). */
export function domOverlay(doc: Document): Overlay {
  let el: HTMLDivElement | null = null;
  return {
    show(message: string): void {
      if (!el) {
        el = doc.createElement('div');
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:1em;background:#800;color:#fff;font-family:monospace;z-index:9998';
        doc.body.appendChild(el);
      }
      el.textContent = message;
    },
    hide(): void {
      el?.remove();
      el = null;
    },
  };
}
