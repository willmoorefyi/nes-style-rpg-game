import { Container } from 'pixi.js';
import { TILE_SIZE as _TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../core/LayoutConstants.js';

export const TILE_SIZE = _TILE_SIZE;
export const VIEWPORT_WIDTH = GAME_WIDTH;
export const VIEWPORT_HEIGHT = GAME_HEIGHT;

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
  /** Screen pixels at the bottom covered by UI (the field HUD's party strip, M12). */
  private insetBottom = 0;
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

  /**
   * Keep the view's bottom `bottom` pixels for UI: targets are centred in the band above it, the map scrolls far
   * enough that its last row clears it, and a map shorter than the band is centred inside the band (M12).
   */
  setViewInsets(insets: { bottom?: number }): void {
    this.insetBottom = Math.max(0, Math.min(insets.bottom ?? 0, VIEWPORT_HEIGHT));
  }

  /** The height of the view above the bottom inset. */
  private get usableHeight(): number {
    return VIEWPORT_HEIGHT - this.insetBottom;
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
    const targetY = this.target.y - this.usableHeight / 2;

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
    return Camera.clampAxis(x, this.mapWidth, VIEWPORT_WIDTH);
  }

  private clampY(y: number): number {
    return Camera.clampAxis(y, this.mapHeight, this.usableHeight);
  }

  /**
   * Keep the view inside the map. An axis on which the map is smaller than the viewport is centred instead (a
   * negative camera offset), so a small room sits in the middle of the screen, not in its top-left corner (IN-2).
   */
  private static clampAxis(pos: number, mapSize: number, viewSize: number): number {
    if (mapSize < viewSize) return -(viewSize - mapSize) / 2;
    return Math.max(0, Math.min(pos, mapSize - viewSize));
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
