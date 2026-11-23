import type { MapData } from '../types/index.js';
import { TerrainType } from '../types/index.js';
import type { MovementMode } from '../entities/MovementMode.js';
import { baseTerrain, patchedTerrain } from '../systems/fieldRules.js';
import { canonCell } from '../systems/worldWrap.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';

export class CollisionMap {
  private collision: number[];
  private width: number;
  private height: number;
  private readonly map: MapData;

  /**
   * `hasFlag` reads the live story flags: a map patch (GAP-2: the north bridge, the canal) overrides its cells'
   * terrain while its flag is set (fieldRules.patchedTerrain). Without it no patch applies.
   */
  constructor(mapData: MapData, private readonly hasFlag?: (flag: string) => boolean) {
    this.map = mapData;
    this.collision = mapData.collision;
    this.width = mapData.width;
    this.height = mapData.height;
  }

  /** The flags the map's patches name that are set now (only these can change a cell). */
  private patchFlags(): ReadonlySet<string> {
    const set = new Set<string>();
    if (!this.hasFlag) return set;
    for (const p of this.map.patches ?? []) if (this.hasFlag(p.flag)) set.add(p.flag);
    return set;
  }

  /** WR: the canonical cell of (x, y) on a wrapped map; on a flat map the cell itself, or null when it is off it. */
  wrapCell(x: number, y: number): { x: number; y: number } | null {
    return canonCell(this.map, x, y);
  }

  /** WR: the map's period in px per axis (0 on a flat map). */
  get period(): { x: number; y: number } {
    return this.map.wrap ? { x: this.width * TILE_SIZE, y: this.height * TILE_SIZE } : { x: 0, y: 0 };
  }

  /** Get the terrain type at the given tile coordinates (after the patches whose flag is set; unknown values: Wall) */
  getTerrainType(x: number, y: number): TerrainType {
    const c = this.map.wrap ? this.wrapCell(x, y) : null;
    const tileX = c ? c.x : x;
    const tileY = c ? c.y : y;
    if (!this.map.patches?.length) return baseTerrain(this.map, tileX, tileY);
    return patchedTerrain(this.map, tileX, tileY, this.patchFlags());
  }

  /**
   * Check if a tile is walkable.
   * When a MovementMode is provided, delegates to mode.canMove(terrain).
   * Without a mode, uses legacy behavior: anything != Wall is walkable.
   */
  isWalkable(x: number, y: number, mode?: MovementMode): boolean {
    const c = this.wrapCell(x, y);
    if (!c) return false;
    const tileX = c.x;
    const tileY = c.y;
    const terrain = this.getTerrainType(tileX, tileY);
    if (mode) {
      return mode.canMoveAt ? mode.canMoveAt(tileX, tileY, terrain) : mode.canMove(terrain);
    }
    // Legacy behavior: 1 (Wall) is not walkable, everything else is
    return terrain !== TerrainType.Wall;
  }

  /** Shop counters (collision value 10): blocked, but NPCs behind them can be talked to across them. */
  isCounter(x: number, y: number): boolean {
    const c = this.wrapCell(x, y);
    return c !== null && this.collision[c.y * this.width + c.x] === 10;
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
}
