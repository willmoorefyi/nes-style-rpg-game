/**
 * The battle-fx glyph atlas (assets/sprites/battle-fx.{png,json}, built by assets-src/fx/build_fx.py): textures by
 * `glyph.ramp` key and frame, sampled nearest. Missing art leaves `texture()` null; the renderer then draws
 * rectangles in the glyph's colour, with one console warning (as missing battle art does).
 */
import { Assets, Rectangle, Texture } from 'pixi.js';
import { fetchJson } from '../../../rendering/CharacterAtlas.js';

export const FX_ATLAS = 'assets/sprites/battle-fx';

export interface FxGlyphMeta {
  /** Native size (the atlas is drawn at `scale`). */
  cell: [number, number];
  /** Frame origins in atlas px. */
  frames: [number, number][];
  /** A mid colour of the ramp (#rrggbb), for the fallback rectangles. */
  color: string;
  tile?: string;
}

export interface FxAtlasMeta { scale: number; glyphs: Record<string, FxGlyphMeta> }

export class FxAtlas {
  private meta: FxAtlasMeta | null = null;
  private tex: Texture | null = null;
  private readonly cache = new Map<string, Texture>();
  private readonly resolved = new Map<string, string | null>();
  private warned = false;

  /** Use a loaded meta (and texture, or null for the rectangle fallback). */
  set(meta: FxAtlasMeta | null, tex: Texture | null): void {
    this.meta = meta;
    this.tex = tex;
    this.cache.clear();
    this.resolved.clear();
  }

  get hasArt(): boolean { return this.tex !== null && this.meta !== null; }

  /** The atlas key for `glyph.ramp`: exact, else the glyph in any ramp (fixed-ramp glyphs: shimmer, icons). */
  resolve(key: string): string | null {
    if (this.resolved.has(key)) return this.resolved.get(key) ?? null;
    const glyphs = this.meta?.glyphs ?? {};
    const prefix = `${key.split('.')[0]}.`;
    const found = glyphs[key] ? key : Object.keys(glyphs).sort().find((k) => k.startsWith(prefix)) ?? null;
    this.resolved.set(key, found);
    return found;
  }

  glyph(key: string): FxGlyphMeta | null {
    const k = this.resolve(key);
    return k ? this.meta?.glyphs[k] ?? null : null;
  }

  frameCount(key: string): number {
    return this.glyph(key)?.frames.length ?? 1;
  }

  /** Native cell size (8x8 when unknown). */
  cell(key: string): [number, number] {
    return this.glyph(key)?.cell ?? [8, 8];
  }

  color(key: string): number {
    const c = this.glyph(key)?.color;
    return c ? parseInt(c.slice(1), 16) : 0xffffff;
  }

  /** The frame's texture, or null (no art: the caller draws a rectangle; warned once). */
  texture(key: string, frame: number): Texture | null {
    const k = this.resolve(key);
    const g = k ? this.meta?.glyphs[k] : undefined;
    if (!this.tex || !this.meta || !g || !k) {
      this.warnOnce(key);
      return null;
    }
    const f = g.frames[Math.min(Math.max(0, frame), g.frames.length - 1)];
    const id = `${k}#${f[0]},${f[1]}`;
    let t = this.cache.get(id);
    if (!t) {
      const s = this.meta.scale;
      t = new Texture({ source: this.tex.source, frame: new Rectangle(f[0], f[1], g.cell[0] * s, g.cell[1] * s) });
      this.cache.set(id, t);
    }
    return t;
  }

  /** Screen px per native glyph pixel at sprite scale 1. */
  get artScale(): number { return this.meta?.scale ?? 2; }

  private warnOnce(key: string): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(`Battle fx art: no glyph "${key}" (${FX_ATLAS}.json ${this.meta ? 'loaded' : 'not loaded'}); drawing rectangles`);
  }

  async load(): Promise<void> {
    try {
      const meta = await fetchJson<FxAtlasMeta>(`${FX_ATLAS}.json`);
      const tex = await Assets.load<Texture>(`${FX_ATLAS}.png`);
      tex.source.scaleMode = 'nearest';
      this.set(meta, tex);
    } catch (err) {
      console.warn('Battle fx art unavailable; effects draw rectangles', err);
    }
  }
}
