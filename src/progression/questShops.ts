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
import type { QuestTown } from '../types/index.js';
import type { ProofFailure, ProofResult } from './questTypes.js';
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
      failures.push(fail('e', 'SHOPLESS', `SHOPLESS ${town.id} no keeper is ever talkable`));
      continue;
    }
    for (const p of town.opensAfter) {
      const stage = ctx.world.stages.get(p);
      if (!stage) continue;
      const sat = saturate(ctx, ctx.start, without(ctx, stage), (s) => ids.some((id) => s.availableEver.has(id)));
      if (ids.some((id) => sat.availableEver.has(id))) {
        failures.push(fail('e', 'EARLY', `EARLY ${town.id} talkable before ${p}`, sat.path()));
      }
    }
  }
  const extra = pending ? `, ${pending} pending` : '';
  return result('e', 'early shops', failures, `(${checked} towns${extra})`);
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
