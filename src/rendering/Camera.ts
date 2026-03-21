import { Container } from 'pixi.js';

export const TILE_SIZE = 16;
export const VIEWPORT_WIDTH = 256;
export const VIEWPORT_HEIGHT = 240;

export interface CameraTarget {
  x: number;
  y: number;
}

export class Camera {
  private _x = 0;
  private _y = 0;
  private mapWidth = 0;
  private mapHeight = 0;
  private target: CameraTarget | null = null;
  readonly container: Container;
  smooth = false;
  smoothSpeed = 0.1;

  constructor(container: Container) {
    this.container = container;
  }

  setMapBounds(widthTiles: number, heightTiles: number): void {
    this.mapWidth = widthTiles * TILE_SIZE;
    this.mapHeight = heightTiles * TILE_SIZE;
  }

  follow(target: CameraTarget): void {
    this.target = target;
  }

  stopFollowing(): void {
    this.target = null;
  }

  setPosition(x: number, y: number): void {
    this._x = this.clampX(x);
    this._y = this.clampY(y);
    this.applyTransform();
  }

  update(): void {
    if (!this.target) return;

    const targetX = this.target.x - VIEWPORT_WIDTH / 2;
    const targetY = this.target.y - VIEWPORT_HEIGHT / 2;

    if (this.smooth) {
      this._x += (this.clampX(targetX) - this._x) * this.smoothSpeed;
      this._y += (this.clampY(targetY) - this._y) * this.smoothSpeed;
    } else {
      this._x = this.clampX(targetX);
      this._y = this.clampY(targetY);
    }

    this.applyTransform();
  }

  private clampX(x: number): number {
    const maxX = Math.max(0, this.mapWidth - VIEWPORT_WIDTH);
    return Math.max(0, Math.min(x, maxX));
  }

  private clampY(y: number): number {
    const maxY = Math.max(0, this.mapHeight - VIEWPORT_HEIGHT);
    return Math.max(0, Math.min(y, maxY));
  }

  private applyTransform(): void {
    this.container.x = -Math.round(this._x);
    this.container.y = -Math.round(this._y);
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return { x: worldX - this._x, y: worldY - this._y };
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: screenX + this._x, y: screenY + this._y };
  }

  get x(): number { return this._x; }
  get y(): number { return this._y; }

  getVisibleTileBounds(): { startX: number; startY: number; endX: number; endY: number } {
    const startX = Math.floor(this._x / TILE_SIZE);
    const startY = Math.floor(this._y / TILE_SIZE);
    const endX = Math.ceil((this._x + VIEWPORT_WIDTH) / TILE_SIZE);
    const endY = Math.ceil((this._y + VIEWPORT_HEIGHT) / TILE_SIZE);
    return { startX, startY, endX, endY };
  }
}
