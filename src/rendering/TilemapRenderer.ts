import { Container, Sprite, Texture, Rectangle } from 'pixi.js';
import type { MapData } from '../types/index.js';
import { Camera, TILE_SIZE } from './Camera.js';
import type { PlaceholderTextures } from './PlaceholderTextures.js';

export class TilemapRenderer {
  readonly container: Container;
  private mapData: MapData;
  private tileTextures: Texture[] = [];
  private layerContainers: Container[] = [];
  private spritePool: Sprite[][] = [];
  private camera: Camera | null = null;
  private placeholders: PlaceholderTextures | null = null;
  private dirty = true;
  private lastBounds = { startX: -1, startY: -1, endX: -1, endY: -1 };

  constructor(mapData: MapData, tilesetTexture: Texture | null, tilesPerRow: number, placeholders?: PlaceholderTextures) {
    this.mapData = mapData;
    this.container = new Container();
    this.placeholders = placeholders ?? null;
    this.buildTileTextures(tilesetTexture, tilesPerRow);
    this.initLayers();
  }

  private buildTileTextures(tileset: Texture | null, tilesPerRow: number): void {
    // If using placeholders, don't pre-build textures - we'll get them per-tile
    if (this.placeholders || !tileset) {
      return;
    }

    const source = tileset.source;
    
    // Handle fallback textures (like Texture.WHITE) that are too small to slice
    if (source.width < TILE_SIZE || source.height < TILE_SIZE) {
      for (let i = 0; i < tilesPerRow * tilesPerRow; i++) {
        this.tileTextures.push(tileset);
      }
      return;
    }
    
    const tileCount = tilesPerRow * Math.ceil(tileset.height / TILE_SIZE);
    
    for (let i = 0; i < tileCount; i++) {
      const x = (i % tilesPerRow) * TILE_SIZE;
      const y = Math.floor(i / tilesPerRow) * TILE_SIZE;
      this.tileTextures.push(new Texture({
        source,
        frame: new Rectangle(x, y, TILE_SIZE, TILE_SIZE),
      }));
    }
  }

  private initLayers(): void {
    for (let i = 0; i < this.mapData.layers.length; i++) {
      const layerContainer = new Container();
      this.container.addChild(layerContainer);
      this.layerContainers.push(layerContainer);
      this.spritePool.push([]);
    }
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  private getTileTexture(tileId: number): Texture {
    if (this.placeholders) {
      return this.placeholders.getTileTexture(tileId);
    }
    return this.tileTextures[tileId - 1] || Texture.EMPTY;
  }

  render(): void {
    const bounds = this.camera
      ? this.camera.getVisibleTileBounds()
      : { startX: 0, startY: 0, endX: this.mapData.width, endY: this.mapData.height };

    const { startX, startY, endX, endY } = bounds;

    // Skip render if bounds haven't changed and not dirty
    if (!this.dirty &&
        startX === this.lastBounds.startX &&
        startY === this.lastBounds.startY &&
        endX === this.lastBounds.endX &&
        endY === this.lastBounds.endY) {
      return;
    }

    this.lastBounds = { startX, startY, endX, endY };
    this.dirty = false;

    const clampedStartX = Math.max(0, startX);
    const clampedStartY = Math.max(0, startY);
    const clampedEndX = Math.min(this.mapData.width, endX);
    const clampedEndY = Math.min(this.mapData.height, endY);

    for (let layerIdx = 0; layerIdx < this.mapData.layers.length; layerIdx++) {
      const layer = this.mapData.layers[layerIdx];
      const layerContainer = this.layerContainers[layerIdx];
      const pool = this.spritePool[layerIdx];

      // Hide all sprites first
      for (const sprite of pool) {
        sprite.visible = false;
      }

      let spriteIdx = 0;
      for (let y = clampedStartY; y < clampedEndY; y++) {
        for (let x = clampedStartX; x < clampedEndX; x++) {
          const tileId = layer[y * this.mapData.width + x];
          if (tileId === 0) continue; // Skip empty tiles

          let sprite: Sprite;
          if (spriteIdx < pool.length) {
            sprite = pool[spriteIdx];
          } else {
            sprite = new Sprite();
            pool.push(sprite);
            layerContainer.addChild(sprite);
          }

          sprite.texture = this.getTileTexture(tileId);
          sprite.x = x * TILE_SIZE;
          sprite.y = y * TILE_SIZE;
          sprite.visible = true;
          spriteIdx++;
        }
      }
    }
  }

  get width(): number { return this.mapData.width; }
  get height(): number { return this.mapData.height; }
}
