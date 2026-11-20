/**
 * `--from-reset` (docs/NATURAL_WORLD_PLAN.md 5.3, D-NW8): no soft-lock from a save reset. A pre-NW save moved to
 * Cornelia keeps its flags and items, stands at `cornelia` on foot and has its vehicles at their milestone spots
 * (`resetVehicles`, the code the game runs). For every stage its reset state (the stage's entry state, as `--stage`
 * builds it, relocated so) and up to `samples` relocated states of the main search per stage (a party that saved half
 * way through a stage; a seeded pick) are searched with proof (c): every state reached reaches the goal and has a way
 * back to the world map. The main graph's states are already proven, so a reset search stops where it meets one.
 */
import { resetVehicles, RESET_ENTRANCE } from '../systems/worldReset.js';
import type { VehicleState } from '../types/index.js';
import type { ProofFailure, ProofResult, QuestPlace, QuestState } from './questTypes.js';
import { globMatch, stageOrder } from './questData.js';
import { canReach, pathTo } from './questChecks.js';
import { fail, result, stateGraph, type QuestContext } from './questProofs.js';
import { assumedState, exploreStates, settle, type QuestModel } from './questSearch.js';
import { Saturator } from './questSaturate.js';
import { stageMark } from './questStates.js';
import { spotCell } from './questSpots.js';

/** Cornelia's world-map arrival, on foot. */
export function resetPlace(model: QuestModel): QuestPlace {
  const { world } = model;
  const e = world.maps.get(world.worldMap)?.entrances?.[RESET_ENTRANCE];
  if (!e) throw new Error(`--from-reset: ${world.worldMap} has no entrance ${RESET_ENTRANCE}`);
  return { map: world.worldMap, x: e[0], y: e[1], mode: 'walking' };
}

/** A state as a reset leaves it: at Cornelia on foot, the world map's vehicles replaced by `resetVehicles`. */
export function relocate(model: QuestModel, state: QuestState): QuestState {
  const { world } = model;
  const placed: VehicleState[] = resetVehicles(state.flags).map((v) => {
    const at = 'at' in v ? spotCell(world.maps, v.map, v.at, '--from-reset') : [v.x, v.y];
    return { type: v.type, map: v.map, x: at[0], y: at[1] };
  });
  const kept = state.vehicles.filter((v) => v.map !== world.worldMap && !(v.map === '' && placed.some((p) => p.type === v.type)));
  return settle(model, { ...state, vehicles: [...kept, ...placed], place: resetPlace(model) }, {});
}

/** Each stage's reset state, in stage order. */
export function stageResetStates(model: QuestModel): Array<{ label: string; state: QuestState }> {
  return stageOrder(model.world.quest).map((id) => ({ label: `${id} entry`, state: relocate(model, assumedState(model, id)) }));
}

/** A stage's required entrances (prewalk's, NATURAL_WORLD 3.8): the world map's entrances at, or one step from, a
 *  transition into one of the stage's `maps`. */
export function requiredEntrances(model: QuestModel, stageId: string): string[] {
  const { world } = model;
  const map = world.maps.get(world.worldMap);
  const stage = world.stages.get(stageId);
  if (!map || !stage) return [];
  const out = new Set<string>();
  for (const t of map.transitions) {
    if (!stage.maps.some((g) => globMatch(t.targetMap, g))) continue;
    for (const [name, [x, y]] of Object.entries(map.entrances ?? {})) if (Math.abs(t.x - x) + Math.abs(t.y - y) <= 1) out.add(name);
  }
  return [...out].sort();
}

/** The named world-map entrances reachable from a state with its flags, items and vehicles (no event fires). */
export function reachedEntrances(model: QuestModel, state: QuestState, names: readonly string[]): Set<string> {
  const { world } = model;
  const map = world.maps.get(world.worldMap)!;
  const sat = new Saturator(model, state, { disabled: new Set(model.cat.events.map((e) => e.id)) });
  sat.reach();
  return new Set(names.filter((n) => {
    const [x, y] = map.entrances![n];
    const p: QuestPlace = { map: map.id, x, y, mode: 'walking' };
    const comp = model.places.component(p, sat.view(p));
    return !!comp && sat.reachedComps.has(comp.key);
  }));
}

