/**
 * How a mutation is caught (docs/QUEST_PLAN.md 5.4, docs/WORLD_PLAN.md 6.3): the proofs run on the mutated world and a
 * failure the unmutated world does not have catches it. For the no-skip proof the mutation suite uses a stage-scoped
 * (b) with two extra withholdings, so a gate whose removal hands out a vehicle or keeps a co-requirement is seen:
 * - an ancestor's flags and items withheld, the events giving them off, its vehicles not withheld (GT-3: a ship spawn
 *   without its flag gives the ship before the pirates);
 * - each requirement withheld alone, every event still firing (GT-7: the crown gone from Astos while the guard's
 *   victory still sets its flag).
 * A stage with no boss and no grants (S3, S4, S20) is reached when the party reaches one of its maps.
 */
import type { QuestStage } from '../types/index.js';
import type { ProofFailure, ProofId } from './questTypes.js';
import { ancestorsOf, globMatch, type QuestWorld } from './questData.js';
import { lateOf, type LateData } from './questLateData.js';
import { withheld, type WithheldGrants } from './questStates.js';
import { bossEvents, eventsGranting, saturate, type Saturator } from './questSaturate.js';
import { fail, grantsText, proofOrder, reachedStage, without, type QuestContext } from './questProofs.js';
import { proofSkips, proofSoftlocks } from './questChecks.js';
import { proofEarlyShops } from './questShops.js';
import { proofTravel } from './questTravel.js';

export function reachedOrVisited(ctx: QuestContext, sat: Saturator, s: QuestStage): string | null {
  const hit = reachedStage(ctx, sat, s);
  if (hit) return hit;
  const g = s.grants;
  if (s.boss.length || g.flags.length + g.items.length + g.vehicles.length) return null;
  const m = [...sat.reachedMaps].find((id) => s.maps.some((gl) => globMatch(id, gl)));
  return m ? `map ${m}` : null;
}

/** The stage-scoped (b): SKIP and MILESTONE failures of one stage (see the module comment). */
export function stageSkips(ctx: QuestContext, s: QuestStage): ProofFailure[] {
  if (ctx.stage) return proofSkips(ctx).failures;
  const out = new Map<string, ProofFailure>();
  const check = (opts: { disabled?: Set<string>; withhold?: WithheldGrants }, why: string): void => {
    const sat = saturate(ctx, ctx.start, opts);
    const hit = reachedOrVisited(ctx, sat, s);
    if (!hit) return;
    const msg = `SKIP ${s.id} ${hit} reachable without ${why}`;
    if (!out.has(msg)) out.set(msg, fail('b', 'SKIP', msg, sat.path()));
  };
  for (const p of [...ancestorsOf(ctx.world.stages, s.id)]) {
    const ps = ctx.world.stages.get(p)!;
    if (ps.status === 'built' && grantsText(ps) === 'no grants') continue;
    const why = `${p} (${grantsText(ps)})`;
    check(without(ctx, ps), why);
    const fi = { flags: ps.grants.flags, items: ps.grants.items };
    const disabled = eventsGranting(ctx, fi);
    disabled.add(`quest:stage:${p}`);
    check({ disabled, withhold: withheld(fi) }, why);
  }
  const needs: Array<{ flags?: string[]; items?: string[]; vehicles?: string[] }> = [
    ...s.requires.flags.map((f) => ({ flags: [f] })), ...s.requires.items.map((i) => ({ items: [i] })),
    ...s.requires.vehicles.map((v) => ({ vehicles: [v] }))];
  for (const n of needs) {
    const why = `its requirement ${[...(n.flags ?? []), ...(n.items ?? []), ...(n.vehicles ?? [])][0]}`;
    check({ disabled: eventsGranting(ctx, n), withhold: withheld(n) }, why);
    check({ withhold: withheld(n) }, why);
  }
  // the stage's own boss gates its other grants (act 1: the King and the princess wait for Garland)
  const bosses = bossEvents(ctx, s);
  if (bosses.length) {
    const sat = saturate(ctx, ctx.start, { disabled: new Set(bosses.map((e) => e.id)) });
    const g = [...s.grants.flags.filter((f) => sat.flags.has(f)), ...s.grants.items.filter((i) => sat.items.has(i))];
    if (g.length) {
      const msg = `SKIP ${s.id} ${g.join(', ')} reachable without its boss ${s.boss.join(', ')}`;
      out.set(msg, fail('b', 'SKIP', msg, sat.path()));
    }
  }
  const ms = s.milestones ?? [];
  for (let i = 0; i + 1 < ms.length; i++) {
    const sat = saturate(ctx, ctx.start, { disabled: eventsGranting(ctx, { flags: [ms[i]] }), withhold: withheld({ flags: [ms[i]] }) });
    const later = ms.slice(i + 1).find((m) => sat.flags.has(m));
    if (later) {
      const msg = `MILESTONE ${s.id} ${later} reachable without ${ms[i]}`;
      out.set(msg, fail('b', 'MILESTONE', msg, sat.path()));
    }
  }
  return [...out.values()];
}

