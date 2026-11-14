import type { MapData } from '../../types/index.js';

export interface TilePos {
  x: number;
  y: number;
}

export const tileKey = (x: number, y: number): string => `${x},${y}`;

/**
 * Tiles where a step never counts towards a random battle (EB-2): warps (transitions), key-item gates and
 * scripted-encounter tiles. Roads and bridges keep their encounters.
 */
export function encounterFreeTiles(map: MapData): Set<string> {
  const tiles = new Set<string>();
  for (const t of map.transitions ?? []) tiles.add(tileKey(t.x, t.y));
  for (const g of map.keyItemGates ?? []) tiles.add(tileKey(g.x, g.y));
  for (const e of map.scriptedEncounters ?? []) tiles.add(tileKey(e.x, e.y));
  return tiles;
}

/** Step filter for EncounterSystem.setStepFilter: true where a step counts. */
export function encounterStepFilter(map: MapData): (x: number, y: number) => boolean {
  const free = encounterFreeTiles(map);
  return (x, y) => !free.has(tileKey(x, y));
}
