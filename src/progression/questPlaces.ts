/**
 * Places (docs/QUEST_PLAN.md 5.1): a place is a 4-connected component of one map under one mode, for the state's
 * flags and items as that map reads them. Steps come from fieldRules.fieldStep (terrain after patches, gates, static
 * NPCs, transitions, scripted encounters), so the verifier walks where the game lets the party walk.
 *
 * A component records its exits (a transition, a step that changes the mode, a dock, a canoe bank, an airship
 * landing, the EXIT spell's target) and its triggers (the events fired from it: an NPC talked to from a 4-neighbour
 * or across a counter, the scripted encounter or permanent gate on the next cell). Boarding a parked vehicle and
 * leaving a spawned canoe depend on the state, so `exitsOf` adds them. Components are cached by (map, mode, read
 * flags, read items); they assume a walking step does not depend on where the vehicles are parked.
 */
import { fieldStep } from '../systems/fieldRules.js';
import type { FieldMode, MapData, MapTransition, VehicleState, VehicleType } from '../types/index.js';
import type { QuestPlace, QuestState } from './questTypes.js';
import type { QuestWorld } from './questData.js';
import { fieldStateOf } from './questStates.js';
import { modeExits, stateExits } from './questExits.js';
import { arrivalOf, type QuestCatalog } from './questCatalog.js';

/** Key items the field rules may read on any cell (the canoe on River and Lake, W1-B), so every place key holds them. */
export const ABILITY_ITEMS: readonly string[] = ['canoe'];

/** The compiler's counter value: an NPC behind one is talked to across it (map_graph.talkable). */
export const COUNTER = 10;

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [-1, 0], [1, 0]];

export type ExitKind = 'transition' | 'step' | 'board' | 'dock' | 'bank' | 'land' | 'exit';

/** One way out of a component. `park` is a vehicle left behind, `unpark` the one boarded. */
export interface PlaceExit {
  kind: ExitKind;
  /** `<map>:<kind>:<name>`, the walk-step id (e.g. `overworld:warp:cornelia`, `overworld:dock:a1_pravoka`). */
  id: string;
  aliases: string[];
  from: { x: number; y: number };
  to: QuestPlace;
  park?: VehicleState;
  unpark?: VehicleType;
}

export interface PlaceComponent {
  key: string;
  map: string;
  mode: FieldMode;
  /** Cells as y * width + x. */
  cells: number[];
  cellSet: Set<number>;
  exits: PlaceExit[];
  /** Event ids fired from this component, with the cell each fires from. */
  triggers: Map<string, { x: number; y: number }>;
}

interface Labelling {
  label: Int32Array;
  comps: PlaceComponent[];
}


function transitionExit(world: QuestWorld, map: MapData, t: MapTransition, from: { x: number; y: number }): PlaceExit | null {
  const to = arrivalOf(world, t);
  if (!to) return null;
  const aliases = [`${map.id}:warp:${t.targetMap}`, `${map.id}:transition:${t.targetMap}`];
  if (t.targetEntrance !== undefined) aliases.push(`${map.id}:warp:${t.targetEntrance}`);
  return { kind: 'transition', id: `${map.id}:transition:${t.targetMap}@${t.x},${t.y}`, aliases, from, to };
}

export class PlaceIndex {
  private cache = new Map<string, Labelling>();
  /** Components computed so far (the CLI's "places" count). */
  built = 0;

  constructor(private readonly world: QuestWorld, private readonly cat: QuestCatalog) {}

  /** The cache key part of a state for one map: the flags and items that map reads. */
  signature(mapId: string, mode: FieldMode, state: QuestState): string {
    const f = (this.cat.mapFlags.get(mapId) ?? []).filter((x) => state.flags.has(x));
    const i = [...(this.cat.mapItems.get(mapId) ?? []), ...ABILITY_ITEMS].filter((x) => state.items.has(x));
    return `${mapId}|${mode}|${f.join(',')}|${i.join(',')}`;
  }

  /** The component holding `place` in `state` (null when the map is not loaded or the cell is outside it). */
  component(place: QuestPlace, state: QuestState): PlaceComponent | null {
    const map = this.world.maps.get(place.map);
    if (!map || place.x < 0 || place.y < 0 || place.x >= map.width || place.y >= map.height) return null;
    const sig = this.signature(place.map, place.mode, state);
    let lab = this.cache.get(sig);
    if (!lab) {
      lab = { label: new Int32Array(map.width * map.height).fill(-1), comps: [] };
      this.cache.set(sig, lab);
    }
    const c = place.y * map.width + place.x;
    if (lab.label[c] >= 0) return lab.comps[lab.label[c]];
    return this.flood(map, place, state, sig, lab);
  }

