/**
 * `--from-reset`'s NW2 states (docs/NW2_EDITS_PLAN.md 12): v4 saves the targeted fix relocates, built from a stage's
 * entry state and fixed by `revalidateNw2`, the code the game's loader runs. Proof (c) then runs from each
 * (questReset.proofFromReset):
 * - S10 inside `dwarf-hall`, the ship on land (it stood in the dwarves' old cove): moved to `ert_dwarf`;
 * - S16 inside `ice-cavern-b1`, the ship at Crescent: the way out (`fir_ice`) reaches no vehicle, moved to `fir_ice`;
 * - S6 at the Western Keep, the ship on land: moved to `elf_port`.
 */
import { revalidateNw2, wayOutSync } from '../systems/worldRevalidate.js';
import type { VehicleState } from '../types/index.js';
import type { QuestPlace, QuestState } from './questTypes.js';
import { assumedState, settle, type QuestModel } from './questSearch.js';
import { spotCell } from './questSpots.js';

export interface Nw2Case {
  stage: string;
  /** The map the save is in: an interior, or the world map at the stage's entry. */
  map: string;
  /** The ship before the fix: a spot of the world map, or `land` (the stage's entry cell, as a cove become land). */
  ship: string;
  /** The dock the fix must move the ship to. */
  dock: string;
}

export const NW2_CASES: readonly Nw2Case[] = [
  { stage: 'S10', map: 'dwarf-hall', ship: 'land', dock: 'ert_dwarf' },
  { stage: 'S16', map: 'ice-cavern-b1', ship: 'fir_s_crescent_ship', dock: 'fir_ice' },
  { stage: 'S6', map: 'overworld', ship: 'land', dock: 'elf_port' },
];

export interface Nw2State {
  label: string;
  stage: string;
  state: QuestState;
  /** Why the case does not hold (the ship elsewhere, or a reset), or null. */
  problem: string | null;
}

/** The arrival inside `mapId`: the entrance a world-map transition into it lands on. */
function arrival(model: QuestModel, mapId: string): QuestPlace {
  const { world } = model;
  const t = world.maps.get(world.worldMap)!.transitions.find((x) => x.targetMap === mapId && x.targetEntrance);
  const e = t && world.maps.get(mapId)?.entrances?.[t.targetEntrance!];
  if (!e) throw new Error(`--from-reset: no world-map transition into ${mapId}`);
  return { map: mapId, x: e[0], y: e[1], mode: 'walking' };
}

/** One case's state after the fix (settled), and whether the ship went where the case says. */
export function nw2State(model: QuestModel, c: Nw2Case): Nw2State {
  const { world } = model;
  const entry = assumedState(model, c.stage);
  const place = c.map === world.worldMap ? entry.place : arrival(model, c.map);
  const shipAt = c.ship === 'land' ? [entry.place.x, entry.place.y] : spotCell(world.maps, world.worldMap, c.ship, '--from-reset');
  const vehicles: VehicleState[] = [
    ...entry.vehicles.filter((v) => v.type !== 'ship' && v.map !== ''),
    { type: 'ship', map: world.worldMap, x: shipAt[0], y: shipAt[1] },
  ];
  const wayOut = place.map === world.worldMap ? null : wayOutSync(place.map, entry.flags, (id) => world.maps.get(id) ?? null);
  const r = revalidateNw2({ ...place, flags: entry.flags, items: entry.items, vehicles },
    { overworld: world.maps.get(world.worldMap)!, wayOut });
  const fixed = r.vehicles.filter((v): v is VehicleState => 'x' in v);
  const ship = fixed.find((v) => v.type === 'ship');
  const want = world.maps.get(world.worldMap)!.docks?.find((d) => d.id === c.dock);
  const problem = r.reset ? `reset to Cornelia (${r.changes.join('; ')})`
    : !ship || !want || ship.x !== want.x || ship.y !== want.y ? `the ship at ${ship ? `(${ship.x},${ship.y})` : 'none'}, not ${c.dock}`
      : null;
  const state = settle(model, { ...entry, vehicles: fixed, place: { map: r.map, x: r.x, y: r.y, mode: r.mode } }, {});
  return { label: `${c.stage} NW2 v4 save in ${c.map}, ship -> ${c.dock}`, stage: c.stage, state, problem };
}

/** Every case (stages missing from the quest are skipped). */
export function nw2States(model: QuestModel): Nw2State[] {
  return NW2_CASES.filter((c) => model.world.stages.has(c.stage)).map((c) => nw2State(model, c));
}
