import { npcPresent, type MapData } from '../types/index.js';
import type { DataLoader } from '../core/DataLoader.js';
import { TilemapRenderer } from '../rendering/TilemapRenderer.js';
import { BakedMapRenderer, loadBakedTextures, type BakedTextures } from '../rendering/BakedMapRenderer.js';
import type { MapRenderer } from '../rendering/MapRenderer.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import { NPC, type NPCData } from '../entities/NPC.js';
import type { PlaceholderTextures } from '../rendering/PlaceholderTextures.js';
import { isPreviewAi } from '../core/artPreview.js';

export const COMPILED_MANIFEST = 'assets/maps/ai/index.yaml';

export interface MapLoadResult {
  mapData: MapData;
  tilemap: MapRenderer;
  collisionMap: CollisionMap;
  npcs: NPC[];
}

export interface MapLoaderOptions {
  /** Use compiled 2x maps (assets/maps/ai/) for the ids in the manifest; default: the ?art=ai preview. */
  preferCompiled?: boolean;
  loadTextures?: (art: NonNullable<MapData['art']>) => Promise<BakedTextures>;
}

export class MapLoader {
  private readonly preferCompiled: boolean;
  private readonly loadTextures: NonNullable<MapLoaderOptions['loadTextures']>;
  private compiled: Promise<Set<string>> | null = null;

  constructor(private dataLoader: DataLoader, private placeholders: PlaceholderTextures, options: MapLoaderOptions = {}) {
    this.preferCompiled = options.preferCompiled ?? isPreviewAi();
    this.loadTextures = options.loadTextures ?? loadBakedTextures;
  }

  /** Path of a map: the compiled file when previewing and the manifest lists the id, else the legacy file. */
  async mapPath(mapId: string): Promise<string> {
    if (this.preferCompiled) {
      this.compiled ??= this.dataLoader.loadMapManifest(COMPILED_MANIFEST).then((ids) => new Set(ids));
      if ((await this.compiled).has(mapId)) return `assets/maps/ai/${mapId}.yaml`;
    }
    return `assets/maps/${mapId}.yaml`;
  }

  /** `hasFlag` filters NPCs by their `showIf` / `hideIf` story flags (all NPCs when omitted). */
  async loadMap(mapId: string, hasFlag?: (flag: string) => boolean): Promise<MapLoadResult> {
    const loaded = await this.dataLoader.loadMap(await this.mapPath(mapId));
    const mapData = hasFlag ? { ...loaded, npcs: loaded.npcs.filter((n) => npcPresent(n, hasFlag)) } : loaded;
    const collisionMap = new CollisionMap(mapData);
    const tilemap: MapRenderer = mapData.art
      ? new BakedMapRenderer(mapData, await this.loadTextures(mapData.art))
      : new TilemapRenderer(mapData, null, 16, this.placeholders);
    const npcs = mapData.npcs.map(
      npcData => new NPC(npcData as NPCData, this.placeholders.getNPCTexture(npcData.sprite), this.placeholders.getNPCFrames(npcData.sprite) ?? undefined)
    );
    // ST-12: chests looted on an earlier visit show as opened
    for (const npc of npcs) if (npc.chestFlag && hasFlag?.(npc.chestFlag)) npc.setOpened();
    return { mapData, tilemap, collisionMap, npcs };
  }
}
