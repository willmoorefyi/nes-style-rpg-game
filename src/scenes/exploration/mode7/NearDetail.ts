/**
 * The Mode 7 near detail (docs/MODE7_PLAN.md 3.2, D-M6): a render texture over the flight window's n x n chunks at
 * `cellPx` per cell (4x4 at 48 px, 3072², or the low profile's 3x3 at 32 px, 1536²), nearest, no mips. It is drawn
 * in this order: the far atlas's matching square, scaled up (the underlay); every loaded chunk of the window (the
 * map streamer's own textures); the patch overlays over their cells while their flags are set.
 *
 * - A recentre (the window moved), a patch flag change or a new chunk host redraws the whole window.
 * - A chunk of the window that loads later (`onChunkLoaded`) is drawn into its square then, with the patches clipped
 *   to that square over it. Until then the square shows the underlay, never a hole or a flat placeholder.
 */
import { Container, Rectangle, RenderTexture, Sprite, Texture, type Renderer, type TextureSourceOptions } from 'pixi.js';
import type { MapData } from '../../../types/index.js';
import type { ChunkRect } from '../../../rendering/chunkStreaming.js';
import type { ChunkHost, NearProfile, NearWindow } from './FlightStream.js';
import { patchPlacements, patchSignature, type PatchPlacement, type WorldAtlas } from './WorldAtlas.js';

/** A half-open box of cells. */
export interface CellBox { x0: number; y0: number; x1: number; y1: number }

/** The overlap of two cell boxes, or null when they do not overlap. */
export function clipBox(a: CellBox, b: CellBox): CellBox | null {
  const c = { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  return c.x0 < c.x1 && c.y0 < c.y1 ? c : null;
}

/** The render texture's options: nearest, no mips, clamped (2.5: it is only magnified or drawn near 1:1). */
export function nearTextureOptions(size: number): TextureSourceOptions {
  return { width: size, height: size, resolution: 1, addressMode: 'clamp-to-edge', scaleMode: 'nearest',
    autoGenerateMipmaps: false };
}

function sameRect(a: ChunkRect, b: ChunkRect): boolean {
  return a.c0 === b.c0 && a.r0 === b.r0 && a.c1 === b.c1 && a.r1 === b.r1;
}

export interface NearDetailOptions {
  renderer: Renderer;
  map: MapData;
  /** The composed far atlas (the underlay) and the loaded patch overlays. */
  atlas: WorldAtlas;
  prof: NearProfile;
  hasFlag: (flag: string) => boolean;
}

export class NearDetail {
  readonly texture: RenderTexture;
  /** Px per cell and side in px of the texture. */
  readonly cellPx: number;
  readonly size: number;
  /** The last update drew into the texture (a recentre, a patch change or a late chunk: an upload frame). */
  heavy = false;
  recentres = 0;
  lateDraws = 0;
  private win: NearWindow | null = null;
  private host: ChunkHost | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly late = new Set<number>();
  private readonly placements: PatchPlacement[];
  private signature = '';
  private dirty = true;
  private readonly chunk: number;
  private readonly cols: number;
  private readonly tile: number;

  constructor(private readonly opts: NearDetailOptions) {
    const art = opts.map.art;
    this.chunk = art?.chunk ?? 16;
    this.tile = art?.tile ?? 48;
    this.cols = Math.ceil(opts.map.width / this.chunk);
    this.cellPx = opts.prof.cellPx;
    this.size = opts.prof.n * this.chunk * this.cellPx;
    this.texture = RenderTexture.create(nearTextureOptions(this.size));
    this.placements = patchPlacements(opts.map, this.cellPx);
  }

  /** Redraw the whole window on the next update (a lost context, M7-6). */
  invalidate(): void {
    this.dirty = true;
  }

  /** One flight frame: follow the window and draw what changed. */
  update(win: NearWindow, host: ChunkHost): void {
    this.heavy = false;
    if (host !== this.host) {
      this.unsubscribe?.();
      this.host = host;
      this.unsubscribe = host.onChunkLoaded((i) => { this.late.add(i); });
      this.dirty = true;
    }
    const sig = patchSignature(this.placements, this.opts.hasFlag);
    if (this.dirty || !this.win || !sameRect(win.rect, this.win.rect) || sig !== this.signature) {
      this.win = win;
      this.signature = sig;
      this.dirty = false;
      this.late.clear();
      this.recentres++;
      this.draw(this.box(win.rect), true);
      return;
    }
    if (this.late.size === 0) return;
    const r = win.rect;
    const squares = [...this.late].filter((i) => {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      return col >= r.c0 && col <= r.c1 && row >= r.r0 && row <= r.r1;
    });
    this.late.clear();
    for (const i of squares) {
      this.lateDraws++;
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      this.draw(this.box({ c0: col, r0: row, c1: col, r1: row }), false);
    }
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.texture.destroy(true);
  }

  private box(r: ChunkRect): CellBox {
    const c = this.chunk;
    return { x0: r.c0 * c, y0: r.r0 * c, x1: (r.c1 + 1) * c, y1: (r.r1 + 1) * c };
  }

  /** Draw `box` (the window, or one chunk's square) into the texture: the underlay when `whole`, the loaded chunks,
   *  then the set patches clipped to the box. */
  private draw(box: CellBox, whole: boolean): void {
    const win = this.win;
    if (!win) return;
    const stage = new Container();
    const frames: Texture[] = [];
    const k = this.cellPx;
    const place = (tex: Texture, cx: number, cy: number, scale: number): void => {
      const s = new Sprite(tex);
      s.position.set((cx - win.x0) * k, (cy - win.y0) * k);
      s.scale.set(scale);
      stage.addChild(s);
    };
    const sub = (tex: Texture, x: number, y: number, w: number, h: number): Texture => {
      const t = new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x + x, tex.frame.y + y, w, h) });
      frames.push(t);
      return t;
    };
    const far = this.opts.atlas.texture;
    const farPx = this.opts.atlas.cellPx;
    if (whole && far && farPx > 0) {
      place(sub(far, box.x0 * farPx, box.y0 * farPx, (box.x1 - box.x0) * farPx, (box.y1 - box.y0) * farPx),
        box.x0, box.y0, k / farPx);
    }
    for (let cy = box.y0; cy < box.y1; cy += this.chunk) {
      for (let cx = box.x0; cx < box.x1; cx += this.chunk) {
        const i = Math.floor(cy / this.chunk) * this.cols + Math.floor(cx / this.chunk);
        for (const tex of this.host?.textureOf(i) ?? []) place(tex, cx, cy, k / this.tile);
      }
    }
    for (const p of this.placements) {
      const tex = this.opts.atlas.patchTexture(p.id);
      if (!tex || !this.opts.hasFlag(p.flag)) continue;
      const pb = { x0: p.x / k, y0: p.y / k, x1: p.x / k + tex.width / this.tile, y1: p.y / k + tex.height / this.tile };
      const c = clipBox(pb, box);
      if (!c) continue;
      const t = this.tile;
      place(sub(tex, (c.x0 - pb.x0) * t, (c.y0 - pb.y0) * t, (c.x1 - c.x0) * t, (c.y1 - c.y0) * t), c.x0, c.y0, p.scale);
    }
    this.opts.renderer.render({ container: stage, target: this.texture, clear: whole });
    stage.destroy({ children: true });
    for (const t of frames) t.destroy(false);
    this.heavy = true;
  }
}
