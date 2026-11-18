import { npcPresent, type MapData, type MapNPC } from '../types/index.js';
import type { DataLoader } from '../core/DataLoader.js';
import { TilemapRenderer } from '../rendering/TilemapRenderer.js';
import { BakedMapRenderer, loadBakedTextures, type BakedTextures } from '../rendering/BakedMapRenderer.js';
import { streams, type ChunkSource } from '../rendering/chunkStreaming.js';
import type { MapRenderer } from '../rendering/MapRenderer.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import type { MovementMode } from '../entities/MovementMode.js';
import { NPC, type NPCData } from '../entities/NPC.js';
import type { PlaceholderTextures } from '../rendering/PlaceholderTextures.js';
import { isPreviewAi } from '../core/artPreview.js';

export const COMPILED_MANIFEST = 'assets/maps/ai/index.yaml';

export interface MapLoadResult {
  mapData: MapData;
  tilemap: MapRenderer;
  collisionMap: CollisionMap;
  npcs: NPC[];
  /** Every NPC of the map, those a story flag hides included (they appear when the flag changes, P3-03). */
  npcDefs: MapNPC[];
}

export interface MapLoaderOptions {
  /** Use compiled 2x maps (assets/maps/ai/) for the ids in the manifest; default: the ?art=ai preview. */
  preferCompiled?: boolean;
  loadTextures?: (art: NonNullable<MapData['art']>) => Promise<BakedTextures>;
  /** Chunk textures of a streamed map (default: `Assets.load` / `Assets.unload`). */
  chunkSource?: ChunkSource;
}

/** The collision of a streamed map: a step is refused while `held` says the view there is not loaded yet. */
class StreamedCollisionMap extends CollisionMap {
  constructor(map: MapData, hasFlag: ((flag: string) => boolean) | undefined,
    private readonly held: (x: number, y: number) => boolean) {
    super(map, hasFlag);
  }

  override isWalkable(tileX: number, tileY: number, mode?: MovementMode): boolean {
    return super.isWalkable(tileX, tileY, mode) && !this.held(tileX, tileY);
  }
}

/** Path of a map: the compiled file when `preferCompiled` and the manifest lists the id, else the legacy file. */
export async function resolveMapPath(loader: Pick<DataLoader, 'loadMapManifest'>, mapId: string, preferCompiled: boolean,
  manifest = () => loader.loadMapManifest(COMPILED_MANIFEST).then((ids) => new Set(ids))): Promise<string> {
  if (preferCompiled && (await manifest()).has(mapId)) return `assets/maps/ai/${mapId}.yaml`;
  return `assets/maps/${mapId}.yaml`;
}

export class MapLoader {
  private readonly preferCompiled: boolean;
  private readonly loadTextures: NonNullable<MapLoaderOptions['loadTextures']>;
  private readonly chunkSource?: ChunkSource;
  private compiled: Promise<Set<string>> | null = null;

  constructor(private dataLoader: DataLoader, private placeholders: PlaceholderTextures, options: MapLoaderOptions = {}) {
    this.preferCompiled = options.preferCompiled ?? isPreviewAi();
    this.chunkSource = options.chunkSource;
    this.loadTextures = options.loadTextures ?? ((art) => loadBakedTextures(art, options.chunkSource));
  }

  /** Path of a map: the compiled file when previewing and the manifest lists the id, else the legacy file. */
  async mapPath(mapId: string): Promise<string> {
    return resolveMapPath(this.dataLoader, mapId, this.preferCompiled,
      () => (this.compiled ??= this.dataLoader.loadMapManifest(COMPILED_MANIFEST).then((ids) => new Set(ids))));
  }

  /** `hasFlag` filters NPCs by their `showIf` / `hideIf` story flags (all NPCs when omitted). */
  async loadMap(mapId: string, hasFlag?: (flag: string) => boolean): Promise<MapLoadResult> {
    const loaded = await this.dataLoader.loadMap(await this.mapPath(mapId));
    const mapData = hasFlag ? { ...loaded, npcs: loaded.npcs.filter((n) => npcPresent(n, hasFlag)) } : loaded;
    const collisionMap = new CollisionMap(mapData, hasFlag); // live flags: patches (GAP-2, W1-B)
    const baked = mapData.art
      ? new BakedMapRenderer(mapData, await this.loadTextures(mapData.art), { hasFlag, source: this.chunkSource })
      : null;
    const tilemap: MapRenderer = baked ?? new TilemapRenderer(mapData, null, 16, this.placeholders);
    // a streamed map holds a step while the view there is not loaded yet (at most MISS_HOLD_FRAMES frames, W1-E)
    const collision = baked && mapData.art && streams(mapData.art)
      ? new StreamedCollisionMap(mapData, hasFlag, (x, y) => baked.stepHeld(x, y)) : collisionMap;
    const npcs = mapData.npcs.map((npcData) => this.createNpc(npcData, hasFlag));
    return { mapData, tilemap, collisionMap: collision, npcs, npcDefs: loaded.npcs };
  }

  /** One NPC from its map def (also for a def a flag change brings into the map); a looted chest shows as opened. */
  createNpc(def: MapNPC, hasFlag?: (flag: string) => boolean): NPC {
    const npc = new NPC(def as NPCData, this.placeholders.getNPCTexture(def.sprite),
      this.placeholders.getNPCFrames(def.sprite) ?? undefined);
    // ST-12: chests looted on an earlier visit show as opened
    if (npc.chestFlag && hasFlag?.(npc.chestFlag)) npc.setOpened();
    return npc;
  }
}
