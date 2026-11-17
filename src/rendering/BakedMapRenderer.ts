import { Container, Sprite, type Texture } from 'pixi.js';
import type { BakedMapArt, MapData } from '../types/index.js';
import type { Camera } from './Camera.js';
import type { MapRenderer } from './MapRenderer.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
import { assetChunkSource, chunkRect, streams, type ChunkSource } from './chunkStreaming.js';
import { StreamedChunks } from './StreamedChunks.js';

export interface BakedTextures {
  /** Every chunk of a small map; all null on a streamed map (its chunks load as the view moves). */
  below: (Texture | null)[];
  above: (Texture | null)[];
  /** Patch overlay art by patch id (`art.patches`). */
  patches?: Record<string, Texture>;
}

/** Load a compiled map's art (nearest scaling) before the map is shown, so the first frame is complete: every chunk
 *  of a small map, only the patch overlays of a streamed one. A patch overlay that fails to load is logged and left out. */
export async function loadBakedTextures(art: BakedMapArt, source: ChunkSource = assetChunkSource): Promise<BakedTextures> {
  const stream = streams(art);
  const below = stream ? art.below.map(() => null) : await Promise.all(art.below.map((p) => source.load(p)));
  const above = stream ? art.above.map(() => null)
    : await Promise.all(art.above.map((p) => (p ? source.load(p) : Promise.resolve(null))));
  const patches: Record<string, Texture> = {};
  await Promise.all(Object.entries(art.patches ?? {}).map(([id, p]) => source.load(p).then((t) => { patches[id] = t; },
    (err: unknown) => console.error(`Map art: could not load the patch overlay ${p}`, err))));
  return { below, above, patches };
}

/** z-order of the above layer: higher than any character's feet (`zIndex = y + frameHeight`) on this map. */
export function aboveZIndex(map: Pick<MapData, 'height'>): number {
  return (map.height + 2) * TILE_SIZE;
}

export interface BakedMapOptions {
  /** Live story flags: a patch overlay shows while its flag is set (none without it, like `CollisionMap`). */
  hasFlag?: (flag: string) => boolean;
  /** Chunk textures of a streamed map (default: `Assets.load` / `Assets.unload`). */
  source?: ChunkSource;
}

interface PatchSprite { sprite: Sprite; flag: string; x0: number; y0: number; x1: number; y1: number }

/** Draws a map baked by assets-src/tools/build_map.py: `below` chunks under the characters, `above` chunks over them,
 *  and each patch's overlay above the below layer while its flag is set. Chunks outside the camera view are hidden.
 *  A map of more than 64 chunks streams them (`StreamedChunks`, QUEST 4.3). */
export class BakedMapRenderer implements MapRenderer {
  readonly container = new Container();
  readonly aboveContainer = new Container();
  private readonly chunks: { sprite: Sprite; col: number; row: number }[] = [];
  private readonly patchSprites: PatchSprite[] = [];
  private readonly streamed: StreamedChunks | null = null;
  private camera: Camera | null = null;
  private readonly chunkPx: number;
  private readonly chunkTiles: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly scale: number;
  private readonly hasFlag?: (flag: string) => boolean;

  constructor(private readonly mapData: MapData, textures: BakedTextures, options: BakedMapOptions = {}) {
    const art = mapData.art;
    if (!art) throw new Error(`map ${mapData.id} has no baked art`);
    this.hasFlag = options.hasFlag;
    this.scale = TILE_SIZE / art.tile;
    this.chunkTiles = art.chunk;
    this.chunkPx = art.chunk * TILE_SIZE;
    this.cols = Math.ceil(mapData.width / art.chunk);
    this.rows = Math.ceil(mapData.height / art.chunk);
    this.container.zIndex = -1;
    this.aboveContainer.zIndex = aboveZIndex(mapData);
    if (streams(art)) {
      this.container.sortableChildren = true;
      const streamed = new StreamedChunks(mapData, art, options.source ?? assetChunkSource, this.container,
        this.aboveContainer, (tex, i, parent) => this.chunkSprite(tex, i, parent));
      this.streamed = streamed;
      this.container.on('removed', () => streamed.dispose());   // the map was left: free its chunks
    } else {
      const add = (tex: Texture | null, i: number, parent: Container): void => {
        if (!tex) return;
        this.chunks.push({ sprite: this.chunkSprite(tex, i, parent), col: i % this.cols, row: Math.floor(i / this.cols) });
      };
      textures.below.forEach((t, i) => add(t, i, this.container));
      textures.above.forEach((t, i) => add(t, i, this.aboveContainer));
    }
    this.addPatches(textures.patches ?? {});
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
    const inView = (x0: number, y0: number, x1: number, y1: number): boolean =>
      x0 < b.endX && x1 > b.startX && y0 < b.endY && y1 > b.startY;
    for (const c of this.chunks) {
      const x0 = c.col * this.chunkTiles;
      const y0 = c.row * this.chunkTiles;
      c.sprite.visible = inView(x0, y0, x0 + this.chunkTiles, y0 + this.chunkTiles);
    }
    for (const p of this.patchSprites) p.sprite.visible = (this.hasFlag?.(p.flag) ?? false) && inView(p.x0, p.y0, p.x1, p.y1);
    this.streamed?.update(chunkRect(b.startX, b.startY, b.endX, b.endY, this.chunkTiles, this.cols, this.rows),
      this.camera.x, this.camera.y);
  }

  /** A step onto tile (x, y) waits (true) while the view there is not loaded yet, for at most 6 frames per miss.
   *  Always false on a small map and before the first render. */
  stepHeld(x: number, y: number): boolean {
    return this.streamed?.stepHeld(x, y) ?? false;
  }

  /** Resolves once every chunk in view is loaded (at once on a small map). */
  ready(): Promise<void> {
    return this.streamed?.ready() ?? Promise.resolve();
  }

  /** Resident chunk textures (loaded or loading), both layers; 0 on a small map. */
  get residentTextures(): number { return this.streamed?.count ?? 0; }

  get width(): number { return this.mapData.width; }
  get height(): number { return this.mapData.height; }

  private chunkSprite(tex: Texture, i: number, parent: Container): Sprite {
    const sprite = new Sprite(tex);
    sprite.scale.set(this.scale);
    sprite.position.set((i % this.cols) * this.chunkPx, Math.floor(i / this.cols) * this.chunkPx);
    parent.addChild(sprite);
    return sprite;
  }

  /** The patch overlays: each PNG covers its cells' bounding box from the top-left cell (build_hooks.bake_patches). */
  private addPatches(textures: Record<string, Texture>): void {
    for (const p of this.mapData.patches ?? []) {
      const tex = textures[p.id];
      if (!tex || p.cells.length === 0) continue;
      const xs = p.cells.map((c) => c[0]);
      const ys = p.cells.map((c) => c[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const sprite = new Sprite(tex);
      sprite.scale.set(this.scale);
      sprite.position.set(x0 * TILE_SIZE, y0 * TILE_SIZE);
      sprite.zIndex = 1;   // over the below chunks (and their placeholders) of a streamed map
      sprite.visible = false;
      this.container.addChild(sprite);
      this.patchSprites.push({ sprite, flag: p.flag, x0, y0, x1: Math.max(...xs) + 1, y1: Math.max(...ys) + 1 });
    }
  }
}
