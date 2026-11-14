import type { MapData } from '../../types/index.js';
import type { TilePos } from './FieldTiles.js';

/** A map's `battleBackgrounds` table (possibly missing). */
export type BattleBackdropConfig = MapData['battleBackgrounds'];

/** TerrainType name at a cell (e.g. `'FOREST'`, any case), or undefined off the map / without a collision map. */
export type TerrainAt = (x: number, y: number) => string | undefined;

/**
 * Background id for a battle started at `pos`: the map's per-terrain override (keys are lowercase TerrainType
 * names), else the map default; undefined when the map has no table. `pos` is null when there is no player yet.
 * `zoneId` is the encounter zone at `pos` (`EncounterSystem.zoneAt`); `battleBackgrounds.zones` is not read yet.
 */
export function battleBackdropId(
  cfg: BattleBackdropConfig,
  pos: TilePos | null,
  terrainAt: TerrainAt,
  _zoneId: string | null,
): string | undefined {
  if (!cfg) return undefined;
  let id = cfg.default;
  if (pos && cfg.terrain) {
    const terrain = terrainAt(pos.x, pos.y);
    id = (terrain && cfg.terrain[terrain.toLowerCase()]) || id;
  }
  return id;
}
