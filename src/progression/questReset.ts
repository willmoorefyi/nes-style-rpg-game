/**
 * `--from-reset` (docs/NATURAL_WORLD_PLAN.md 5.3, D-NW8): no soft-lock from a save reset. A pre-NW save moved to
 * Cornelia keeps its flags and items, stands at `cornelia` on foot and has its vehicles at their milestone spots
 * (`resetVehicles`, the code the game runs). For every stage its reset state (the stage's entry state, as `--stage`
 * builds it, relocated so) and up to `samples` relocated states of the main search per stage (a party that saved half
 * way through a stage; a seeded pick) are searched with proof (c): every state reached reaches the goal and has a way
 * back to the world map. The main graph's states are already proven, so a reset search stops where it meets one.
 * NW2 (docs/NW2_EDITS_PLAN.md 12) adds the states its targeted v4 save fix relocates (questResetNw2.ts).
 */
import { resetVehicles, RESET_ENTRANCE } from '../systems/worldReset.js';
import type { VehicleState } from '../types/index.js';
import type { ProofFailure, ProofResult, QuestPlace, QuestState } from './questTypes.js';
import { globMatch, stageOrder } from './questData.js';
import { canReach, pathTo } from './questChecks.js';
import { fail, outOfScopeEvents, result, stateGraph, type QuestContext } from './questProofs.js';
import { assumedState, exploreStates, settle, type QuestModel, type StateNode } from './questSearch.js';
import { Saturator } from './questSaturate.js';
import { stageMark } from './questStates.js';
import { spotCell } from './questSpots.js';
import { nw2States } from './questResetNw2.js';

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

interface Scope { target: string; known: ReadonlySet<string>; stopAt?: string; disabled?: ReadonlySet<string> }

/** Proof (c) from one reset state: every state reached reaches the target (or a known good state) and, on foot, has a
 *  way back to the world map. Returns the failures and the new states searched. */
function checkFrom(ctx: QuestContext, label: string, state: QuestState, sc: Scope):
  { failures: ProofFailure[]; states: number; good: string[] } {
  const { world } = ctx;
  const failures: ProofFailure[] = [];
  const g = exploreStates(ctx, { start: state, maxStates: ctx.maxStates, known: sc.known, stopAt: sc.stopAt, disabled: sc.disabled });
  if (g.limited) failures.push(fail('c', 'LIMIT', `LIMIT reset ${label}: the search stopped at ${ctx.maxStates} states`));
  if (!g.nodes.length) return { failures: [fail('c', 'SOFTLOCK', `SOFTLOCK reset ${label}: Cornelia's arrival is no place`)], states: 0, good: [] };
  const done = (n: StateNode): boolean => sc.known.has(n.key) || n.state.flags.has(sc.target);
  const ok = canReach(g, done);
  const bad = ok.findIndex((v) => !v);
  if (bad >= 0) {
    const p = g.nodes[bad].state.place;
    failures.push(fail('c', 'SOFTLOCK', `SOFTLOCK reset ${label}: ${p.map} (${p.x},${p.y}) ${p.mode} cannot reach ${sc.target}`
      + ` (${ok.filter((v) => !v).length} states)`, pathTo(g, bad)));
  }
  const back = canReach(g, (n) => n.comp.map === world.worldMap || done(n));
  const lost = g.nodes.findIndex((n, i) => !back[i] && n.comp.mode === 'walking');
  if (lost >= 0) {
    const p = g.nodes[lost].state.place;
    failures.push(fail('c', 'STRANDED', `STRANDED reset ${label}: ${p.map} (${p.x},${p.y}) has no route back`, pathTo(g, lost)));
  }
  const good = failures.length ? [] : g.nodes.filter((n) => !sc.known.has(n.key)).map((n) => n.key);
  return { failures, states: g.nodes.filter((n) => !sc.known.has(n.key)).length, good };
}

/** Mid-stage samples per stage by default. The plan (5.3) asks up to 50; measured on the NW world, an airship-era
 *  sample searches 0.3-0.5 million states (40-70 s), so 50 per stage is about 12 hours: `--reset-samples N` asks more. */
export const RESET_SAMPLES = 5;

/**
 * Proof (c) from every reset state. A stage's reset state is searched as `--stage` searches its entry (its scope: the
 * stage's marker the target, the other stages' events off); a mid-stage sample on the full quest, the main search's
 * states (all proven) known good, so a sample's search ends where it rejoins them. A passing sample's states join the
 * known good ones (each reaches the goal), so the next samples, whose vehicles stand at the same reset spots, end
 * sooner.
 */
export function proofFromReset(ctx: QuestContext, samples = RESET_SAMPLES, log: (line: string) => void = () => {}): ResetRun {
  if (ctx.stage) throw new Error('--from-reset runs on the full quest, not one --stage');
  const goal = ctx.world.quest.goal;
  const main = stateGraph(ctx);
  const good = canReach(main, (n) => n.state.flags.has(goal));
  const known = new Set(main.nodes.filter((_n, i) => good[i]).map((n) => n.key));
  const failures: ProofFailure[] = [];
  if (main.limited) failures.push(fail('c', 'LIMIT', `LIMIT the main search stopped at ${ctx.maxStates} states`));
  let states = 0;
  let starts = 0;
  const none = new Set<string>();
  const run = (label: string, state: QuestState, sc: Scope): void => {
    const t0 = Date.now();
    const r = checkFrom(ctx, label, state, sc);
    failures.push(...r.failures);
    states += r.states;
    if (sc.known !== none) r.good.forEach((k) => known.add(k));
    starts++;
    log(`from-reset ${label}: ${r.states} states, ${Date.now() - t0} ms${r.failures.length ? ' FAIL' : ''}`);
  };
  for (const { label, state } of stageResetStates(ctx)) {
    const id = label.split(' ')[0];
    run(label, state, { target: stageMark(id), known: none, stopAt: stageMark(id), disabled: outOfScopeEvents(ctx, id) });
  }
  const nw2 = nw2States(ctx);
  for (const { label, stage, state, problem } of nw2) {
    if (problem) failures.push(fail('c', 'NW2SAVE', `NW2SAVE ${label}: ${problem}`));
    run(label, state, { target: stageMark(stage), known: none, stopAt: stageMark(stage), disabled: outOfScopeEvents(ctx, stage) });
  }
  for (const { label, state } of midStageStates(ctx, samples)) run(label, state, { target: goal, known });
  const n = stageOrder(ctx.world.quest).length;
  const res = result('c', 'from reset', failures, `(${starts} reset states: ${n} stage entries, ${nw2.length} NW2 v4 saves, `
    + `${starts - n - nw2.length} mid-stage samples; ${states} states searched)`);
  return { result: res, starts, states };
}
