import type { FieldMode, MapData, MapTransition as TransitionData, ParkedVehicle, VehicleState } from '../types/index.js';
import type { DataLoader } from '../core/DataLoader.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import { WalkingMode } from '../entities/WalkingMode.js';
import { terrainAllows } from './fieldRules.js';
import { hasCell, resolveParked } from './VehicleManager.js';

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

/** Whether a party in `mode` may stay on the cell: in the map, and (but for the airship) on its mode's terrain. */
function validInMode(map: MapData, col: CollisionMap, pos: { x: number; y: number }, mode: FieldMode): boolean {
  if (pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height) return false;
  return mode === 'airship' || terrainAllows(mode, col.getTerrainType(pos.x, pos.y));
}

/** Where a restored position may stand (GAP-11, mode-aware). A party in a vehicle keeps a position that is valid in
 *  that mode (the ship on Water, the canoe on River or Lake, the airship anywhere on the map). On foot it must be
 *  walkable, not a warp, and reachable on foot from one of the map's entrances or from a vehicle parked on this map
 *  (e.g. the north shore of the overworld, or land the ship docked at, though the first entrance cannot reach it). A
 *  spawn on a warp steps off it onto a good neighbouring cell (the doorway in front of it), so loading a save never
 *  fires the warp; anything else (blocked, cut off, a save from the other map variant or from before the map was
 *  redrawn) moves to the first entrance, on foot. Maps without entrances keep the position. */
export function safeSpawn(map: MapData, pos: { x: number; y: number }, mode: FieldMode = 'walking',
  vehicles: readonly VehicleState[] = []): { x: number; y: number } {
  const entrances = map.entrances ? Object.values(map.entrances) : [];
  if (!entrances.length) return pos;
  const col = new CollisionMap(map);
  if (mode !== 'walking' && validInMode(map, col, pos, mode)) return pos;
  const parked = vehicles.filter((v) => v.map === map.id)
    .flatMap((v) => [[v.x, v.y] as const, ...DIRS.map(([dx, dy]) => [v.x + dx, v.y + dy] as const)]);
  const seen = reachableOnFoot(map, col, [...entrances, ...parked]);
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
  const why = mode !== 'walking' ? `no place for the ${mode}`
    : !inside(pos.x, pos.y) || !col.isWalkable(pos.x, pos.y, walking) ? 'blocked'
      : warps.has(pos.y * map.width + pos.x) ? 'on a warp' : 'cut off from every entrance';
  console.warn(`spawn (${pos.x}, ${pos.y}) is ${why} in ${map.id}; using its first entrance`);
  return { x: entrances[0][0], y: entrances[0][1] };
}

/** The part of Game a restored field position reads and writes (load, retry, a debug scenario). */
export interface RestoredField {
  playerPosition: { x: number; y: number };
  fieldMode: FieldMode;
  vehicles: ParkedVehicle[];
  pendingFrame: 'a1' | null;
}

/** An act-1 overworld cell in the map's frame: moved by `overworld`'s `world.frames.a1.origin` (GAP-17), else kept. */
export function shiftA1(map: Pick<MapData, 'id' | 'world'>, pos: { x: number; y: number }): { x: number; y: number } {
  const o = map.id === 'overworld' ? map.world?.frames?.a1?.origin : undefined;
  return o ? { x: pos.x + o[0], y: pos.y + o[1] } : pos;
}

/**
 * Where the party stands on entering `map` after a load, a retry or a scenario: a version-1 overworld position is
 * first translated into the world frame (GAP-17's save half; once), then `safeSpawn` checks it in the saved mode
 * with the parked vehicles (GAP-11). A position moved elsewhere is on foot.
 */
export function restoredSpawn(map: MapData, game: RestoredField): { x: number; y: number } {
  if (game.pendingFrame === 'a1') game.playerPosition = shiftA1(map, game.playerPosition);
  game.pendingFrame = null;
  const pos = safeSpawn(map, game.playerPosition, game.fieldMode, resolveParked(game.vehicles ?? [], map).filter(hasCell));
  const moved = pos.x !== game.playerPosition.x || pos.y !== game.playerPosition.y;
  if (moved || !validInMode(map, new CollisionMap(map), pos, game.fieldMode)) game.fieldMode = 'walking';
  return pos;
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