  private flood(map: MapData, place: QuestPlace, held: QuestState, sig: string, lab: Labelling): PlaceComponent {
    // INT-W2a: the cache key has no vehicles, so the flood must not read them: a walking step onto a parked ship
    // would otherwise cache a `step ...:ship` exit that a later state without the ship reuses. Boarding a parked
    // vehicle is the state's own exit (`stateExits`).
    const state: QuestState = { ...held, vehicles: [] };
    const w = map.width;
    const id = lab.comps.length;
    const comp: PlaceComponent = {
      key: `${sig}#${id}`, map: map.id, mode: place.mode, cells: [], cellSet: new Set(), exits: [], triggers: new Map(),
    };
    lab.comps.push(comp);
    this.built++;
    const fs = { ...fieldStateOf(state), mode: place.mode };
    const start = place.y * w + place.x;
    lab.label[start] = id;
    const queue = [start];
    const seenExit = new Set<string>();
    for (let qi = 0; qi < queue.length; qi++) {
      const c = queue[qi];
      const from = { x: c % w, y: Math.floor(c / w) };
      comp.cells.push(c);
      comp.cellSet.add(c);
      for (const [dx, dy] of DIRS) {
        const to = { x: from.x + dx, y: from.y + dy };
        if (to.x < 0 || to.y < 0 || to.x >= w || to.y >= map.height) continue;
        const r = fieldStep(map, from, to, fs);
        if (!r.ok) continue;
        const n = to.y * w + to.x;
        const flying = place.mode === 'airship';
        if (r.transition && !flying) {
          const ex = transitionExit(this.world, map, r.transition, from);
          if (ex && !seenExit.has(ex.id)) { seenExit.add(ex.id); comp.exits.push(ex); }
          continue;
        }
        if (r.encounter && !flying) {
          const ev = this.cat.byCell.get(`${map.id}\0${to.x},${to.y}`);
          if (ev && !comp.triggers.has(ev.id)) comp.triggers.set(ev.id, from);
          continue;
        }
        if (r.setFlags.length) {
          const ev = this.cat.byCell.get(`${map.id}\0${to.x},${to.y}`);
          if (ev && !comp.triggers.has(ev.id)) comp.triggers.set(ev.id, from);
          continue;
        }
        if (r.mode !== place.mode) {
          // W1-A hand-off: a dock disembark is modeExits' dock exit (which parks the ship); a raw step would drop it
          if (place.mode === 'ship' && r.mode === 'walking') continue;
          const exId = `${map.id}:step:${to.x},${to.y}:${r.mode}`;
          if (!seenExit.has(exId)) {
            seenExit.add(exId);
            comp.exits.push({ kind: 'step', id: exId, aliases: [], from, to: { map: map.id, ...to, mode: r.mode } });
          }
          continue;
        }
        if (lab.label[n] >= 0) continue;
        lab.label[n] = id;
        queue.push(n);
      }
    }
    this.addTalk(map, comp, state);
    comp.exits.push(...modeExits(this.world, map, comp, state, (p) => this.component(p, state)));
    return comp;
  }

  /** NPC events talked to from a cell of the component (4-neighbour, across a counter, or a wanderer inside it). */
  private addTalk(map: MapData, comp: PlaceComponent, _state: QuestState): void {
    if (comp.mode !== 'walking' && comp.mode !== 'canoe') return;
    const w = map.width;
    const inComp = comp.cellSet;
    for (const n of map.npcs) {
      const ev = this.cat.byNpc.get(`${map.id}\0${n.id}`);
      if (!ev) continue;
      let from: { x: number; y: number } | null = null;
      if (inComp.has(n.y * w + n.x)) from = { x: n.x, y: n.y };
      for (const [dx, dy] of DIRS) {
        if (from) break;
        const a = { x: n.x + dx, y: n.y + dy };
        if (a.x < 0 || a.y < 0 || a.x >= w || a.y >= map.height) continue;
        if (inComp.has(a.y * w + a.x)) { from = a; break; }
        const b = { x: n.x + 2 * dx, y: n.y + 2 * dy };
        if (map.collision[a.y * w + a.x] === COUNTER && b.x >= 0 && b.y >= 0 && b.x < w && b.y < map.height
          && inComp.has(b.y * w + b.x)) from = b;
      }
      if (from) comp.triggers.set(ev.id, from);
    }
  }

  /** The component's exits in `state`: the cached ones, a spawned canoe left at a bank, boarding a parked vehicle. */
  exitsOf(comp: PlaceComponent, state: Pick<QuestState, 'items' | 'vehicles'>): PlaceExit[] {
    return stateExits(this.world, comp, state);
  }
}
