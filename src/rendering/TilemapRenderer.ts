import { Container, Sprite, Texture, Rectangle } from 'pixi.js';
import type { MapData } from '../types/index.js';
import { Camera, TILE_SIZE } from './Camera.js';

export class TilemapRenderer {
  readonly container: Container;
  private mapData: MapData;
  private tileTextures: Texture[] = [];
  private layerContainers: Container[] = [];
  private spritePool: Sprite[][] = [];
  private camera: Camera | null = null;

  constructor(mapData: MapData, tilesetTexture: Texture, tilesPerRow: number) {
    this.mapData = mapData;
    this.container = new Container();
    this.buildTileTextures(tilesetTexture, tilesPerRow);
    this.initLayers();
  }

  private buildTileTextures(tileset: Texture, tilesPerRow: number): void {
    const source = tileset.source;
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
  }

  render(): void {
    const bounds = this.camera
      ? this.camera.getVisibleTileBounds()
      : { startX: 0, startY: 0, endX: this.mapData.width, endY: this.mapData.height };

    const { startX, startY, endX, endY } = bounds;
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

          sprite.texture = this.tileTextures[tileId - 1] || Texture.EMPTY;
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
