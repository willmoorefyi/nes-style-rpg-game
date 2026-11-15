/**
 * Stone's fixed 5-bit grey mapping (docs/FEEDBACK_PLAN_2026-11-14.md §3.5; no ColorMatrixFilter, no filters at all):
 * every opaque pixel's luma (0.299 R + 0.587 G + 0.114 B) falls in one of 8 equal bands and becomes that band's grey,
 * the 5-bit levels 3, 7, ..., 31 expanded as snes_palette.c15 does, (v << 3) | (v >> 2). The darkest band (the
 * outline) stays 24, so the silhouette reads. Each frame texture gets one grey copy, built once and cached.
 */
import { CanvasSource, Texture } from 'pixi.js';
import { readPixels, type Pixels } from './texturePixels.js';

/** The 8 greys, darkest first: 24, 57, 90, 123, 156, 189, 222, 255. */
export const STONE_GREYS: readonly number[] = [3, 7, 11, 15, 19, 23, 27, 31].map((v) => (v << 3) | (v >> 2));

/** The grey for one colour: luma 0-31 -> 24, 32-63 -> 57, ..., 224-255 -> 255. */
export function stoneGrey(r: number, g: number, b: number): number {
  // integer weights (x1000): the float sum of 0.299 + 0.587 + 0.114 falls just under 1 and would drop band edges
  const luma1000 = 299 * r + 587 * g + 114 * b;
  return STONE_GREYS[Math.min(7, Math.max(0, Math.floor(luma1000 / 32000)))];
}

/** Map RGBA bytes in place: opaque pixels to their grey (alpha kept), transparent ones untouched. */
export function greyPixels(data: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const v = stoneGrey(data[i], data[i + 1], data[i + 2]);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  return data;
}

/** A browser grey copy: read the frame, map it, upload it as a nearest-sampled canvas texture (null outside one). */
function canvasGrey(tex: Texture, read: (t: Texture) => Pixels | null = readPixels): Texture | null {
  const px = read(tex);
  if (!px) return null;
  const canvas = document.createElement('canvas');
  canvas.width = px.w;
  canvas.height = px.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(px.w, px.h);
  img.data.set(greyPixels(new Uint8ClampedArray(px.data)));
  ctx.putImageData(img, 0, 0);
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'nearest' }) });
}

export type GreyBuilder = (tex: Texture) => Texture | null;

/** The cache: `of(tex)` is tex's grey copy (the same object every call; tex itself when none can be built), and
 *  `coloured(grey)` maps a copy back (the element glow takes the coloured frame, so hits on stone still read). */
export class StoneTextures {
  private readonly grey = new WeakMap<Texture, Texture>();
  private readonly back = new WeakMap<Texture, Texture>();

  constructor(private build: GreyBuilder = (t) => canvasGrey(t)) {}

  /** Tests: build grey copies another way (e.g. from synthetic pixels). */
  setBuilder(build: GreyBuilder): void { this.build = build; }

  of(tex: Texture): Texture {
    if (this.back.has(tex)) return tex;
    let g = this.grey.get(tex);
    if (!g) {
      g = this.build(tex) ?? tex;
      this.grey.set(tex, g);
      if (g !== tex) this.back.set(g, tex);
    }
    return g;
  }

  /** The coloured original of a grey copy (any other texture is returned as is). */
  coloured(tex: Texture): Texture {
    return this.back.get(tex) ?? tex;
  }

  isGrey(tex: Texture): boolean {
    return this.back.has(tex);
  }
}

/** The shared cache (battle sprites of both sides). */
export const stoneTextures = new StoneTextures();
