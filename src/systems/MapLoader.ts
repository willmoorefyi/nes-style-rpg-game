import type { MapData } from '../types/index.js';
import type { DataLoader } from '../core/DataLoader.js';
import { TilemapRenderer } from '../rendering/TilemapRenderer.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import { NPC, type NPCData } from '../entities/NPC.js';
import type { PlaceholderTextures } from '../rendering/PlaceholderTextures.js';

export interface MapLoadResult {
  mapData: MapData;
  tilemap: TilemapRenderer;
  collisionMap: CollisionMap;
  npcs: NPC[];
}

export class MapLoader {
  private dataLoader: DataLoader;
  private placeholders: PlaceholderTextures;

  constructor(dataLoader: DataLoader, placeholders: PlaceholderTextures) {
    this.dataLoader = dataLoader;
    this.placeholders = placeholders;
  }

  async loadMap(mapId: string): Promise<MapLoadResult> {
    const mapData = await this.dataLoader.loadMap(`assets/maps/${mapId}.yaml`);
    const collisionMap = new CollisionMap(mapData);
    const tilemap = new TilemapRenderer(mapData, null, 16, this.placeholders);
    const npcs = mapData.npcs.map(
      npcData => new NPC(npcData as NPCData, this.placeholders.getNPCTexture(npcData.sprite))
    );
    return { mapData, tilemap, collisionMap, npcs };
  }
}
