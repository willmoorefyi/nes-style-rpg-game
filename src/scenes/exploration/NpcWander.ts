import type { MapData } from '../../types/index.js';
import type { NPC } from '../../entities/NPC.js';
import { tileKey, type TilePos } from './FieldTiles.js';

/** Wandering NPCs stay within this Manhattan distance of their spawn tile (CT-2). */
export const WANDER_RADIUS = 3;
/** They stand still while the player is this close (Manhattan), so they don't walk off mid-approach (CT-11). */
export const HOLD_DISTANCE = 1;

const NEIGHBOURS: readonly TilePos[] = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

export const manhattan = (a: TilePos, b: TilePos): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Tiles no wandering NPC may step onto (CT-3): transitions and every walkable 4-neighbour of them (the door
 * approach), key-item gates, named entrances, scripted-encounter tiles and the map's own `noWander` list.
 */
export function noWanderTiles(map: MapData, isWalkable: (x: number, y: number) => boolean): Set<string> {
  const tiles = new Set<string>();
  for (const t of map.transitions ?? []) {
    tiles.add(tileKey(t.x, t.y));
    for (const d of NEIGHBOURS) {
      if (isWalkable(t.x + d.x, t.y + d.y)) tiles.add(tileKey(t.x + d.x, t.y + d.y));
    }
  }
  for (const g of map.keyItemGates ?? []) tiles.add(tileKey(g.x, g.y));
  for (const [x, y] of Object.values(map.entrances ?? {})) tiles.add(tileKey(x, y));
  for (const e of map.scriptedEncounters ?? []) tiles.add(tileKey(e.x, e.y));
  for (const [x, y] of map.noWander ?? []) tiles.add(tileKey(x, y));
  return tiles;
}

/** What a wandering NPC needs to know about the field this frame. */
export interface WanderWorld {
  /** Terrain walkability on foot (WalkingMode): no water, walls or counters. */
  isWalkable(x: number, y: number): boolean;
  /** From noWanderTiles for the current map. */
  forbidden: ReadonlySet<string>;
  /** The player's current tile and, while moving, the tile they are stepping onto. */
  playerTiles: readonly TilePos[];
  /** Another NPC stands on (or is walking onto) this tile. */
  isOccupied(x: number, y: number): boolean;
}

/** May an NPC that spawned at `spawn` step onto (x, y)? */
export function canWanderTo(world: WanderWorld, spawn: TilePos, x: number, y: number): boolean {
  if (manhattan(spawn, { x, y }) > WANDER_RADIUS) return false;
  if (!world.isWalkable(x, y)) return false;
  if (world.forbidden.has(tileKey(x, y))) return false;
  if (world.playerTiles.some((p) => p.x === x && p.y === y)) return false;
  return !world.isOccupied(x, y);
}

/** The player is within HOLD_DISTANCE of the NPC: it must not start a step. */
export function playerTooClose(npc: TilePos, playerTiles: readonly TilePos[]): boolean {
  return playerTiles.some((p) => manhattan(npc, p) <= HOLD_DISTANCE);
}

/** Advance every NPC's wander for one frame under the rules above. */
export function updateWanderers(npcs: readonly NPC[], dt: number, world: Omit<WanderWorld, 'isOccupied'>): void {
  for (const npc of npcs) {
    const here = { x: npc.tileX, y: npc.tileY };
    const npcWorld: WanderWorld = {
      ...world,
      isOccupied: (x, y) => npcs.some((o) => o !== npc && o.tileX === x && o.tileY === y),
    };
    npc.update(dt, (x, y) => canWanderTo(npcWorld, npc.spawn, x, y), playerTooClose(here, world.playerTiles));
  }
}
