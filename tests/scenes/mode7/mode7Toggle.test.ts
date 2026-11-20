import { describe, expect, it, vi, afterEach } from 'vitest';
import { capsOf, mode7Enabled, type Mode7Caps } from '../../../src/scenes/exploration/mode7/mode7Toggle.js';

/** M7-2: the Mode 7 gate (docs/MODE7_PLAN.md 7): the precedence table and the capabilities read from a stub `gl`. */
const FULL: Mode7Caps = { webgl: true, webgl2: true, maxTexture: 16384, anisotropy: true, failed: false, slow: false };

const URLS = ['', '?mode7=0', '?mode7=1', '?mode7=low', '?mode7=pilot'] as const;
const CAPS: Record<string, Mode7Caps> = {
  full: FULL,
  noWebgl: { ...FULL, webgl: false, webgl2: false },
  failed: { ...FULL, failed: true },
  tiny: { ...FULL, maxTexture: 1024 },
  small: { ...FULL, maxTexture: 2048 },
  webgl1: { ...FULL, webgl2: false },
  slow: { ...FULL, slow: true },
};
const SETTINGS = ['mode7', 'topdown'] as const;

/** The table of 7, written out independently of the implementation. */
function expected(url: string, cap: string, setting: string): string {
  if (url === '?mode7=0') return 'off';
  if (cap === 'noWebgl' || cap === 'failed' || cap === 'tiny') return 'off';
  const fit = cap === 'small' || cap === 'webgl1' ? 'low' : 'full';
  if (url === '?mode7=1') return fit;
  if (url === '?mode7=low') return 'low';
  if (cap === 'slow') return 'off';
  return setting === 'topdown' ? 'off' : fit;
}

describe('M7-2: mode7Enabled', () => {
  for (const url of URLS) {
    for (const cap of Object.keys(CAPS)) {
      for (const setting of SETTINGS) {
        it(`url '${url}', caps ${cap}, setting ${setting} -> ${expected(url, cap, setting)}`, () => {
          expect(mode7Enabled(url, { airshipView: setting }, CAPS[cap])).toBe(expected(url, cap, setting));
        });
      }
    }
  }

  it('?mode7=1 without WebGL2 gives low; it overrides the setting and the frame-time switch', () => {
    expect(mode7Enabled('?mode7=1', { airshipView: 'topdown' }, CAPS.webgl1)).toBe('low');
    expect(mode7Enabled('?mode7=1', { airshipView: 'topdown' }, CAPS.slow)).toBe('full');
    expect(mode7Enabled('?art=ai&mode7=1&mute=1', { airshipView: 'topdown' }, FULL)).toBe('full');
  });
});

/** A stub WebGL context: VERSION, MAX_TEXTURE_SIZE, the renderer string and the extensions. */
function stubGl(version = 'WebGL 2.0', max = 16384, aniso = true) {
  return {
    VERSION: 0x1f02, MAX_TEXTURE_SIZE: 0x0d33, RENDERER: 0x1f01,
    getParameter: (p: number) => ({ 0x1f02: version, 0x0d33: max, 0x1f01: 'WebKit WebGL', 0x9246: 'Apple M4 Pro' } as Record<number, unknown>)[p],
    getExtension: (name: string) => (name === 'EXT_texture_filter_anisotropic' && aniso ? {}
      : name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null),
  };
}

describe('M7-2: capsOf', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('no renderer, or one without gl: no WebGL (a mock game: profile off, nothing logged)', () => {
    const error = vi.spyOn(console, 'error');
    for (const r of [undefined, null, {}, { gl: null }, { gl: {} }]) {
      expect(capsOf(r)).toMatchObject({ webgl: false, webgl2: false, maxTexture: 0, failed: false, slow: false });
      expect(mode7Enabled('?mode7=1', { airshipView: 'mode7' }, capsOf(r))).toBe('off');
    }
    expect(error).not.toHaveBeenCalled();
  });

  it('reads VERSION, MAX_TEXTURE_SIZE, the anisotropy extension and the unmasked renderer string', () => {
    expect(capsOf({ gl: stubGl() })).toEqual({ webgl: true, webgl2: true, maxTexture: 16384, anisotropy: true,
      failed: false, slow: false, gl: 'Apple M4 Pro' });
    expect(capsOf({ gl: stubGl('WebGL 1.0', 4096, false) })).toMatchObject({ webgl: true, webgl2: false,
      maxTexture: 4096, anisotropy: false });
  });

  it('a throwing context logs and gives no WebGL', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const gl = { ...stubGl(), getParameter: () => { throw new Error('lost'); } };
    expect(capsOf({ gl }).webgl).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
