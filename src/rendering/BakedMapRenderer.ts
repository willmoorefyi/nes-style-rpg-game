import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import type { BakedMapArt, MapData } from '../types/index.js';
import type { Camera } from './Camera.js';
import type { MapRenderer } from './MapRenderer.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';

export interface BakedTextures {
  below: Texture[];
  above: (Texture | null)[];
}

/** Load every chunk of a compiled map (nearest scaling) before the map is shown, so the first frame is complete. */
export async function loadBakedTextures(art: BakedMapArt): Promise<BakedTextures> {
  const load = async (path: string): Promise<Texture> => {
    const tex = await Assets.load<Texture>(path);
    tex.source.scaleMode = 'nearest';
    return tex;
  };
  const below = await Promise.all(art.below.map(load));
  const above = await Promise.all(art.above.map((p) => (p ? load(p) : Promise.resolve(null))));
  return { below, above };
}

/** z-order of the above layer: higher than any character's feet (`zIndex = y + frameHeight`) on this map. */
export function aboveZIndex(map: Pick<MapData, 'height'>): number {
  return (map.height + 2) * TILE_SIZE;
}

/** Draws a map baked by assets-src/tools/build_map.py: `below` chunks under the characters, `above` chunks over them.
 *  Chunks outside the camera view are hidden. */
export class BakedMapRenderer implements MapRenderer {
  readonly container = new Container();
  readonly aboveContainer = new Container();
  private readonly chunks: { sprite: Sprite; col: number; row: number }[] = [];
  private camera: Camera | null = null;
  private readonly chunkPx: number;
  private readonly cols: number;

  constructor(private readonly mapData: MapData, textures: BakedTextures) {
    const art = mapData.art;
    if (!art) throw new Error(`map ${mapData.id} has no baked art`);
    const scale = TILE_SIZE / art.tile;
    this.chunkPx = art.chunk * TILE_SIZE;
    this.cols = Math.ceil(mapData.width / art.chunk);
    this.container.zIndex = -1;
    this.aboveContainer.zIndex = aboveZIndex(mapData);
    const add = (tex: Texture | null, i: number, parent: Container): void => {
      if (!tex) return;
      const sprite = new Sprite(tex);
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      sprite.scale.set(scale);
      sprite.position.set(col * this.chunkPx, row * this.chunkPx);
      parent.addChild(sprite);
      this.chunks.push({ sprite, col, row });
    };
    textures.below.forEach((t, i) => add(t, i, this.container));
    textures.above.forEach((t, i) => add(t, i, this.aboveContainer));
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  markDirty(): void {
    // chunks are static; visibility is recomputed on every render
  }

  render(): void {
    if (!this.camera) return;
    const b = this.camera.getVisibleTileBounds();
    const chunkTiles = this.chunkPx / TILE_SIZE;
    for (const c of this.chunks) {
      const x0 = c.col * chunkTiles;
      const y0 = c.row * chunkTiles;
      c.sprite.visible = x0 < b.endX && x0 + chunkTiles > b.startX && y0 < b.endY && y0 + chunkTiles > b.startY;
    }
  }

  get width(): number { return this.mapData.width; }
  get height(): number { return this.mapData.height; }
}
