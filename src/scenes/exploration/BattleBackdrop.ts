import type { MapData } from '../../types/index.js';
import type { TilePos } from './FieldTiles.js';

/** A map's `battleBackgrounds` table (possibly missing). */
export type BattleBackdropConfig = MapData['battleBackgrounds'];

/** TerrainType name at a cell (e.g. `'FOREST'`, any case), or undefined off the map / without a collision map. */
export type TerrainAt = (x: number, y: number) => string | undefined;

/** A grass cell with at least this many forest 4-neighbours counts as forest (organic outlines draw forest over it);
 * NW2: the same for taiga, ties between the two going to forest. */
export const FOREST_EDGE_NEIGHBOURS = 2;

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Lowercase terrain at `pos`, with grass on a forest (or taiga) edge read as forest (taiga); undefined when unknown. */
export function backdropTerrain(pos: TilePos, terrainAt: TerrainAt): string | undefined {
  const terrain = terrainAt(pos.x, pos.y)?.toLowerCase();
  if (terrain !== 'grass') return terrain;
  const count = (name: string) => NEIGHBOURS.filter(([dx, dy]) => terrainAt(pos.x + dx, pos.y + dy)?.toLowerCase() === name).length;
  const forests = count('forest');
  const taigas = count('taiga');
  if (forests >= FOREST_EDGE_NEIGHBOURS && forests >= taigas) return 'forest';
  return taigas >= FOREST_EDGE_NEIGHBOURS ? 'taiga' : terrain;
}

/**
 * Background id for a battle started at `pos`: the encounter zone's table first (`zones[zoneId]`: its per-terrain
 * override, then its default), then the map's per-terrain override (keys are lowercase TerrainType names), then the
 * map default; undefined when the map has no table. `pos` is null when there is no player yet. `zoneId` is the
 * encounter zone at `pos` (`EncounterSystem.zoneAt`).
 */
export function battleBackdropId(
  cfg: BattleBackdropConfig,
  pos: TilePos | null,
  terrainAt: TerrainAt,
  zoneId: string | null,
): string | undefined {
  if (!cfg) return undefined;
  const terrain = pos ? backdropTerrain(pos, terrainAt) : undefined;
  const zone = zoneId ? cfg.zones?.[zoneId] : undefined;
  if (zone) {
    const id = (terrain && zone.terrain?.[terrain]) || zone.default;
    if (id) return id;
  }
  return (terrain && cfg.terrain?.[terrain]) || cfg.default;
}
