/**
 * The model and its exact search (docs/QUEST_PLAN.md 5.1, 5.2 (c)): the new game's state, the assumed start of
 * `--stage` (assume mode), and the breadth-first search over exact states (relevant flags, key items held, the
 * parked vehicles, the party's place), in which trades consume and one-way transitions strand. The saturation
 * closure of proofs (a) and (b) is questSaturate.ts.
 *
 * The auto events (pending stages' synthetic grants, vehicle spawns) fire as soon as they can, in stage order: they
 * need no place, and firing them at once removes their interleavings from the state space.
 */
import { fieldStep } from '../systems/fieldRules.js';
import type { VehicleState } from '../types/index.js';
import type { QuestPlace, QuestState } from './questTypes.js';
import { ancestorsOf, globMatch, stageOrder, type QuestWorld } from './questData.js';
import { effectsOf } from './questEvents.js';
import type { QuestCatalog } from './questCatalog.js';
import {
  applyExact, changes, closeMarkers, fieldStateOf, relevantEffects, sortedKey, stageMark, vehicleKey,
  type WithheldGrants,
} from './questStates.js';
import { PlaceIndex, type PlaceComponent } from './questPlaces.js';

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [-1, 0], [1, 0]];

/** The world, its catalog and its place cache: what every search and proof shares. */
export interface QuestModel {
  world: QuestWorld;
  cat: QuestCatalog;
  places: PlaceIndex;
  /** Catalog order of each event id (the deterministic firing order). */
  order: ReadonlyMap<string, number>;
}

export function createModel(world: QuestWorld, cat: QuestCatalog): QuestModel {
  return { world, cat, places: new PlaceIndex(world, cat), order: new Map(cat.events.map((e, i) => [e.id, i])) };
}

/** The exact search's default cap: 1,000,000 states (INT-W2c; it was 200,000, and `--stage S15`, with the airship
 *  stages before Gurgu, needs about 400,000 at about 1.2 GB). */
export const MAX_STATES = 1_000_000;

export interface SearchOptions {
  start?: QuestState;
  /** Event ids that never fire. */
  disabled?: ReadonlySet<string>;
  /** Grants no event may give. */
  withhold?: WithheldGrants;
  /** The exact search gives up past this many states (reported as a LIMIT failure). */
  maxStates?: number;
  /** From a state holding this flag, only exits are followed, no events (`--stage`: the stage's marker; INT-W2c). */
  stopAt?: string;
}

/** The new game's state: the start place and flags, with the markers and auto events closed. */
export function newGameState(model: QuestModel): QuestState {
  const { world } = model;
  const state: QuestState = {
    flags: new Set(world.startFlags), items: new Set(world.startItems), vehicles: [], gold: 0,
    place: { ...world.start }, fired: [],
  };
  return settle(model, state, {});
}

/**
 * The assumed start of `--stage <id>` (QUEST 5.1): the grants of every ancestor stage, after the consumption rule
 * (an item an ancestor requires and WORLD 3.1 marks consumed is gone), at the stage's `entry`.
 */
export function assumedState(model: QuestModel, stageId: string): QuestState {
  const { world } = model;
  const stage = world.stages.get(stageId);
  if (!stage) throw new Error(`no stage ${stageId}`);
  const anc = ancestorsOf(world.stages, stageId);
  const flags = new Set<string>(world.startFlags);
  const items = new Set<string>(world.startItems);
  const vehicles: VehicleState[] = [];
  for (const id of stageOrder(world.quest).filter((s) => anc.has(s))) {
    const a = world.stages.get(id)!;
    a.grants.flags.forEach((f) => flags.add(f));
    a.grants.items.forEach((i) => items.add(i));
    for (const i of a.requires.items) if (world.consumed.has(i) && !a.grants.items.includes(i)) items.delete(i);
    for (const t of a.grants.vehicles) {
      const at = stage.entry?.vehicles?.find((v) => v.type === t) ?? a.entry?.vehicles?.find((v) => v.type === t);
      vehicles.push(at ? { ...at } : { type: t as VehicleState['type'], map: '', x: -1, y: -1 });
    }
    flags.add(stageMark(id));
  }
  for (const v of stage.entry?.vehicles ?? []) {
    if (!vehicles.some((x) => x.type === v.type && x.map !== '')) {
      const i = vehicles.findIndex((x) => x.type === v.type);
      if (i >= 0) vehicles.splice(i, 1);
      vehicles.push({ ...v });
    }
  }
  const place: QuestPlace = stage.entry
    ? { map: stage.entry.map, x: stage.entry.x, y: stage.entry.y, mode: stage.entry.mode ?? 'walking' }
    : { ...world.start };
  // the stage under test must not fire while the start settles: its searches fire it
  return settle(model, { flags, items, vehicles, gold: 0, place, fired: [] }, { disabled: new Set([`quest:stage:${stageId}`]) });
}

function onMapOf(place: QuestPlace): (glob: string) => boolean {
  return (g) => globMatch(place.map, g);
}

