/**
 * The targeted save fix of pass NW2 (docs/NW2_EDITS_PLAN.md 12, D-NW2-11, Q11): a v4 save (the first NW world) keeps
 * its place unless the NW2 edits broke it. Pure, no I/O: `LoadScene` loads the world map (and the way out of the map
 * the save is in: `wayOutSearch`) and calls `revalidateNw2`; the verifier's `--from-reset` (questReset.ts) runs the
 * same code. Rules (12), keyed on each parked vehicle and on the party's cell, never on its map alone:
 * 1. a parked ship is valid on Water of an open basin (aldi; the ocean with CANAL_OPEN), with or without a shore;
 *    an invalid one moves to the open dock in the party's component, else to the nearest open dock;
 * 2. a party inside a map whose way out's component holds no ship shore, no airship and not Cornelia gets its ship at
 *    that component's dock;
 * 3. a parked airship is valid on a walkable cell; else it moves to the nearest landing in the party's component,
 *    else to its `RESET_SPOTS` spot;
 * 4. canoe mode off River and Lake becomes walking on a walkable cell; a cell that admits neither mode is rule 5;
 * 5. stranded (the component holds none of Cornelia's entrance, the ship's shore, the airship): reset to Cornelia
 *    with `resetVehicles` and the notice, as D-NW8.
 * The party's component is the cells it reaches on foot, and by canoe too when it holds the canoe, with the flags'
 * patches, gates and NPCs as the field reads them (fieldRules.canEnter).
 */
import { TerrainType } from '../types/index.js';
import type { FieldMode, MapData, ParkedVehicle, VehicleState } from '../types/index.js';
import { canEnter, cellReader, patchedTerrain, terrainAllows, transitionOpen, type FieldState } from './fieldRules.js';
import { vehicleCanLand } from './fieldRulesVehicles.js';
import { RESET_ENTRANCE, RESET_MAP, RESET_SPOTS, resetVehicles } from './worldReset.js';

/** The longest chain of maps a way out is looked for over (12: `ice-cavern-b2` -> `ice-cavern-b1` -> overworld). */
export const WAY_OUT_MAX_MAPS = 8;

/** Where the save stands and what it holds (plain sets, as the field rules read them). */
export interface SavePlace {
  map: string;
  x: number;
  y: number;
  mode: FieldMode;
  flags: ReadonlySet<string>;
  items: ReadonlySet<string>;
  /** Cells only (a save stores cells). */
  vehicles: readonly VehicleState[];
}

export interface Nw2World {
  overworld: MapData;
  /** The world-map entrance the save's map leads out to (`wayOutSearch`); null on the world map or with no way out. */
  wayOut: string | null;
}

export interface Nw2Result {
  map: string;
  x: number;
  y: number;
  mode: FieldMode;
  vehicles: ParkedVehicle[];
  /** Stranded (rule 5): the loader sends the party to `RESET_ENTRANCE` with the notice. */
  reset: boolean;
  /** One line per rule that changed something, for the console. */
  changes: string[];
}

/**
 * The way out of `start`: a breadth-first search over the transitions (open ones, by `flags`) until one targets a
 * world-map entrance. It yields each map id it needs and takes the map (null: missing); chains longer than
 * `WAY_OUT_MAX_MAPS` maps are not followed. Driven by `wayOutSync` (the verifier) or the loader's async loop.
 */
export function* wayOutSearch(start: string, flags: ReadonlySet<string>): Generator<string, string | null, MapData | null> {
  const seen = new Set([start]);
  let level = [start];
  for (let depth = 1; depth <= WAY_OUT_MAX_MAPS && level.length; depth++) {
    const next: string[] = [];
    for (const id of level) {
      const map = yield id;
      for (const t of map?.transitions ?? []) {
        if (!transitionOpen(t, { flags, items: new Set(), mode: 'walking', vehicles: [] })) continue;
        if (t.targetMap === RESET_MAP && t.targetEntrance) return t.targetEntrance;
        if (t.targetMap !== RESET_MAP && !seen.has(t.targetMap)) { seen.add(t.targetMap); next.push(t.targetMap); }
      }
    }
    level = next;
  }
  return null;
}

