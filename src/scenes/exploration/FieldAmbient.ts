/**
 * Looping field effects (LM-INT; types/ambient.ts): a map's `ambient` entries drawn in the world container over the
 * map art and the characters. `smoke`: grey pixel-art puffs rising from a cell (the volcano's crater), growing,
 * drifting with the wind and fading, on a 3.2 s loop. The puffs are drawn in art px (48 per cell) scaled to the
 * field tile, so they keep the field art's pixel size; their timing is the pure `smokePuffs` (no PixiJS).
 */
import { Container, Graphics } from 'pixi.js';
import type { MapData } from '../../types/index.js';
import { AMBIENT_CELL_PX, type AmbientEffect } from '../../types/ambient.js';
import { aboveZIndex } from '../../rendering/BakedMapRenderer.js';
import { TILE_SIZE } from '../../core/LayoutConstants.js';

export const SMOKE_PERIOD_MS = 3200;
export const SMOKE_PUFFS = 5;
/** Art px a puff rises over one loop. */
export const SMOKE_RISE = 60;
const MS_PER_FRAME = 1000 / 60;

/** 15-bit greys (5 bits per channel): outline, shade, body, highlight. */
export const SMOKE_PALETTE = [0x5a5252, 0x948c8c, 0xc6c6c6, 0xefefef] as const;
/** Puff radii in art px: small, medium, large. */
export const SMOKE_RADII = [3, 5, 7] as const;

/** A round puff of radius r as rows of palette indices + 1 (0: empty): a 1 px outline, the light from the top left. */
export function puffShape(r: number): string[] {
  const rows: string[] = [];
  const inside = (x: number, y: number): boolean => (x - r + 0.5) ** 2 + (y - r + 0.5) ** 2 <= r * r;
  for (let y = 0; y < 2 * r; y++) {
    let row = '';
    for (let x = 0; x < 2 * r; x++) {
      if (!inside(x, y)) { row += '0'; continue; }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const lit = (x - r + 0.5) + (y - r + 0.5);           // < 0 towards the top left
      row += edge ? '1' : lit < -r * 0.6 ? '4' : lit > r * 0.5 ? '2' : '3';
    }
    rows.push(row);
  }
  return rows;
}

const SHAPES: readonly string[][] = SMOKE_RADII.map(puffShape);

export interface SmokePuff {
  /** Art px from the source point to the puff's centre (integers: whole art pixels). */
  dx: number;
  dy: number;
  /** Index into the shapes: 0 small, 1 medium, 2 large. */
  size: number;
  alpha: number;
}

/** Every puff of one smoke source at time `ms`: evenly staggered phases, each rising, growing and fading. */
export function smokePuffs(ms: number): SmokePuff[] {
  const out: SmokePuff[] = [];
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const u = (((ms / SMOKE_PERIOD_MS + i / SMOKE_PUFFS) % 1) + 1) % 1;
    const fadeIn = Math.min(1, u / 0.12);
    const fadeOut = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45);
    out.push({
      dx: Math.round(Math.sin(u * Math.PI * 1.5 + i * 1.7) * 3 + u * 10),
      dy: -Math.round(u * SMOKE_RISE),
      size: u < 0.22 ? 0 : u < 0.55 ? 1 : 2,
      alpha: Math.round(fadeIn * fadeOut * 0.95 * 100) / 100,
    });
  }
  return out;
}

function shapeGraphics(rows: string[], px: number): Graphics {
  const g = new Graphics();
  const h = rows.length, w = rows[0].length;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '0') g.rect((x - w / 2) * px, (y - h / 2) * px, px, px).fill(SMOKE_PALETTE[Number(ch) - 1]);
  }));
  return g;
}

interface Source { root: Container; puffs: Graphics[][] }

export class FieldAmbient {
  private sources: Source[] = [];
  private ms = 0;
  private pxScale = 1;

  /** Build the effects of `map` in `world` (call after the world container was emptied for the map). */
  setMap(map: MapData, world: Container, tilePx: number = TILE_SIZE): void {
    this.clear();
    const px = tilePx / AMBIENT_CELL_PX;
    for (const e of map.ambient ?? []) {
      if (e.kind !== 'smoke') {
        console.error(`FieldAmbient: unknown ambient kind ${String((e as AmbientEffect).kind)}`);
        continue;
      }
      const root = new Container();
      root.position.set(e.x * tilePx + (e.ox ?? 24) * px, e.y * tilePx + (e.oy ?? 24) * px);
      root.zIndex = aboveZIndex(map) + 1;
      const puffs: Graphics[][] = [];
      for (let i = 0; i < SMOKE_PUFFS; i++) {
        const set = SHAPES.map((s) => shapeGraphics(s, px));
        for (const g of set) root.addChild(g);
        puffs.push(set);
      }
      world.addChild(root);
      this.sources.push({ root, puffs });
    }
    this.draw(px);
  }

  /** `dt` in frames (the game ticker's deltaTime). */
  update(dt: number): void {
    if (!this.sources.length) return;
    this.ms = (this.ms + dt * MS_PER_FRAME) % (SMOKE_PERIOD_MS * 1000);
    this.draw();
  }

  get count(): number {
    return this.sources.length;
  }

  clear(): void {
    for (const s of this.sources) s.root.destroy({ children: true });
    this.sources = [];
  }

  private draw(px?: number): void {
    if (px !== undefined) this.pxScale = px;
    const state = smokePuffs(this.ms);
    for (const s of this.sources) {
      s.puffs.forEach((set, i) => {
        const p = state[i];
        set.forEach((g, k) => {
          g.visible = k === p.size && p.alpha > 0;
          g.alpha = p.alpha;
          g.position.set(p.dx * this.pxScale, p.dy * this.pxScale);
        });
      });
    }
  }
}
