/**
 * The Mode 7 sky (docs/MODE7_PLAN.md 5): a code-drawn vertical gradient behind the ground meshes, from the zenith
 * blue down to the haze at the horizon. Every band is one 15-bit colour (5 bits per channel, as `snes_palette.py`
 * defines colours), so the gradient steps like a SNES HDMA sky. The fog (2.5) is one sprite over the ground: a 1x256
 * gradient texture stretched over the screen width, from the horizon row down `FOG_ROWS`, in the haze colour, alpha
 * `FOG_ALPHA` to 0; it moves with the horizon. The clouds (M7-5, `cloudMath.ts`) are sprites in `clouds`, over the
 * gradient and behind the ground, placed each frame by `drift`.
 */
import { BufferImageSource, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { SCREEN_W } from './mode7Math.js';
import { CLOUDS, cloudPlace, cloudTexels } from './cloudMath.js';

type C15 = readonly [number, number, number];

/** The zenith and the horizon haze, 5-bit channels (the light end of `snes_palette.WATER`, paler toward the haze). */
export const SKY_ZENITH: C15 = [6, 14, 27];
export const SKY_HAZE: C15 = [24, 28, 31];

/** The fog band's height in rows and its alpha at the horizon (2.5). */
export const FOG_ROWS = 120;
export const FOG_ALPHA = 0.6;
const FOG_TEXELS = 256;

/** The fog texture's 1x256 RGBA texels, premultiplied: the haze at alpha `FOG_ALPHA` fading linearly to 0. */
export function fogTexels(haze: number = rgb15(SKY_HAZE), alpha = FOG_ALPHA, n = FOG_TEXELS): Uint8Array {
  const out = new Uint8Array(n * 4);
  const ch = [(haze >> 16) & 255, (haze >> 8) & 255, haze & 255];
  for (let i = 0; i < n; i++) {
    const a = alpha * (1 - i / (n - 1));
    out.set([Math.round(ch[0] * a), Math.round(ch[1] * a), Math.round(ch[2] * a), Math.round(255 * a)], i * 4);
  }
  return out;
}

/** A 5-bit channel triple as 0xRRGGBB, expanded like `snes_palette.c15`. */
export function rgb15(c: C15): number {
  const e = (v: number): number => (v << 3) | (v >> 2);
  return (e(c[0]) << 16) | (e(c[1]) << 8) | e(c[2]);
}

/** The sky bands from row 0 to `horizon`: each run of rows that rounds to one 15-bit colour. */
export function skyBands(horizon: number): { y: number; h: number; color: number }[] {
  const bands: { y: number; h: number; color: number }[] = [];
  const rows = Math.max(1, Math.ceil(horizon));
  for (let y = 0; y < rows; y++) {
    const t = rows === 1 ? 1 : (y / (rows - 1)) ** 1.6;   // most of the change near the horizon
    const mix = (i: 0 | 1 | 2): number => Math.round(SKY_ZENITH[i] + (SKY_HAZE[i] - SKY_ZENITH[i]) * t);
    const color = rgb15([mix(0), mix(1), mix(2)]);
    const last = bands[bands.length - 1];
    if (last && last.color === color) last.h++; else bands.push({ y, h: 1, color });
  }
  return bands;
}

export class FlightSky {
  readonly view = new Graphics();
  readonly fog: Sprite;
  readonly clouds = new Container();

  constructor() {
    const source = new BufferImageSource({ resource: fogTexels(), width: 1, height: FOG_TEXELS,
      alphaMode: 'premultiplied-alpha', scaleMode: 'linear', addressMode: 'clamp-to-edge' });
    this.fog = new Sprite(new Texture({ source }));
    this.fog.label = 'mode7:fog';
    this.clouds.label = 'mode7:clouds';
    for (const c of CLOUDS) {
      const src = new BufferImageSource({ resource: cloudTexels(c), width: c.w, height: c.h,
        alphaMode: 'premultiplied-alpha', scaleMode: 'nearest' });
      const s = new Sprite(new Texture({ source: src }));
      s.anchor.set(0, 1);
      s.scale.set(c.scale);
      this.clouds.addChild(s);
    }
  }

  /** Place the clouds: their drift at `tMs`, their slide with the ship at `px` cells, their height over `horizon`. */
  drift(tMs: number, px: number, horizon: number): void {
    CLOUDS.forEach((c, i) => {
      const s = this.clouds.children[i];
      const at = cloudPlace(c, tMs, px, horizon);
      s.visible = at.visible;
      if (at.visible) s.position.set(at.x, at.y);
    });
  }

  /** Put the fog band under the horizon row. */
  placeFog(horizon: number, width = SCREEN_W): void {
    this.fog.position.set(0, horizon);
    this.fog.width = width;
    this.fog.height = FOG_ROWS;
  }

  /** Draw the sky down to `horizon` (plus `overlap` rows under the ground, so no gap shows at the seam). */
  draw(horizon: number, overlap = 8, width = SCREEN_W): void {
    const g = this.view.clear();
    const bands = skyBands(horizon);
    bands.forEach((b, i) => {
      const extra = i === bands.length - 1 ? overlap : 0;
      g.rect(0, b.y, width, b.h + extra).fill(b.color);
    });
  }

  destroy(): void {
    this.view.destroy();
    this.fog.destroy({ texture: true, textureSource: true });
    this.clouds.destroy({ children: true, texture: true, textureSource: true });
  }
}
