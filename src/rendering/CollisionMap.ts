import type { MapData } from '../types/index.js';
import { TerrainType } from '../types/index.js';
import type { MovementMode } from '../entities/MovementMode.js';
import { baseTerrain, patchedTerrain } from '../systems/fieldRules.js';

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

  /** Get the terrain type at the given tile coordinates (after the patches whose flag is set; unknown values: Wall) */
  getTerrainType(tileX: number, tileY: number): TerrainType {
    if (!this.map.patches?.length) return baseTerrain(this.map, tileX, tileY);
    return patchedTerrain(this.map, tileX, tileY, this.patchFlags());
  }

  /**
   * Check if a tile is walkable.
   * When a MovementMode is provided, delegates to mode.canMove(terrain).
   * Without a mode, uses legacy behavior: anything != Wall is walkable.
   */
  isWalkable(tileX: number, tileY: number, mode?: MovementMode): boolean {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return false;
    }
    const terrain = this.getTerrainType(tileX, tileY);
    if (mode) {
      return mode.canMoveAt ? mode.canMoveAt(tileX, tileY, terrain) : mode.canMove(terrain);
    }
    // Legacy behavior: 1 (Wall) is not walkable, everything else is
    return terrain !== TerrainType.Wall;
  }

  /** Shop counters (collision value 10): blocked, but NPCs behind them can be talked to across them. */
  isCounter(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) return false;
    return this.collision[tileY * this.width + tileX] === 10;
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
}