/** Close the markers of built stages and fire every auto event that changes something, in catalog order. */
export function settle(model: QuestModel, state: QuestState, opts: SearchOptions): QuestState {
  const { world, cat } = model;
  let s = state;
  for (let guard = 0; guard < 10000; guard++) {
    const flags = new Set(s.flags);
    const added = closeMarkers(world, s, flags, onMapOf(s.place));
    if (added.length) s = { ...s, flags };
    let fired = false;
    for (const ev of cat.auto) {
      if (opts.disabled?.has(ev.id)) continue;
      const raw = effectsOf(world, ev, s);
      if (!raw) continue;
      const eff = relevantEffects(world, cat, raw, opts.withhold);
      if (!changes(s, eff, s.place)) continue;
      s = applyExact(s, { ...eff, warp: undefined }, s.place);
      fired = true;
      break;
    }
    if (!fired && !added.length) return s;
  }
  throw new Error('settle: auto events did not converge');
}

export interface StateNode {
  state: QuestState;
  comp: PlaceComponent;
  key: string;
}

export interface StateEdge {
  from: number;
  to: number;
  /** The event or exit id taken. */
  via: string;
}

export interface StateGraph {
  nodes: StateNode[];
  edges: StateEdge[];
  /** For each node: the edge index that first reached it (-1 for the start). */
  parent: number[];
  /** The search stopped at `maxStates`. */
  limited: boolean;
}

function stateKey(s: QuestState, comp: PlaceComponent): string {
  const v = s.vehicles.map(vehicleKey).sort().join(';');
  return `${sortedKey(s.flags)}|${sortedKey(s.items)}|${v}|${comp.key}`;
}

/** Breadth-first over exact states from `opts.start` (default: the new game). */
export function exploreStates(model: QuestModel, opts: SearchOptions = {}): StateGraph {
  const { world, cat, places } = model;
  const max = opts.maxStates ?? MAX_STATES;
  const graph: StateGraph = { nodes: [], edges: [], parent: [], limited: false };
  const index = new Map<string, number>();
  const add = (s: QuestState, parentEdge: number): number => {
    const comp = places.component(s.place, s);
    if (!comp) return -1;
    const key = stateKey(s, comp);
    const known = index.get(key);
    if (known !== undefined) return known;
    if (graph.nodes.length >= max) {
      graph.limited = true;
      return -1;
    }
    index.set(key, graph.nodes.length);
    graph.nodes.push({ state: s, comp, key });
    graph.parent.push(parentEdge);
    return graph.nodes.length - 1;
  };
  add(opts.start ?? newGameState(model), -1);
  for (let i = 0; i < graph.nodes.length; i++) {
    const { state, comp } = graph.nodes[i];
    // past the target only the party's moves are followed (the way home still counts for STRANDED), not events
    const stopped = !!opts.stopAt && state.flags.has(opts.stopAt);
    const link = (next: QuestState, via: string): void => {
      const settled = settle(model, next, opts);
      const e = graph.edges.length;
      const j = add(settled, e);
      if (j < 0) return;
      graph.edges.push({ from: i, to: j, via });
    };
    for (const ex of places.exitsOf(comp, state)) {
      let vehicles = state.vehicles;
      if (ex.unpark) vehicles = vehicles.filter((v) => !(v.type === ex.unpark && v.map === comp.map));
      if (ex.park && !opts.withhold?.vehicles.has(ex.park.type)) {
        vehicles = [...vehicles.filter((v) => v.type !== ex.park!.type), ex.park];
      }
      link({ ...state, vehicles, place: ex.to }, ex.id);
    }
    for (const [id, cell] of comp.triggers) {
      if (stopped || opts.disabled?.has(id)) continue;
      const ev = cat.byId.get(id)!;
      const at: QuestPlace = { map: comp.map, x: cell.x, y: cell.y, mode: comp.mode };
      const raw = effectsOf(world, ev, { ...state, place: at });
      if (!raw) continue;
      const eff = relevantEffects(world, cat, raw, opts.withhold);
      if (!changes(state, eff, at)) continue;
      link(applyExact(state, eff, at), id);
    }
  }
  return graph;
}

/** A shortest cell path on one map from `from` to any of `goals`, by fieldStep in `state` (the curve model's hook). */
export function cellPath(world: QuestWorld, from: QuestPlace, goals: Array<{ x: number; y: number }>,
  state: QuestState): Array<{ x: number; y: number }> | null {
  const map = world.maps.get(from.map);
  if (!map) return null;
  const w = map.width;
  const want = new Set(goals.map((g) => g.y * w + g.x));
  const fs = { ...fieldStateOf(state), mode: from.mode };
  const prev = new Map<number, number>([[from.y * w + from.x, -1]]);
  const queue = [from.y * w + from.x];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    if (want.has(c)) {
      const out: Array<{ x: number; y: number }> = [];
      for (let k = c; k !== -1; k = prev.get(k)!) out.push({ x: k % w, y: Math.floor(k / w) });
      return out.reverse();
    }
    const at = { x: c % w, y: Math.floor(c / w) };
    for (const [dx, dy] of DIRS) {
      const to = { x: at.x + dx, y: at.y + dy };
      const n = to.y * w + to.x;
      if (to.x < 0 || to.y < 0 || to.x >= w || to.y >= map.height || prev.has(n)) continue;
      const r = fieldStep(map, at, to, fs);
      if (!r.ok || (r.mode !== from.mode && !want.has(n))) continue;
      prev.set(n, c);
      if (want.has(n) || (!r.transition && !r.encounter && !r.setFlags.length)) queue.push(n);
    }
  }
  return null;
}
