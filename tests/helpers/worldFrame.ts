/**
 * The act-1 frame in tests (docs/WORLD_PLAN.md D-W11, GAP-17 / GAP-18; W1-B): the compiled overworld is either the
 * 72x72 act-1 map or the 192x192 world with `world.frames.a1`. `a1At` moves an act-1 cell into the map's frame, and
 * `translateA1` builds the world-shaped copy of an act-1 map (the act-1 block at `origin`, ocean around it), so a
 * test can pin the same act-1 cases on both shapes before the compiled world is committed.
 */
import type { MapData } from '../../src/types/index.js';
import { TerrainType } from '../../src/types/index.js';

/** The world's act-1 origin (world_api.A1_ORIGIN) and size. */
export const A1_ORIGIN: [number, number] = [64, 64];
export const WORLD_SIZE: [number, number] = [192, 192];

/** The map's act-1 origin, or [0, 0] on the act-1 map itself. */
export function a1OriginOf(map: Pick<MapData, 'world'>): [number, number] {
  const o = map.world?.frames.a1?.origin;
  return o ? [o[0], o[1]] : [0, 0];
}

/** An act-1 cell in the map's frame. */
export function a1At(map: Pick<MapData, 'world'>, x: number, y: number): { x: number; y: number } {
  const [ox, oy] = a1OriginOf(map);
  return { x: x + ox, y: y + oy };
}

type Rect = [number, number, number, number];

/** The act-1 map as the world carries it: every cell and placed thing moved by `origin`, ocean outside. */
export function translateA1(map: MapData, origin: [number, number] = A1_ORIGIN, size: [number, number] = WORLD_SIZE): MapData {
  if (map.world?.frames.a1) return map;
  const [ox, oy] = origin;
  const [w, h] = size;
  const collision = new Array<number>(w * h).fill(TerrainType.Water);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) collision[(y + oy) * w + x + ox] = map.collision[y * map.width + x];
  }
  const cell = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: o.x + ox, y: o.y + oy });
  const rect = (r: Rect): Rect => [r[0] + ox, r[1] + oy, r[2] + ox, r[3] + oy];
  return {
    ...map,
    width: w,
    height: h,
    collision,
    npcs: map.npcs.map(cell),
    transitions: map.transitions.map(cell),
    keyItemGates: map.keyItemGates?.map(cell),
    scriptedEncounters: map.scriptedEncounters?.map(cell),
    vehicles: map.vehicles?.map(cell),
    inspect: map.inspect?.map(cell),
    docks: map.docks?.map(cell),
    entrances: map.entrances && Object.fromEntries(Object.entries(map.entrances).map(([k, [x, y]]) => [k, [x + ox, y + oy]])),
    encounterZones: map.encounterZones?.map((z) => ({ ...z, rects: z.rects.map(rect) })),
    patches: map.patches?.map((p) => ({ ...p, cells: p.cells.map(([x, y]) => [x + ox, y + oy] as [number, number]) })),
    hazards: map.hazards?.map((hz) => ({ ...hz, rects: hz.rects.map(rect) })),
    world: { frames: { a1: { origin: [ox, oy], size: [map.width, map.height] } } },
  };
}
