/**
 * W1-I's proofs (d)-(h) on the core context (docs/WORLD_PLAN.md 6.0; docs/QUEST_PLAN.md 5.2), loaded by the CLI
 * (`LateProofModule`, questReport.ts):
 * (d) bands: the curve model's level at each built stage's boss (or end) is inside its band, each `grind` is in
 *     [1.0, 7.0] (raised from 3.0 by the user, 2026-11-17, INT-W2c), the cumulative gold at each built town's `bandStage` start is at least 50 % of its kit's 4-member
 *     price, and (d3) each `takeGold` price is at most 80 % of the gold at its stage's start;
 * (e) early shops and (f) price walls (questShops.ts); (g) geography (questGeo.ts); (h) the travel matrix
 * (questTravel.ts).
 */
import type { ProofFailure, ProofId, ProofResult } from './questTypes.js';
import { fail, result, type QuestContext } from './questProofs.js';
import { curveOf } from './questCurve.js';
import { kitPrice, lateOf } from './questLateData.js';
import { BAND_GOLD_SHARE, proofEarlyShops, proofPriceWalls, townBuilt } from './questShops.js';
import { proofGeo } from './questGeo.js';
import { proofTravel } from './questTravel.js';

export const GRIND_RANGE: readonly [number, number] = [1.0, 7.0];
export const TAKE_GOLD_SHARE = 0.8;

export function proofBands(ctx: QuestContext): ProofResult {
  const { world } = ctx;
  const data = lateOf(ctx);
  const curve = curveOf(ctx);
  const failures: ProofFailure[] = [];
  const shown: string[] = [];
  let pending = 0;
  for (const s of ctx.checked) {
    if (s.grind < GRIND_RANGE[0] || s.grind > GRIND_RANGE[1]) {
      failures.push(fail('d', 'BAND', `BAND ${s.id} grind ${s.grind} outside [${GRIND_RANGE[0].toFixed(1)}, ${GRIND_RANGE[1].toFixed(1)}]`));
    }
    if (s.status !== 'built') { pending++; continue; }
    if (!s.band) continue;
    const p = curve.points.get(s.id);
    const name = p?.boss ?? s.id;
    if (!p) {
      failures.push(fail('d', 'BAND', `BAND ${s.id} never reached on the witness walk`));
      continue;
    }
    const lv = Math.floor(p.level);
    const text = `${name} L${p.level.toFixed(1)} [${s.band[0]},${s.band[1]}]`;
    // outside the band only because pending stages were assumed at their band lows (a pending ancestor: below; pending
    // stages the witness fires first, e.g. S20-S30 before the off-path S18): it waits for them
    if ((lv < s.band[0] || lv > s.band[1]) && !ctx.strict && curve.assumedGold.has(s.id)) { pending++; continue; }
    if (lv < s.band[0] || lv > s.band[1]) failures.push(fail('d', 'BAND', `BAND ${s.id} ${name} L${p.level.toFixed(1)} outside [${s.band[0]},${s.band[1]}]`));
    shown.push(text);
  }
  for (const town of world.quest.towns) {
    if (ctx.stage || !townBuilt(ctx, town)) continue;
    const price = kitPrice(data, town.kit);
    const gold = curve.stageStartGold.get(town.bandStage);
    if (price === null || gold === undefined || curve.assumedGold.has(town.bandStage)) continue;
    if (gold < BAND_GOLD_SHARE * price) {
      failures.push(fail('d', 'BAND', `BAND ${town.id} gold ${Math.round(gold)} at ${town.bandStage} below 50 % of ${price}`));
    }
  }
  let prices = 0;
  for (const t of curve.takeGold) {
    prices++;
    const gold = t.stage ? curve.stageStartGold.get(t.stage) : undefined;
    if (gold === undefined || (t.stage && curve.assumedGold.has(t.stage))) continue;
    if (t.price > TAKE_GOLD_SHARE * gold) {
      failures.push(fail('d', 'BAND', `BAND ${t.id} price ${t.price} above 80 % of ${Math.round(gold)} at ${t.stage}`));
    }
  }
  const pend = pending ? `  (${pending} pending)` : '';
  return result('d', 'bands', failures, `${shown.join('  ')}${pend}  prices: OK (${prices} takeGold)`);
}

/** Proofs (d)-(h), or the subset named by `only`. */
export function runLateProofs(ctx: QuestContext, only?: ReadonlySet<ProofId>): ProofResult[] {
  const want = (p: ProofId): boolean => !only || only.has(p);
  const out: ProofResult[] = [];
  if (want('d')) out.push(proofBands(ctx));
  if (want('e')) out.push(proofEarlyShops(ctx));
  if (want('f')) out.push(proofPriceWalls(ctx));
  if (want('g')) out.push(proofGeo(ctx));
  if (want('h')) out.push(proofTravel(ctx));
  return out;
}
