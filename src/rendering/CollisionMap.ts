import type { MapData } from '../types/index.js';
import { TerrainType } from '../types/index.js';
import type { MovementMode } from '../entities/MovementMode.js';

export class CollisionMap {
  private collision: number[];
  private width: number;
  private height: number;

  constructor(mapData: MapData) {
    this.collision = mapData.collision;
    this.width = mapData.width;
    this.height = mapData.height;
  }

  /** Get the terrain type at the given tile coordinates */
  getTerrainType(tileX: number, tileY: number): TerrainType {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return TerrainType.Wall;
    }
    const index = tileY * this.width + tileX;
    const value = this.collision[index];
    // Values map directly to TerrainType enum (0=Grass, 1=Wall, etc.)
    // Unknown values treated as Wall for safety
    if (value >= 0 && value <= 9) return value as TerrainType;
    return TerrainType.Wall;
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
      return mode.canMove(terrain);
    }
    // Legacy behavior: 1 (Wall) is not walkable, everything else is
    return terrain !== TerrainType.Wall;
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
}