/** `wayOutSearch` over maps already in memory. */
export function wayOutSync(start: string, flags: ReadonlySet<string>, get: (id: string) => MapData | null): string | null {
  const it = wayOutSearch(start, flags);
  let r = it.next(null);
  while (!r.done) r = it.next(get(r.value));
  return r.value;
}

type Cell = { x: number; y: number };
const N4: ReadonlyArray<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** A flood fill from `seeds` over the cells `ok` admits. */
function flood(map: MapData, seeds: Cell[], ok: (c: Cell) => boolean): Set<number> {
  const out = new Set<number>();
  const q = seeds.filter(ok);
  q.forEach((c) => out.add(c.y * map.width + c.x));
  while (q.length) {
    const c = q.pop()!;
    for (const [dx, dy] of N4) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height || out.has(n.y * map.width + n.x) || !ok(n)) continue;
      out.add(n.y * map.width + n.x);
      q.push(n);
    }
  }
  return out;
}

const dist = (a: Cell, b: Cell): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
/** The cell of `cells` nearest to `to` (ties: the first). */
function nearest<T extends Cell>(cells: readonly T[], to: Cell): T | null {
  return cells.reduce<T | null>((best, c) => (!best || dist(c, to) < dist(best, to) ? c : best), null);
}

/** The pure revalidation of one v4 save on the NW2 world (rules 1-5 above). The input is not changed. */
export function revalidateNw2(save: SavePlace, world: Nw2World): Nw2Result {
  const map = world.overworld;
  const { flags, items } = save;
  const canoe = items.has('canoe');
  const st = (mode: FieldMode): FieldState => ({ flags, items, mode, vehicles: [] });
  const key = (c: Cell): number => c.y * map.width + c.x;
  const terrain = (c: Cell): TerrainType => patchedTerrain(map, c.x, c.y, flags);
  const walkable = (c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height
    && terrainAllows('walking', terrain(c));
  const changes: string[] = [];
  const at = (v: VehicleState): string => `${v.type} (${v.x},${v.y})`;
  const others = save.vehicles.filter((v) => v.map !== map.id).map((v) => ({ ...v }));
  let ship = save.vehicles.find((v) => v.map === map.id && v.type === 'ship');
  let air = save.vehicles.find((v) => v.map === map.id && v.type === 'airship');
  const rest = save.vehicles.filter((v) => v.map === map.id && v !== ship && v !== air).map((v) => ({ ...v }));
  let place: Cell & { map: string; mode: FieldMode } = { map: save.map, x: save.x, y: save.y, mode: save.mode };

  const entrance = (name: string): Cell | null => {
    const e = map.entrances?.[name];
    return e ? { x: e[0], y: e[1] } : null;
  };
  const cornelia = entrance(RESET_ENTRANCE);
  const reset = (why: string): Nw2Result => ({
    map: RESET_MAP, x: cornelia?.x ?? 0, y: cornelia?.y ?? 0, mode: 'walking',
    vehicles: [...others, ...resetVehicles(flags)], reset: true,
    changes: [...changes, `stranded (${why}): reset to ${RESET_ENTRANCE}`],
  });

  // rule 4 (and the ridden ship): the party's cell and mode on the world map
  const onWorld = save.map === map.id;
  if (onWorld && place.mode === 'canoe' && terrain(place) !== TerrainType.River && terrain(place) !== TerrainType.Lake) {
    if (!walkable(place)) return reset(`canoe on ${terrain(place)}`);
    place = { ...place, mode: 'walking' };
    changes.push(`canoe off the river at (${place.x},${place.y}): walking`);
  } else if (onWorld && place.mode === 'walking' && !walkable(place)) {
    if (!(canoe && canEnter(map, place, 'canoe', st('canoe')))) return reset(`on foot on ${terrain(place)}`);
    place = { ...place, mode: 'canoe' };
    changes.push(`on foot on the river at (${place.x},${place.y}): canoe`);
  }

  // rule 1's water: the open basins' Water, after patches
  const seeds = Object.entries(map.world?.basins ?? {}).filter(([b]) => b !== 'ocean' || flags.has('CANAL_OPEN'))
    .map(([, [x, y]]) => ({ x, y }));
  const water = flood(map, seeds, (c) => terrain(c) === TerrainType.Water);
  const openWater = (c: Cell): boolean => water.has(key(c));
  if (onWorld && place.mode === 'ship' && !openWater(place)) {
    if (!walkable(place)) return reset(`ship on ${terrain(place)}`);
    ship = { type: 'ship', map: map.id, x: place.x, y: place.y };
    place = { ...place, mode: 'walking' };
    changes.push(`the ridden ship ran aground at (${place.x},${place.y}): walking`);
  }

  // the party's component: from its cell, or from its way out's entrance; none when riding or with no way out
  const startCell = onWorld ? place : world.wayOut ? entrance(world.wayOut) : null;
  const afoot = place.mode === 'walking' || place.mode === 'canoe' || !onWorld;
  const comp = startCell && afoot
    ? flood(map, [startCell], (c) => canEnter(map, c, 'walking', st('walking')) || (canoe && canEnter(map, c, 'canoe', st('canoe'))))
    : null;
  if (startCell && comp) comp.add(key(startCell));
  const inComp = (c: Cell): boolean => !!comp?.has(key(c));
  const shores = (c: Cell): Cell[] => N4.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).filter(walkable);
  const docks = (map.docks ?? []).filter((d) => openWater(d));
  const compDocks = docks.filter((d) => shores(d).some(inComp));
  const moveShip = (to: Cell, why: string): void => {
    const from = ship!;
    ship = { type: 'ship', map: map.id, x: to.x, y: to.y };
    changes.push(`${why}: ${at(from)} -> (${to.x},${to.y})`);
  };

  // rule 1: the parked ship
  if (ship && !openWater(ship)) {
    const to = nearest(compDocks, ship) ?? nearest(docks, ship);
    if (to) moveShip(to, 'the ship is off open water');
  }
  // rule 3: the parked airship
  if (air && !walkable(air)) {
    const from = air;
    const lands: Cell[] = [];
    const reader = cellReader(map, st('airship'));
    comp?.forEach((k) => {
      const c = { x: k % map.width, y: Math.floor(k / map.width) };
      if (vehicleCanLand(reader, c)) lands.push(c);
    });
    const to = nearest(lands, from);
    const spot = RESET_SPOTS.find((r) => r.type === 'airship')!.at;
    const s = map.spots?.[spot]?.at;
    air = to ? { type: 'airship', map: map.id, x: to.x, y: to.y } : { type: 'airship', map: map.id, x: s?.[0] ?? from.x, y: s?.[1] ?? from.y };
    changes.push(`the airship is on ${terrain(from)}: ${at(from)} -> (${air.x},${air.y})`);
  }

  const holds = (): { shore: boolean; airship: boolean; cornelia: boolean } => ({
    shore: !!ship && shores(ship).some(inComp),
    airship: !!air && inComp(air),
    cornelia: !!cornelia && inComp(cornelia),
  });
  // rule 2: a party inside a map, its way out cut off from every vehicle and Cornelia
  if (!onWorld && comp && ship) {
    const h = holds();
    const to = startCell ? nearest(compDocks, startCell) : null;
    if (!h.shore && !h.airship && !h.cornelia && to) moveShip(to, `the way out ${world.wayOut} reaches no vehicle`);
  }
  // rule 5: stranded
  if (comp) {
    const h = holds();
    if (!h.shore && !h.airship && !h.cornelia) return reset(onWorld ? `(${place.x},${place.y})` : `way out ${world.wayOut}`);
  }
  const vehicles: ParkedVehicle[] = [...others, ...rest, ...(ship ? [ship] : []), ...(air ? [air] : [])];
  return { map: place.map, x: place.x, y: place.y, mode: place.mode, vehicles, reset: false, changes };
}
