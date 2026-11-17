/**
 * Cell routes across maps (the curve model's walk, docs/QUEST_PLAN.md 5.2 (d), and the detour bound of
 * docs/WORLD_PLAN.md 6.1 step 6): a breadth-first search over (map, cell, mode) by `fieldStep`, with the transitions
 * it takes and the component exits of questExits.ts (docks, banks, landings, boarding, EXIT). A step onto a scripted
 * encounter or a permanent gate's cell is not taken (those are events), as in `cellPath`.
 */
import { fieldStep } from '../systems/fieldRules.js';
import type { FieldMode } from '../types/index.js';
import type { QuestPlace, QuestState } from './questTypes.js';
import { arrivalOf } from './questCatalog.js';
import type { PlaceComponent, PlaceExit } from './questPlaces.js';
import type { QuestModel } from './questSearch.js';

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [-1, 0], [1, 0]];
const ROUTE_EXITS = new Set(['dock', 'bank', 'land', 'board', 'exit']);

export const placeKey = (p: QuestPlace): string => `${p.map}|${p.x},${p.y}|${p.mode}`;

export interface RouteOptions {
  /** Modes the route may use (default: every mode). */
  modes?: ReadonlySet<FieldMode>;
  /** Give up past this many nodes. */
  maxNodes?: number;
  /** Allow the EXIT spell's edge (default true). */
  exitSpell?: boolean;
}

/** The exits of a component by their `from` cell (cached per component and state signature). */
function exitIndex(model: QuestModel, comp: PlaceComponent, state: QuestState,
  cache: Map<string, Map<number, PlaceExit[]>>, w: number): Map<number, PlaceExit[]> {
  const key = `${comp.key}|${state.vehicles.map((v) => `${v.type}:${v.map}:${v.x},${v.y}`).join(';')}`;
  let idx = cache.get(key);
  if (!idx) {
    idx = new Map();
    for (const ex of model.places.exitsOf(comp, state)) {
      if (!ROUTE_EXITS.has(ex.kind)) continue;
      const c = ex.from.y * w + ex.from.x;
      const list = idx.get(c) ?? [];
      list.push(ex);
      idx.set(c, list);
    }
    cache.set(key, idx);
  }
  return idx;
}

/**
 * A shortest route from `from` to any place `goal` accepts, in `state` (its flags, items and parked vehicles do
 * not change on the way). Returns the places stepped on (without `from`), or null.
 */
export function route(model: QuestModel, from: QuestPlace, goal: (p: QuestPlace) => boolean, state: QuestState,
  opts: RouteOptions = {}): QuestPlace[] | null {
  const { world } = model;
  const max = opts.maxNodes ?? 400000;
  const prev = new Map<string, string | null>([[placeKey(from), null]]);
  const nodes = new Map<string, QuestPlace>([[placeKey(from), from]]);
  const queue: QuestPlace[] = [from];
  const cache = new Map<string, Map<number, PlaceExit[]>>();
  const push = (p: QuestPlace, parent: string): boolean => {
    if (opts.modes && !opts.modes.has(p.mode)) return false;
    const k = placeKey(p);
    if (prev.has(k)) return false;
    prev.set(k, parent);
    nodes.set(k, p);
    queue.push(p);
    return goal(p);
  };
  const unwind = (k: string): QuestPlace[] => {
    const out: QuestPlace[] = [];
    for (let c: string | null = k; c !== null && c !== placeKey(from); c = prev.get(c) ?? null) out.push(nodes.get(c)!);
    return out.reverse();
  };
  if (goal(from)) return [];
  for (let qi = 0; qi < queue.length && qi < max; qi++) {
    const p = queue[qi];
    const pk = placeKey(p);
    const map = world.maps.get(p.map);
    if (!map) continue;
    const fs = { flags: state.flags, items: state.items, vehicles: state.vehicles, mode: p.mode };
    for (const [dx, dy] of DIRS) {
      const to = { x: p.x + dx, y: p.y + dy };
      if (to.x < 0 || to.y < 0 || to.x >= map.width || to.y >= map.height) continue;
      const r = fieldStep(map, p, to, fs);
      if (!r.ok || r.encounter || r.setFlags.length) continue;
      let next: QuestPlace = { map: p.map, ...to, mode: r.mode };
      if (r.transition) {
        if (p.mode === 'airship') continue;
        const a = arrivalOf(world, r.transition);
        if (!a) continue;
        next = a;
      }
      if (push(next, pk)) return unwind(placeKey(next));
    }
    const comp = model.places.component(p, state);
    if (!comp) continue;
    for (const ex of exitIndex(model, comp, state, cache, map.width).get(p.y * map.width + p.x) ?? []) {
      if (ex.kind === 'exit' && opts.exitSpell === false) continue;
      if (push(ex.to, pk)) return unwind(placeKey(ex.to));
    }
  }
  return null;
}

/** A route to one place (`mode` included). */
export function routeTo(model: QuestModel, from: QuestPlace, to: QuestPlace, state: QuestState,
  opts?: RouteOptions): QuestPlace[] | null {
  const k = placeKey(to);
  return route(model, from, (p) => placeKey(p) === k, state, opts);
}