/** A small seeded generator (mulberry32), so the mid-stage samples are the same on every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Up to `per` states of the main graph per stage (the last stage whose marker a state holds), relocated. */
export function midStageStates(ctx: QuestContext, per: number, seed = 1987): Array<{ label: string; state: QuestState }> {
  const order = stageOrder(ctx.world.quest);
  const byStage = new Map<string, number[]>(order.map((id) => [id, []]));
  const g = stateGraph(ctx);
  g.nodes.forEach((n, i) => {
    let at = order[0];
    for (const id of order) if (n.state.flags.has(stageMark(id))) at = id;
    byStage.get(at)!.push(i);
  });
  const next = rng(seed);
  const out: Array<{ label: string; state: QuestState }> = [];
  for (const id of order) {
    const pool = [...byStage.get(id)!];
    for (let k = 0; k < per && pool.length; k++) {
      const i = pool.splice(Math.floor(next() * pool.length), 1)[0];
      out.push({ label: `${id} state ${i}`, state: relocate(ctx, g.nodes[i].state) });
    }
  }
  return out;
}

export interface ResetRun {
  result: ProofResult;
  starts: number;
  /** States searched beyond the main graph's. */
  states: number;
}

/** Proof (c) from every reset state (the main search's graph first: its states are the known good ones). */
export function proofFromReset(ctx: QuestContext, samples = 50): ResetRun {
  if (ctx.stage) throw new Error('--from-reset runs on the full quest, not one --stage');
  const { world } = ctx;
  const goal = world.quest.goal;
  const main = stateGraph(ctx);
  const good = canReach(main, (n) => n.state.flags.has(goal));
  const known = new Set(main.nodes.filter((_n, i) => good[i]).map((n) => n.key));
  const failures: ProofFailure[] = [];
  if (main.limited) failures.push(fail('c', 'LIMIT', `LIMIT the main search stopped at ${ctx.maxStates} states`));
  const starts = [...stageResetStates(ctx), ...midStageStates(ctx, samples)];
  let states = 0;
  for (const { label, state } of starts) {
    const g = exploreStates(ctx, { start: state, maxStates: ctx.maxStates, known });
    if (g.limited) failures.push(fail('c', 'LIMIT', `LIMIT reset ${label}: the search stopped at ${ctx.maxStates} states`));
    if (!g.nodes.length) {
      failures.push(fail('c', 'SOFTLOCK', `SOFTLOCK reset ${label}: Cornelia's arrival is no place`));
      continue;
    }
    states += g.nodes.filter((n) => !known.has(n.key)).length;
    const ok = canReach(g, (n) => known.has(n.key) || n.state.flags.has(goal));
    const bad = ok.findIndex((v) => !v);
    if (bad >= 0) {
      const p = g.nodes[bad].state.place;
      failures.push(fail('c', 'SOFTLOCK', `SOFTLOCK reset ${label}: ${p.map} (${p.x},${p.y}) ${p.mode} cannot reach ${goal}`
        + ` (${ok.filter((v) => !v).length} states)`, pathTo(g, bad)));
    }
    const back = canReach(g, (n) => n.comp.map === world.worldMap || known.has(n.key) || n.state.flags.has(goal));
    const lost = g.nodes.findIndex((n, i) => !back[i] && n.comp.mode === 'walking');
    if (lost >= 0) {
      const p = g.nodes[lost].state.place;
      failures.push(fail('c', 'STRANDED', `STRANDED reset ${label}: ${p.map} (${p.x},${p.y}) has no route back`, pathTo(g, lost)));
    }
  }
  const res = result('c', 'from reset', failures,
    `(${starts.length} reset states: ${stageOrder(world.quest).length} stage entries, mid-stage samples; ${states} new states, every one reaches ${goal})`);
  return { result: res, starts: starts.length, states };
}