/** What a mutation run looks at: a proof letter, and for (b) the stage. */
export interface CheckKey {
  proof: ProofId;
  stage?: string;
}

const keyText = (k: CheckKey): string => `${k.proof}:${k.stage ?? ''}`;

/** Runs one check on a context. */
export function runCheck(ctx: QuestContext, k: CheckKey): ProofFailure[] {
  switch (k.proof) {
    case 'a': return proofOrder(ctx).failures;
    case 'b': {
      const s = k.stage ? ctx.world.stages.get(k.stage) : undefined;
      return s ? stageSkips(ctx, s) : ctx.checked.flatMap((x) => stageSkips(ctx, x));
    }
    case 'c': return proofSoftlocks(ctx).failures;
    case 'e': return proofEarlyShops(ctx).failures;
    case 'h': return proofTravel(ctx).failures;
    default: return [];
  }
}

/**
 * The checks of mutated worlds, by base world and late data, then by stage, state cap, element and check key. A
 * mutated context is built from exactly those (`mutatedContext`: never strict), so a second suite on the same world
 * (questMutateWorld.test.ts: plain, then --strict, each about half an hour) reuses the first one's runs; its own
 * baseline still decides what is fresh.
 */
const RUNS = new WeakMap<QuestWorld, WeakMap<LateData, Map<string, ProofFailure[]>>>();

function runsOf(ctx: QuestContext): Map<string, ProofFailure[]> {
  let byLate = RUNS.get(ctx.world);
  if (!byLate) RUNS.set(ctx.world, byLate = new WeakMap());
  const late = lateOf(ctx);
  let runs = byLate.get(late);
  if (!runs) byLate.set(late, runs = new Map());
  return runs;
}

/** The checks of the unmutated world, cached by key (a failure already there catches nothing). */
export class Baseline {
  private cache = new Map<string, Set<string>>();

  constructor(private readonly ctx: QuestContext) {}

  /**
   * The failures the baseline lacks of the mutated context `make` builds (lazily) for element `id` (unique in the
   * base world's mutation list); the mutated checks are cached in RUNS.
   */
  freshFor(id: string, make: () => QuestContext, keys: CheckKey[]): ProofFailure[] {
    const runs = runsOf(this.ctx);
    const scope = `${this.ctx.stage ?? ''}|${this.ctx.maxStates}|${id}|`;
    let mctx: QuestContext | undefined;
    const out: ProofFailure[] = [];
    for (const k of keys) {
      const key = scope + keyText(k);
      let got = runs.get(key);
      if (!got) runs.set(key, got = runCheck(mctx ??= make(), k));
      for (const f of got) if (!this.has(k, f.message)) out.push(f);
    }
    return out;
  }

  has(k: CheckKey, message: string): boolean {
    const key = keyText(k);
    let set = this.cache.get(key);
    if (!set) {
      set = new Set(runCheck(this.ctx, k).map((f) => f.message));
      this.cache.set(key, set);
    }
    return set.has(message);
  }
}

/** The stage a `SKIP S4 ` / `MILESTONE S30 ` prefix names. */
export function prefixStage(prefix: string): string | undefined {
  return /^(?:SKIP|MILESTONE) (S\d+) /.exec(prefix)?.[1];
}
