/**
 * The proofs' context and proof (a) order (docs/QUEST_PLAN.md 5.2, with docs/WORLD_PLAN.md 6.0's `optional`
 * stages). Proofs (b) and (c) are questChecks.ts; (d)-(h) and the mutation suite are W1-I's (questProofsLate.ts,
 * questMutate.ts), built on `createQuestContext` and the searches.
 */
import type { QuestStage } from '../types/index.js';
import type { ProofFailure, ProofId, ProofResult, QuestState } from './questTypes.js';
import { globMatch, stageOrder, type QuestWorld } from './questData.js';
import { buildCatalog } from './questCatalog.js';
import { stageMark, withheld, type WithheldGrants } from './questStates.js';
import {
  assumedState, createModel, exploreStates, newGameState, type QuestModel, type StateGraph,
} from './questSearch.js';
import { bossEvents, eventsGranting, saturate, Saturator } from './questSaturate.js';

export interface QuestContextOptions {
  /** `--stage S<n>`: assume mode for one stage, from its `entry`. */
  stage?: string;
  /** `--strict`: a pending stage is an error. */
  strict?: boolean;
  /** The exact search's state cap. */
  maxStates?: number;
}

/** Everything a proof needs; W1-I's proofs take the same context. */
export interface QuestContext extends QuestModel {
  stage?: string;
  strict: boolean;
  maxStates: number;
  start: QuestState;
  /** The stages the run checks: every stage, or the `--stage` one. */
  checked: QuestStage[];
  /** The exact state graph, once proof (c) (or `stateGraph`) has built it. */
  graph?: StateGraph;
  /** The saturation from the start, once proof (a) (or `closure`) has built it. */
  sat?: Saturator;
}

export function createQuestContext(world: QuestWorld, opts: QuestContextOptions = {}): QuestContext {
  const model = createModel(world, buildCatalog(world));
  if (opts.stage && !world.stages.has(opts.stage)) throw new Error(`--stage: no stage ${opts.stage}`);
  const start = opts.stage ? assumedState(model, opts.stage) : newGameState(model);
  const checked = opts.stage ? [world.stages.get(opts.stage)!]
    : stageOrder(world.quest).map((id) => world.stages.get(id)!);
  return { ...model, stage: opts.stage, strict: !!opts.strict, maxStates: opts.maxStates ?? 200000, start, checked };
}

/** The saturation closure from the context's start (cached). */
export function closure(ctx: QuestContext): Saturator {
  ctx.sat ??= saturate(ctx, ctx.start);
  return ctx.sat;
}

/** The exact state graph from the context's start (cached). */
export function stateGraph(ctx: QuestContext): StateGraph {
  ctx.graph ??= exploreStates(ctx, { start: ctx.start, maxStates: ctx.maxStates });
  return ctx.graph;
}

export const fail = (proof: ProofId, code: string, message: string, path?: string[]): ProofFailure =>
  ({ proof, code, message, ...(path ? { path } : {}) });

export function result(proof: ProofId, name: string, failures: ProofFailure[], okDetail: string): ProofResult {
  const ok = failures.length === 0;
  const line = ok ? `(${proof}) ${name}: OK  ${okDetail}`.trimEnd()
    : `(${proof}) ${name}: FAIL  (${failures.length} failure${failures.length === 1 ? '' : 's'})`;
  return { proof, ok, line, failures };
}

/** Disabled events and withheld grants that take a stage's grants out of the world. */
export function without(ctx: QuestContext, s: QuestStage): { disabled: Set<string>; withhold: WithheldGrants } {
  const disabled = eventsGranting(ctx, s.grants);
  disabled.add(`quest:stage:${s.id}`);
  return { disabled, withhold: withheld(s.grants) };
}

/** Whether the stage's boss or any of its grants was reached in a saturation. */
export function reachedStage(ctx: QuestContext, sat: Saturator, s: QuestStage): string | null {
  const boss = bossEvents(ctx, s).find((e) => sat.availableEver.has(e.id));
  if (boss) return boss.boss.filter((b) => s.boss.includes(b)).join(', ');
  const f = s.grants.flags.find((x) => sat.flags.has(x));
  if (f) return f;
  const i = s.grants.items.find((x) => sat.items.has(x));
  if (i) return i;
  const v = s.grants.vehicles.find((x) => sat.vehicles.some((y) => y.type === x && y.map !== ''));
  return v ?? null;
}

export function grantsText(s: QuestStage): string {
  return [...s.grants.items, ...s.grants.flags, ...s.grants.vehicles].join(', ') || 'no grants';
}

/** Replays a stage's `walk` (QUEST 5.5) from the state where its `after` stages are done, with the stage's own
 *  events held back until then. Returns a failure message, or null. */
