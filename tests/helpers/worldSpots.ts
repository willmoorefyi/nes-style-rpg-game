/**
 * World-map places in tests by name (docs/NATURAL_WORLD_PLAN.md 5.2, 3.6.5; replaces pass W's `worldFrame.ts`): a
 * spot of the map's `spots`, an entrance, a dock, a gate or a patch, never a raw world cell, so a test holds on any
 * world the composer writes.
 */
import type { MapData } from '../../src/types/index.js';

type XY = { x: number; y: number };

/** A spot's cell (`MapData.spots`); throws on an unknown spot. */
export function spot(map: Pick<MapData, 'id' | 'spots'>, name: string): XY {
  const s = map.spots?.[name];
  if (!s) throw new Error(`${map.id} has no spot ${name}`);
  return { x: s.at[0], y: s.at[1] };
}

/** An entrance's cell; throws on an unknown entrance. */
export function entrance(map: Pick<MapData, 'id' | 'entrances'>, name: string): XY {
  const e = map.entrances?.[name];
  if (!e) throw new Error(`${map.id} has no entrance ${name}`);
  return { x: e[0], y: e[1] };
}

/** A dock's cell by id; throws on an unknown dock. */
export function dock(map: Pick<MapData, 'id' | 'docks'>, id: string): XY {
  const d = map.docks?.find((x) => x.id === id);
  if (!d) throw new Error(`${map.id} has no dock ${id}`);
  return { x: d.x, y: d.y };
}

/** A key-item gate's cell by id; throws on an unknown gate. */
export function gate(map: Pick<MapData, 'id' | 'keyItemGates'>, id: string): XY {
  const g = map.keyItemGates?.find((x) => x.id === id);
  if (!g) throw new Error(`${map.id} has no gate ${id}`);
  return { x: g.x, y: g.y };
}

/** A patch's cells by id; throws on an unknown patch. */
export function patchCells(map: Pick<MapData, 'id' | 'patches'>, id: string): XY[] {
  const p = map.patches?.find((x) => x.id === id);
  if (!p) throw new Error(`${map.id} has no patch ${id}`);
  return p.cells.map(([x, y]) => ({ x, y }));
}

/** The map's size in cells. */
export function worldSize(map: Pick<MapData, 'width' | 'height'>): [number, number] {
  return [map.width, map.height];
}
