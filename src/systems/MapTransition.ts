import type { FieldMode, MapData, MapTransition as TransitionData, VehicleState } from '../types/index.js';
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

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [-1, 0], [1, 0]];

/** Cells (as y * width + x) reachable on foot from any of `starts` (4-connected, walking). */
function reachableOnFoot(map: MapData, col: CollisionMap, starts: ReadonlyArray<readonly [number, number]>): Set<number> {
  const key = (x: number, y: number) => y * map.width + x;
  const seen = new Set<number>();
  const queue: Array<readonly [number, number]> = [];
  for (const [x, y] of starts) {
    if (!col.isWalkable(x, y, walking) || seen.has(key(x, y))) continue;
    seen.add(key(x, y));
    queue.push([x, y]);
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key(nx, ny))) continue;
      if (!col.isWalkable(nx, ny, walking)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/** Where a restored position may stand: walkable, not a warp, and reachable on foot from one of the map's entrances
 *  (e.g. the north shore of the overworld counts, though the first entrance cannot reach it). A spawn on a warp
 *  steps off it onto a good neighbouring cell (the doorway in front of it), so loading a save never fires the warp;
 *  anything else (blocked, cut off, a save from the other map variant or from before the map was redrawn) moves to
 *  the first entrance. Maps without entrances keep the position. `_mode` and `_vehicles` are declared for GAP-11
 *  (W1-A keeps a position valid in the saved mode or on a parked vehicle); today the check is on foot only. */
export function safeSpawn(map: MapData, pos: { x: number; y: number }, _mode?: FieldMode,
  _vehicles?: readonly VehicleState[]): { x: number; y: number } {
  const entrances = map.entrances ? Object.values(map.entrances) : [];
  if (!entrances.length) return pos;
  const col = new CollisionMap(map);
  const seen = reachableOnFoot(map, col, entrances);
  const warps = new Set(map.transitions.map((t) => t.y * map.width + t.x));
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  const good = (x: number, y: number) => inside(x, y) && seen.has(y * map.width + x) && !warps.has(y * map.width + x);
  if (good(pos.x, pos.y)) return pos;
  if (inside(pos.x, pos.y) && warps.has(pos.y * map.width + pos.x)) {
    const off = DIRS.map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy })).find((c) => good(c.x, c.y));
    if (off) {
      console.warn(`spawn (${pos.x}, ${pos.y}) is on a warp in ${map.id}; stepping off to (${off.x}, ${off.y})`);
      return off;
    }
  }
  const why = !inside(pos.x, pos.y) || !col.isWalkable(pos.x, pos.y, walking) ? 'blocked'
    : warps.has(pos.y * map.width + pos.x) ? 'on a warp' : 'cut off from every entrance';
  console.warn(`spawn (${pos.x}, ${pos.y}) is ${why} in ${map.id}; using its first entrance`);
  return { x: entrances[0][0], y: entrances[0][1] };
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
