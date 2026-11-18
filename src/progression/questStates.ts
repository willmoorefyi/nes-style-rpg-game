/**
 * The search state's helpers (docs/QUEST_PLAN.md 5.1): stage markers, what a state holds, the relevance filter,
 * built stages' completion and the exact application of an event's effects. A stage's completion is kept in the flag
 * set as the marker `@<stage id>`. Pure functions, no runtime imports.
 */
import type { FieldState } from '../systems/fieldRules.js';
import type { QuestNeeds, VehicleState } from '../types/index.js';
import type { QuestPlace, QuestState } from './questTypes.js';
import type { QuestWorld } from './questData.js';
import type { QuestEffects } from './questEvents.js';
import type { QuestCatalog } from './questCatalog.js';

export const STAGE_MARK = '@';

export const stageMark = (id: string): string => `${STAGE_MARK}${id}`;

export function fieldStateOf(state: QuestState): FieldState {
  return { flags: state.flags, items: state.items, mode: state.place.mode, vehicles: state.vehicles };
}

export function stageDone(state: QuestState, id: string): boolean {
  return state.flags.has(stageMark(id));
}

/** Whether the state holds a vehicle of `type` (parked anywhere, or the party rides it). */
export function hasVehicle(state: QuestState, type: string): boolean {
  return state.place.mode === type || state.vehicles.some((v) => v.type === type);
}

export function needsHeld(state: QuestState, n: QuestNeeds): boolean {
  return n.flags.every((f) => state.flags.has(f)) && n.items.every((i) => state.items.has(i))
    && n.vehicles.every((v) => hasVehicle(state, v));
}

export interface WithheldGrants {
  flags: ReadonlySet<string>;
  items: ReadonlySet<string>;
  vehicles: ReadonlySet<string>;
}

export function withheld(n?: Partial<QuestNeeds>): WithheldGrants {
  return { flags: new Set(n?.flags ?? []), items: new Set(n?.items ?? []), vehicles: new Set(n?.vehicles ?? []) };
}

/** Effects reduced to state: key items and relevant flags only (markers kept), withheld grants removed. */
export function relevantEffects(world: QuestWorld, cat: QuestCatalog, eff: QuestEffects,
  withhold?: WithheldGrants): QuestEffects {
  const keepFlag = (f: string): boolean => (f.startsWith(STAGE_MARK) || cat.relevantFlags.has(f))
    && !withhold?.flags.has(f);
  const keepItem = (i: string): boolean => world.keyItems.has(i) && !withhold?.items.has(i);
  return {
    ...eff,
    flags: eff.flags.filter(keepFlag),
    items: eff.items.filter(keepItem),
    takes: eff.takes.filter((i) => world.keyItems.has(i)),
    vehicles: eff.vehicles.filter((v) => !withhold?.vehicles.has(v.type)),
  };
}

/** The flag noting that a built stage's grants have all held at once while an `after` stage was not yet done. */
export const grantsSeenMark = (id: string): string => `${stageMark(id)}~`;

/** Built stages whose `after` stages are done and whose grants hold, or have held, get their marker (a fixpoint).
 *  Returns the marker flags added (and the grants-seen notes). A built stage that grants nothing is done once the
 *  party stands on one of its maps. Grants held before the `after` stages are done are noted (`grantsSeenMark`): a
 *  stage done out of order (the Marsh Cave before the Elfheim visit) whose item is later taken (the crown, by Astos)
 *  is still done once the visit is made. */
export function closeMarkers(world: QuestWorld, state: QuestState, flags: Set<string>,
  onMap: (glob: string) => boolean): string[] {
  const added: string[] = [];
  const view: QuestState = { ...state, flags };
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of world.quest.stages) {
      if (s.status !== 'built' || flags.has(stageMark(s.id))) continue;
      const g = s.grants;
      const emptyGrants = g.flags.length + g.items.length + g.vehicles.length === 0;
      const seen = grantsSeenMark(s.id);
      if (!s.after.every((a) => flags.has(stageMark(a)))) {
        if (!emptyGrants && !flags.has(seen) && needsHeld(view, g)) {
          flags.add(seen);
          added.push(seen);
        }
        continue;
      }
      const ok = emptyGrants ? (s.maps.length === 0 || s.maps.some(onMap)) : needsHeld(view, g) || flags.has(seen);
      if (!ok) continue;
      flags.delete(seen); // done: the note is spent (states that reached the marker either way are one state)
      flags.add(stageMark(s.id));
      added.push(stageMark(s.id));
      changed = true;
    }
  }
  return added;
}

export const vehicleKey = (v: VehicleState): string => `${v.type}:${v.map}:${v.x},${v.y}`;

export function sortedKey(s: ReadonlySet<string>): string {
  return [...s].sort().join(',');
}

/** Apply effects exactly: flags and items added, takes removed, a vehicle replaces its type's old position. */
export function applyExact(state: QuestState, eff: QuestEffects, at: QuestPlace): QuestState {
  const flags = new Set(state.flags);
  eff.flags.forEach((f) => flags.add(f));
  const items = new Set(state.items);
  eff.items.forEach((i) => items.add(i));
  eff.takes.forEach((i) => items.delete(i));
  let vehicles = [...state.vehicles];
  for (const v of eff.vehicles) {
    vehicles = vehicles.filter((x) => x.type !== v.type);
    vehicles.push({ ...v });
  }
  return { flags, items, vehicles, gold: state.gold - eff.gold, place: eff.warp ?? at, fired: state.fired };
}

export function changes(state: QuestState, eff: QuestEffects, at: QuestPlace): boolean {
  if (eff.flags.some((f) => !state.flags.has(f)) || eff.items.some((i) => !state.items.has(i))) return true;
  if (eff.takes.some((i) => state.items.has(i))) return true;
  if (eff.vehicles.some((v) => !state.vehicles.some((x) => vehicleKey(x) === vehicleKey(v)))) return true;
  return !!eff.warp && (eff.warp.map !== at.map || eff.warp.x !== at.x || eff.warp.y !== at.y);
}
