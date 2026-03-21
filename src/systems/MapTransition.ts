import type { MapData, MapTransition as TransitionData } from '../types/index.js';
import type { DataLoader } from '../core/DataLoader.js';

export interface TransitionResult {
  mapData: MapData;
  spawnX: number;
  spawnY: number;
}

export class MapTransitionSystem {
  private transitions: TransitionData[] = [];
  private dataLoader: DataLoader;

  constructor(dataLoader: DataLoader) {
    this.dataLoader = dataLoader;
  }

  setTransitions(transitions: TransitionData[]): void {
    this.transitions = transitions;
  }

  getTransitionAt(x: number, y: number): TransitionData | null {
    return this.transitions.find(t => t.x === x && t.y === y) ?? null;
  }

  async loadMap(mapId: string): Promise<MapData | null> {
    try {
      return await this.dataLoader.loadMap(`assets/maps/${mapId}.json`);
    } catch {
      return null;
    }
  }

  async executeTransition(transition: TransitionData): Promise<TransitionResult | null> {
    const mapData = await this.loadMap(transition.targetMap);
    if (!mapData) return null;
    return {
      mapData,
      spawnX: transition.targetX,
      spawnY: transition.targetY,
    };
  }
}
