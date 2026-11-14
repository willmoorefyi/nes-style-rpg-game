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

/** True when `to` can be reached on foot from `from` (4-connected, walking). */
function reachableOnFoot(map: MapData, col: CollisionMap, from: [number, number], to: { x: number; y: number }): boolean {
  const key = (x: number, y: number) => y * map.width + x;
  const seen = new Set([key(from[0], from[1])]);
  const queue: Array<[number, number]> = [from];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === to.x && y === to.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key(nx, ny))) continue;
      if (!col.isWalkable(nx, ny, walking)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return false;
}

/** A restored position that is blocked in this map, or cut off from the map's first entrance (e.g. a save from the
 *  other map variant, or from before the map was redrawn), moves to that first entrance; maps without entrances keep
 *  the position. */
export function safeSpawn(map: MapData, pos: { x: number; y: number }): { x: number; y: number } {
  const col = new CollisionMap(map);
  const first = map.entrances && Object.values(map.entrances)[0];
  const walkable = col.isWalkable(pos.x, pos.y, walking);
  if (!first) return pos;
  if (walkable && reachableOnFoot(map, col, first, pos)) return pos;
  console.warn(`spawn (${pos.x}, ${pos.y}) is ${walkable ? 'cut off from the first entrance' : 'blocked'} in ${map.id}; `
    + 'using its first entrance');
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
