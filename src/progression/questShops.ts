/**
 * Proofs (e) no early shops and (f) price walls (docs/WORLD_PLAN.md 6.0, 3.5; QUEST 5.2 (e)).
 *
 * (e): for each `towns[]` entry and each stage P of its `opensAfter`, the closure with P's grants withheld (the
 * events that give them disabled) must not make any keeper of the town talkable; else
 * `EARLY <town> talkable before <P>: <path>`. A town whose keepers are never talkable at all is `SHOPLESS`.
 *
 * (f): a town is walled when its kit costs more than the kit of every stage that opens right after its
 * `opensAfter` (crescent and gaia on quest.yaml). Its cumulative gold when a keeper first becomes talkable must be
 * below 40 % of its kit's 4-member price: `PRICEWALL <town> <gold> vs <price>`.
 */
import type { QuestStage, QuestTown } from '../types/index.js';
import type { ProofFailure, ProofResult, QuestState } from './questTypes.js';
import { stageMark, withheld } from './questStates.js';
import { ancestorsOf } from './questData.js';
import { townKeepers, townMapIds } from './questCatalog.js';
import { closure, fail, result, without, type QuestContext } from './questProofs.js';
import { saturate } from './questSaturate.js';
import { curveOf } from './questCurve.js';
import { kitPrice, lateOf } from './questLateData.js';

export const WALL_SHARE = 0.4;
export const BAND_GOLD_SHARE = 0.5;

/** The catalog event ids of a town's keepers. */
export function keeperEvents(ctx: QuestContext, town: QuestTown): string[] {
  return townKeepers(ctx.world, town).flatMap((k) => ctx.cat.byNpc.get(`${k.map}\0${k.npc}`)?.id ?? []);
}

/** A town with no loaded map (a stub not compiled, or a fixture without it) is pending. */
export function townBuilt(ctx: QuestContext, town: QuestTown): boolean {
  return townMapIds(ctx.world, town).length > 0 && keeperEvents(ctx, town).length > 0;
}

export function proofEarlyShops(ctx: QuestContext): ProofResult {
  const failures: ProofFailure[] = [];
  let checked = 0;
  let pending = 0;
  for (const town of ctx.world.quest.towns) {
    if (!townBuilt(ctx, town)) {
      pending++;
      if (ctx.strict) failures.push(fail('e', 'EARLY', `EARLY ${town.id} pending: no keeper on a loaded map`));
      continue;
    }
    checked++;
    const ids = keeperEvents(ctx, town);
    if (!ids.some((id) => closure(ctx).availableEver.has(id))) {
      // INT-W2a: from a `--stage` entry a town whose opensAfter stages the closure never completes (lufenia from S6)
      // is out of this run's scope, not shopless; the full run checks it from the new game
      if (ctx.stage && !town.opensAfter.every((p) => closure(ctx).stageDone(p))) continue;
      failures.push(fail('e', 'SHOPLESS', `SHOPLESS ${town.id} no keeper is ever talkable`));
      continue;
    }
    for (const p of town.opensAfter) {
      const stage = ctx.world.stages.get(p);
      if (!stage) continue;
      const gone = withdrawn(ctx, stage);
      const off = gone.map((g) => without(ctx, g));
      const opts = { disabled: new Set(off.flatMap((o) => [...o.disabled])),
        withhold: withheld({ flags: gone.flatMap((g) => g.grants.flags), items: gone.flatMap((g) => g.grants.items),
          vehicles: gone.flatMap((g) => g.grants.vehicles) }) };
      const sat = saturate(ctx, gone.reduce((st, g) => startWithout(ctx, g, st), ctx.start), opts,
        (s) => ids.some((id) => s.availableEver.has(id)));
      if (ids.some((id) => sat.availableEver.has(id))) {
        failures.push(fail('e', 'EARLY', `EARLY ${town.id} talkable before ${p}`, sat.path()));
      }
    }
  }
  const extra = pending ? `, ${pending} pending` : '';
  return result('e', 'early shops', failures, `(${checked} towns${extra})`);
}

/** The stages withdrawn to stand "before P": P itself and, in assume mode (`--stage X`), every ancestor of X that
 *  comes after P (its grants, e.g. S17's airship before S2, are held at X's entry but can't exist before P). */
export function withdrawn(ctx: QuestContext, p: QuestStage): QuestStage[] {
  if (!ctx.stage) return [p];
  const later = [...ancestorsOf(ctx.world.stages, ctx.stage)]
    .filter((id) => ancestorsOf(ctx.world.stages, id).has(p.id))
    .flatMap((id) => ctx.world.stages.get(id) ?? []);
  return [p, ...later];
}

/** The start with a stage's grants taken away: in assume mode (`--stage`) the start already holds every ancestor's
 *  grants, so withholding the events that give them is not enough (as proof (b) does in assume mode). */
export function startWithout(ctx: QuestContext, s: QuestStage, st: QuestState = ctx.start): QuestState {
  if (!ctx.stage) return st;
  const gone = new Set(s.grants.vehicles);
  const flags = new Set([...st.flags].filter((f) => !s.grants.flags.includes(f) && f !== stageMark(s.id)));
  // INT-W2a: the entry of a stage after `s` (S10's hall mouth, S6's moor) is itself past `s`: start from the game's
  // start place instead, and let the closure re-derive what is reachable with the remaining grants
  const after = ancestorsOf(ctx.world.stages, ctx.stage).has(s.id);
  const place = after ? { ...ctx.world.start, mode: 'walking' as const }
    : gone.has(st.place.mode) ? { ...st.place, mode: 'walking' as const } : st.place;
  return { ...st, flags, items: new Set([...st.items].filter((i) => !s.grants.items.includes(i))), place,
    vehicles: st.vehicles.filter((v) => !gone.has(v.type)) };
}

/** Whether a town gets a price wall: its kit costs more than every kit of the stages right after `opensAfter`. */
export function walled(ctx: QuestContext, town: QuestTown): boolean {
  const data = lateOf(ctx);
  const own = kitPrice(data, town.kit);
  if (own === null) return false;
  const next = ctx.world.quest.stages.filter((s) => s.after.some((a) => town.opensAfter.includes(a)));
  const prices = next.map((s) => kitPrice(data, s.kit)).filter((p): p is number => p !== null);
  return prices.length > 0 && prices.every((p) => own > p);
}

export function proofPriceWalls(ctx: QuestContext): ProofResult {
  const data = lateOf(ctx);
  const failures: ProofFailure[] = [];
  const shown: string[] = [];
  let pending = 0;
  const curve = curveOf(ctx);
  for (const town of ctx.world.quest.towns) {
    if (!walled(ctx, town)) continue;
    const price = kitPrice(data, town.kit)!;
    const gold = curve.townFirstGold.get(town.id);
    if (!townBuilt(ctx, town) || gold === undefined || curve.assumedTowns.has(town.id)) {
      pending++;
      shown.push(`${town.id} pending`);
      continue;
    }
    if (gold >= WALL_SHARE * price) failures.push(fail('f', 'PRICEWALL', `PRICEWALL ${town.id} ${Math.round(gold)} vs ${price}`));
    shown.push(`${town.id} ${Math.round(gold)}/${price}`);
  }
  void pending;
  return result('f', 'price walls', failures, shown.join('  ') || '(no walled town)');
}
