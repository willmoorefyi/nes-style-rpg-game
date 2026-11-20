/**
 * The Mode 7 gate (docs/MODE7_PLAN.md 7): pure, no PixiJS. One function picks the flight view's profile from the URL,
 * the GPU's capabilities and the player's setting; `capsOf` reads the capabilities from the app's renderer by duck
 * typing `renderer.gl`, so nothing here imports the renderer. A mock game has no renderer: `!webgl`, profile `off`.
 */

import type { AirshipView } from '../../../core/Settings.js';

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
