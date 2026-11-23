/**
 * The vehicle and spell exits of a place (docs/QUEST_PLAN.md 5.1 "Edges"): docks (ship to foot, the ship parked at
 * the dock), canoe banks, airship landings (`canLand`; one landing per walking component below) and the EXIT spell's
 * target (on foot, off the world map), plus boarding a vehicle parked on or beside a walking component. Cell rules
 * come from fieldRules.ts (`canEnter`, `canLand`, `dockFor`).
 */
import { canEnter, canLand, dockFor } from '../systems/fieldRules.js';
import { stepTo } from '../systems/worldWrap.js';
import type { FieldMode, MapData } from '../types/index.js';
import type { QuestPlace, QuestState } from './questTypes.js';
import type { QuestWorld } from './questData.js';
import { fieldStateOf } from './questStates.js';
import type { PlaceComponent, PlaceExit } from './questPlaces.js';

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [-1, 0], [1, 0]];

/** The exits a component's mode gives it (cached with the component). `ground` finds a cell's walking component. */
export function modeExits(world: QuestWorld, map: MapData, comp: PlaceComponent, state: QuestState,
  ground: (p: QuestPlace) => PlaceComponent | null): PlaceExit[] {
  const out: PlaceExit[] = [];
  const w = map.width;
  const walk = { ...fieldStateOf(state), mode: 'walking' as FieldMode };
  const landSide = (c: { x: number; y: number }): Array<{ x: number; y: number }> => DIRS
    .map(([dx, dy]) => stepTo(map, c, dx, dy)).filter((a): a is { x: number; y: number } => a !== null)
    .filter((a) => canEnter(map, a, 'walking', walk));
  if (comp.mode === 'ship') {
    for (const d of map.docks ?? []) {
      if (!comp.cellSet.has(d.y * w + d.x) || !dockFor(map, d)) continue;
      for (const a of landSide(d)) {
        out.push({
          kind: 'dock', id: `${map.id}:dock:${d.id}`, aliases: [`${map.id}:dock:${d.id}@${a.x},${a.y}`], from: { x: d.x, y: d.y },
          to: { map: map.id, ...a, mode: 'walking' }, park: { type: 'ship', map: map.id, x: d.x, y: d.y },
        });
      }
    }
  } else if (comp.mode === 'canoe') {
    const seen = new Set<number>();
    for (const c of comp.cells) {
      const at = { x: c % w, y: Math.floor(c / w) };
      for (const a of landSide(at)) {
        if (seen.has(a.y * w + a.x)) continue;
        seen.add(a.y * w + a.x);
        out.push({ kind: 'bank', id: `${map.id}:bank:${a.x},${a.y}`, aliases: [], from: at, to: { map: map.id, ...a, mode: 'walking' } });
      }
    }
  } else if (comp.mode === 'airship') {
    const fly = { ...fieldStateOf(state), mode: 'airship' as FieldMode };
    const groups = new Set<string>();
    for (const c of comp.cells) {
      const at = { x: c % w, y: Math.floor(c / w) };
      if (!canLand(map, at, fly)) continue;
      const g = ground({ map: map.id, ...at, mode: 'walking' });
      if (!g || groups.has(g.key)) continue;
      groups.add(g.key);
      out.push({
        kind: 'land', id: `${map.id}:land:${at.x},${at.y}`, aliases: [`${map.id}:land`], from: at,
        to: { map: map.id, ...at, mode: 'walking' }, park: { type: 'airship', map: map.id, ...at },
      });
    }
  } else if (map.exit && map.id !== world.worldMap) {
    const e = world.maps.get(map.exit.map)?.entrances?.[map.exit.entrance];
    if (e) {
      out.push({ kind: 'exit', id: `${map.id}:exit:${map.exit.map}`, aliases: [],
        from: { x: comp.cells[0] % w, y: Math.floor(comp.cells[0] / w) }, to: { map: map.exit.map, x: e[0], y: e[1], mode: 'walking' } });
    }
  }
  return out;
}

/** A component's exits in a state: a spawned canoe is left at the bank (the canoe item is an ability and leaves
 *  nothing), and a walking component may board each vehicle parked on or beside it. */
export function stateExits(world: QuestWorld, comp: PlaceComponent, state: Pick<QuestState, 'items' | 'vehicles'>): PlaceExit[] {
  if (comp.mode === 'canoe') {
    return state.items.has('canoe') ? comp.exits
      : comp.exits.map((ex) => (ex.kind === 'bank' ? { ...ex, park: { type: 'canoe', map: comp.map, ...ex.from } } : ex));
  }
  if (comp.mode !== 'walking') return comp.exits;
  const map = world.maps.get(comp.map)!;
  const w = map.width;
  const out = [...comp.exits];
  for (const v of state.vehicles) {
    if (v.map !== comp.map) continue;
    const cells = [{ x: v.x, y: v.y }, ...DIRS.map(([dx, dy]) => stepTo(map, v, dx, dy))];
    const from = cells.find((c): c is { x: number; y: number } => c !== null && comp.cellSet.has(c.y * w + c.x));
    if (!from) continue;
    out.push({ kind: 'board', id: `${comp.map}:board:${v.type}`, aliases: [`${comp.map}:vehicle:${v.type}`], from,
      to: { map: v.map, x: v.x, y: v.y, mode: v.type }, unpark: v.type });
  }
  return out;
}
