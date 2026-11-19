/**
 * Looping field effects (LM-INT; types/ambient.ts): a map's `ambient` entries drawn in the world container over the
 * map art and the characters. `smoke`: the volcano's steam billows (smoke/smokeStyles.ts `VOLCANO_SMOKE`, the user's
 * pick of the SMOKE experiment), drawn in art px (48 per cell) scaled to the field tile, so they keep the field art's
 * pixel size; their motion is the pure `smokeState` (smoke/smokeMotion.ts, no PixiJS).
 */
import type { Container } from 'pixi.js';
import type { MapData } from '../../types/index.js';
import { AMBIENT_CELL_PX, type AmbientEffect } from '../../types/ambient.js';
import { aboveZIndex } from '../../rendering/BakedMapRenderer.js';
import { TILE_SIZE } from '../../core/LayoutConstants.js';
import { VOLCANO_SMOKE, type SmokeStyle } from './smoke/smokeStyles.js';
import { SmokeColumn } from './smoke/SmokeColumn.js';

const MS_PER_FRAME = 1000 / 60;

export class FieldAmbient {
  private columns: SmokeColumn[] = [];
  private ms = 0;

  constructor(private readonly style: SmokeStyle = VOLCANO_SMOKE) {}

  /** Build the effects of `map` in `world` (call after the world container was emptied for the map). */
  setMap(map: MapData, world: Container, tilePx: number = TILE_SIZE): void {
    this.clear();
    const px = tilePx / AMBIENT_CELL_PX;
    for (const e of map.ambient ?? []) {
      if (e.kind !== 'smoke') {
        console.error(`FieldAmbient: unknown ambient kind ${String((e as AmbientEffect).kind)}`);
        continue;
      }
      const column = new SmokeColumn(this.style, px);
      column.root.position.set(e.x * tilePx + (e.ox ?? 24) * px, e.y * tilePx + (e.oy ?? 24) * px);
      column.root.zIndex = aboveZIndex(map) + 1;
      world.addChild(column.root);
      this.columns.push(column);
    }
    this.draw();
  }

  /** `dt` in frames (the game ticker's deltaTime). */
  update(dt: number): void {
    if (!this.columns.length) return;
    this.ms = (this.ms + dt * MS_PER_FRAME) % (this.style.periodMs * 1000);
    this.draw();
  }

  get count(): number {
    return this.columns.length;
  }

  /** The smoke sources (read-only; for tests and probes). */
  get sources(): readonly SmokeColumn[] {
    return this.columns;
  }

  clear(): void {
    for (const c of this.columns) c.destroy();
    this.columns = [];
  }

  private draw(): void {
    for (const c of this.columns) c.draw(this.ms);
  }
}
