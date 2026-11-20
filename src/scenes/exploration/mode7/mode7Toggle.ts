/**
 * The Mode 7 gate (docs/MODE7_PLAN.md 7): pure, no PixiJS. One function picks the flight view's profile from the URL,
 * the GPU's capabilities and the player's setting; `capsOf` reads the capabilities from the app's renderer by duck
 * typing `renderer.gl`, so nothing here imports the renderer. A mock game has no renderer: `!webgl`, profile `off`.
 */

import type { AirshipView } from '../../../core/Settings.js';
import type { Game } from '../../../core/Game.js';

export type Mode7Profile = 'off' | 'full' | 'low';

export interface Mode7Caps {
  webgl: boolean;
  webgl2: boolean;
  maxTexture: number;
  anisotropy: boolean;
  /** The view failed this session (a missing atlas, a failed restore): top-down from now on. */
  failed: boolean;
  /** The frame-time switch fired this session (M7-6). */
  slow: boolean;
}

/** Below this the far atlas cannot be drawn at all; below `FULL_TEXTURE` the low profile is used. */
export const MIN_TEXTURE = 2048;
export const FULL_TEXTURE = 4096;

/** The `?mode7=` value: '0', '1', 'low' (M7-3: like '1', but always the low profile), 'pilot' or null. */
export function mode7Param(search: string): string | null {
  return new URLSearchParams(search).get('mode7');
}

/**
 * The profile. Precedence (7): the URL (`?mode7=0` off always; `?mode7=1` full, or low on a small texture limit or
 * without WebGL2, over the setting and `slow` but never over `!webgl`, `failed` or a texture limit under 2048), then
 * the caps, then the setting (`topdown` is off). `?mode7=low` is `?mode7=1` forced to the low profile (the review
 * and measurements of the low end on a full GPU).
 */
export function mode7Enabled(search: string, settings: { airshipView: AirshipView }, caps: Mode7Caps): Mode7Profile {
  const url = mode7Param(search);
  if (url === '0') return 'off';
  if (!caps.webgl || caps.failed || caps.maxTexture < MIN_TEXTURE) return 'off';
  const fit: Mode7Profile = caps.maxTexture < FULL_TEXTURE || !caps.webgl2 ? 'low' : 'full';
  if (url === '1') return fit;
  if (url === 'low') return 'low';
  if (caps.slow) return 'off';
  return settings.airshipView === 'topdown' ? 'off' : fit;
}

/** An airship is raised, parked on `map` or ridden: a flight may come, so the view loads (behind the fade-in, 4.3). */
export function flightMayCome(g: Pick<Game, 'fieldMode' | 'gameFlags' | 'vehicles'>, map: string): boolean {
  return g.fieldMode === 'airship' || g.gameFlags.has('AIRSHIP_RAISED')
    || (g.vehicles ?? []).some((v) => v.type === 'airship' && v.map === map);
}

/** The frame-time switch (7, M7-6): the p95 frame time of the last `SLOW_WINDOW` steady-flight frames (flightStats
 *  leaves out the 60 settle frames after the view shows or a tilt ends, and every recentre and upload frame) stays
 *  above `SLOW_P95_MS` for a whole window, i.e. on `SLOW_WINDOW` steady frames in a row: `slow` for the session, the
 *  flight goes top-down. A short hitch (10 slow frames or fewer) never fires it. Re-choosing Mode 7 in Config clears
 *  it. */
export const SLOW_WINDOW = 120;
export const SLOW_P95_MS = 20;
/** p95 is `sorted[floor(0.95 n)]` (flightStats.p95): over the limit exactly when this many frames are over it. */
export const SLOW_OVER = SLOW_WINDOW - Math.floor(SLOW_WINDOW * 0.95);

let slowSession = false;
/** The frame-time switch fired this session (page lifetime, not stored). */
export function slowThisSession(): boolean { return slowSession; }
export function setSlowSession(slow: boolean): void { slowSession = slow; }

/** The rule over a rolling window of steady frame times: a ring with a count of the frames over the limit, so a
 *  frame costs no sort and no allocation; `run` counts the frames in a row whose full window was over. */
export class SlowRule {
  private readonly ring = new Float64Array(SLOW_WINDOW);
  private n = 0;
  private at = 0;
  private over = 0;
  private run = 0;

  reset(): void {
    this.n = 0;
    this.at = 0;
    this.over = 0;
    this.run = 0;
  }

  /** One steady frame's time in ms; true once a full window's p95 has stayed above the limit for a whole window. */
  push(ms: number): boolean {
    if (this.n === SLOW_WINDOW) { if (this.ring[this.at] > SLOW_P95_MS) this.over--; } else this.n++;
    this.ring[this.at] = ms;
    if (ms > SLOW_P95_MS) this.over++;
    this.at = (this.at + 1) % SLOW_WINDOW;
    this.run = this.n === SLOW_WINDOW && this.over >= SLOW_OVER ? this.run + 1 : 0;
    return this.run >= SLOW_WINDOW;
  }

  /** The window's p95 (for the log line; this one sorts). */
  p95(): number {
    const s = Array.from(this.ring.subarray(0, this.n)).sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0;
  }
}

interface GlLike {
  VERSION?: number;
  MAX_TEXTURE_SIZE?: number;
  RENDERER?: number;
  getParameter(p: number | undefined): unknown;
  getExtension(name: string): unknown;
}

function glOf(renderer: unknown): GlLike | null {
  if (typeof renderer !== 'object' || renderer === null || !('gl' in renderer)) return null;
  const gl = (renderer as { gl: unknown }).gl;
  if (typeof gl !== 'object' || gl === null) return null;
  const g = gl as Partial<GlLike>;
  return typeof g.getParameter === 'function' && typeof g.getExtension === 'function' ? (gl as GlLike) : null;
}

/** The capabilities of `renderer` (the app's renderer, or undefined); `failed` and `slow` are the view's own. */
export function capsOf(renderer: unknown): Mode7Caps & { gl: string } {
  const none = { webgl: false, webgl2: false, maxTexture: 0, anisotropy: false, failed: false, slow: false, gl: '' };
  const gl = glOf(renderer);
  if (!gl) return none;
  try {
    const version = String(gl.getParameter(gl.VERSION) ?? '');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL?: number } | null;
    const name = dbg?.UNMASKED_RENDERER_WEBGL !== undefined ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return {
      ...none, webgl: true, webgl2: version.startsWith('WebGL 2'),
      maxTexture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0,
      anisotropy: !!gl.getExtension('EXT_texture_filter_anisotropic'), gl: String(name ?? ''),
    };
  } catch (err) {
    console.error('Mode 7: cannot read the WebGL capabilities; top-down flight', err);
    return none;
  }
}
