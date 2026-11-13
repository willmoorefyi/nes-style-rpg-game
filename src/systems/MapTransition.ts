import type { MapData, MapTransition as TransitionData } from '../types/index.js';
import type { DataLoader } from '../core/DataLoader.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import { WalkingMode } from '../entities/WalkingMode.js';

const walking = new WalkingMode();

/** Cell of a named entrance; an unknown name is a content error. */
export function entrancePosition(map: MapData, name: string): { x: number; y: number } {
  const e = map.entrances?.[name];
  if (!e) throw new Error(`map ${map.id} has no entrance '${name}'`);
  return { x: e[0], y: e[1] };
}

/** Where a transition puts the player in the (already loaded) target map. */
export function arrivalFor(t: TransitionData, target: MapData): { x: number; y: number } {
  if (t.targetEntrance !== undefined) return entrancePosition(target, t.targetEntrance);
  return { x: t.targetX, y: t.targetY };
}

/** A restored position that is blocked in this map (e.g. a save from the other map variant) moves to the map's first
 *  entrance; maps without entrances keep the position. */
export function safeSpawn(map: MapData, pos: { x: number; y: number }): { x: number; y: number } {
  if (new CollisionMap(map).isWalkable(pos.x, pos.y, walking)) return pos;
  const first = map.entrances && Object.values(map.entrances)[0];
  if (!first) return pos;
  console.warn(`spawn (${pos.x}, ${pos.y}) is blocked in ${map.id}; using its first entrance`);
  return { x: first[0], y: first[1] };
}

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
      return await this.dataLoader.loadMap(`assets/maps/${mapId}.yaml`);
    } catch (e) {
      console.error(`Failed to load map for transition: ${mapId}`, e);
      return null;
    }
  }

  async executeTransition(transition: TransitionData): Promise<TransitionResult | null> {
    const mapData = await this.loadMap(transition.targetMap);
    if (!mapData) return null;
    const at = arrivalFor(transition, mapData);
    return { mapData, spawnX: at.x, spawnY: at.y };
  }
}
