import type { MapData } from '../types/index.js';

export class CollisionMap {
  private collision: number[];
  private width: number;
  private height: number;

  constructor(mapData: MapData) {
    this.collision = mapData.collision;
    this.width = mapData.width;
    this.height = mapData.height;
  }

  isWalkable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return false;
    }
    const index = tileY * this.width + tileX;
    return this.collision[index] === 0;
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
}