function replayWalk(ctx: QuestContext, s: QuestStage): string | null {
  const own = eventsGranting(ctx, s.grants);
  for (const ev of ctx.cat.events) if (s.maps.some((g) => globMatch(ev.map, g))) own.add(ev.id);
  own.add(`quest:stage:${s.id}`);
  const before = saturate(ctx, ctx.start, { disabled: own }, (x) => s.after.every((a) => x.stageDone(a)));
  if (!s.after.every((a) => before.stageDone(a))) return `WALK ${s.id}: its after stages never complete`;
  const sat = new Saturator(ctx, { ...ctx.start, flags: before.flags, items: before.items, vehicles: before.vehicles });
  for (const r of before.roots) sat.addRoot(r);
  for (const [i, stepId] of s.walk.entries()) {
    sat.reach();
    const hit = sat.available().find(({ ev }) => ev.id === stepId || ev.aliases.includes(stepId));
    if (hit) {
      sat.apply(hit.ev.id, hit.eff, hit.at);
      continue;
    }
    const exit = sat.exits().find((ex) => ex.id === stepId || ex.aliases.includes(stepId));
    if (exit) {
      sat.addRoot(exit.to);
      continue;
    }
    return `WALK ${s.id} step ${i + 1} ${stepId}: not available`;
  }
  sat.reach();
  const view = sat.view(ctx.start.place);
  const missing = [...s.grants.flags.filter((f) => !view.flags.has(f)), ...s.grants.items.filter((x) => !view.items.has(x))];
  return missing.length ? `WALK ${s.id}: ends without ${missing.join(', ')}` : null;
}

export function proofOrder(ctx: QuestContext): ProofResult {
  const { world } = ctx;
  const sat = closure(ctx);
  const failures: ProofFailure[] = [];
  const markAt = (id: string): number | undefined => sat.first.get(stageMark(id));
  if (ctx.stage) {
    const s = world.stages.get(ctx.stage)!;
    if (!sat.stageDone(s.id)) failures.push(fail('a', 'ORDER', `ORDER ${s.id} unreachable from its entry`, sat.path()));
  } else if (!sat.hasGoal()) {
    const stuck = ctx.checked.filter((s) => !world.optional.has(s.id) && !sat.stageDone(s.id)).map((s) => s.id);
    failures.push(fail('a', 'ORDER', `ORDER goal ${world.quest.goal} unreachable; never completed: ${stuck.join(' ')}`,
      sat.path()));
  }
  for (const s of ctx.checked) {
    const g = sat.grantsAt.get(s.id);
    if (g === undefined) continue;
    for (const p of s.after) {
      const pm = markAt(p);
      if (pm === undefined || g < pm) {
        failures.push(fail('a', 'ORDER', `ORDER ${s.id} (${grantsText(s)}) holds before ${p} completes`, sat.path().slice(0, g + 1)));
      }
    }
  }
  const optional: string[] = [];
  const notes: string[] = [];
  if (!ctx.stage) {
    for (const [id, why] of world.optional) {
      const s = world.stages.get(id)!;
      if (!sat.stageDone(id)) {
        // a pending optional stage whose requirement nothing grants yet waits for its source's tranche (S31's
        // adamant: WORLD 3.1 puts it in S28's sky castle, whose quest.yaml grants don't list it); --strict fails it
        const orphan = ungranted(ctx, s);
        if (s.status === 'pending' && orphan.length && !ctx.strict) notes.push(`${id} waits for ${orphan.join(', ')} (granted by no stage)`);
        else failures.push(fail('a', 'OPTIONAL', `OPTIONAL ${id} is unreachable${orphan.length ? `: ${orphan.join(', ')} is granted by no stage or event` : ''}`));
        continue;
      }
      const w = without(ctx, s);
      const rest = saturate(ctx, ctx.start, w);
      if (!rest.hasGoal()) failures.push(fail('a', 'OPTIONAL', `OPTIONAL ${id} is required: the goal is unreachable without ${grantsText(s)}`));
      optional.push(why === 'derived' ? `${id}*` : id);
    }
  }
  for (const s of ctx.checked) {
    if (!s.walk.length) continue;
    const msg = replayWalk(ctx, s);
    if (msg) failures.push(fail('a', 'WALK', msg));
  }
  if (ctx.strict) {
    for (const s of ctx.checked) if (s.status === 'pending') failures.push(fail('a', 'PENDING', `PENDING ${s.id} is not built`));
  }
  const order = ctx.checked.filter((s) => markAt(s.id) !== undefined)
    .sort((a, b) => (markAt(a.id)! - markAt(b.id)!) || stageOrder(world.quest).indexOf(a.id) - stageOrder(world.quest).indexOf(b.id))
    .map((s) => s.id);
  const opt = optional.length ? `  optional: ${optional.join(' ')} reachable, not required` : '';
  const derived = optional.some((o) => o.endsWith('*')) ? ' (* derived: off the goal\'s path)' : '';
  const note = notes.length ? `; pending: ${notes.join('; ')}` : '';
  return result('a', 'order', failures, `${order.join(' ')}${opt}${derived}${note}`);
}

/** A stage's requirements that no catalog event (real or a stage's synthetic grant) ever gives. */
function ungranted(ctx: QuestContext, s: QuestStage): string[] {
  const start = ctx.start;
  return [
    ...s.requires.flags.filter((f) => !start.flags.has(f) && eventsGranting(ctx, { flags: [f] }).size === 0),
    ...s.requires.items.filter((i) => !start.items.has(i) && eventsGranting(ctx, { items: [i] }).size === 0),
    ...s.requires.vehicles.filter((v) => eventsGranting(ctx, { vehicles: [v] }).size === 0),
  ];
}

/** The distinct places (components) the run has met. */
export function placeCount(ctx: QuestContext): number {
  const keys = new Set<string>(ctx.sat?.reachedComps ?? []);
  for (const n of ctx.graph?.nodes ?? []) keys.add(n.comp.key);
  return keys.size;
}
