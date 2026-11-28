/**
 * The T4d field-pacing campaign (docs/FIX_PLAN_PENINSULA.md T4 §3, §4.4, §4.5; EB-3), shared by
 * `fieldPacing.test.ts` and `economy.test.ts` (docs/FEEDBACK_PLAN_2026-11-14.md §3.1): a seeded campaign on the real
 * battle engine, real characters (FF1 XP table, level-up HP) and real prices, over the §1.6 formation tables as the
 * compiled maps hold them (T4e: the overworld's default table and its `temple_approach` zone, and the temple's table).
 *
 * Campaign: the 400 G kit; 20 fields battles, then 10 temple-approach battles, then 10 temple battles, sensible
 * play. The party rests at the inn (30 G) after a battle when someone is down, party HP is below 45 %, or the White
 * Mage has no CURE left and someone is below 50 %; it then buys the next items on the shopping list it can afford.
 * It also shops (no inn) at each zone boundary and once after the last battle, the walk home (R4b). A wipe halves
 * the gold and sends the party to the inn.
 *
 * `noShopBeforeL2` (§3.1 "gold in hand"): the party does not shop until the whole party is Lv 2, so `goldAtL2` (the
 * gold after the reward and the inn rule of the battle in which the last member reaches Lv 2) is what it can spend.
 */
import { runBattle, mulberry32 } from '../helpers/battlePolicies.js';
import { makeParty, rollFormation, item, spell, kitCost, SPELLS, SHOPS, PARTY, START_KIT, type Zone } from '../helpers/balanceData.js';
import { spellPrice } from '../../src/systems/SpellPurchase.js';
import { slotOf } from '../../src/entities/EquipmentRules.js';
import type { Character } from '../../src/entities/Character.js';

export const SCHEDULE: Array<[Zone, number]> = [['fields', 20], ['approach', 10], ['temple', 10]];
export const RUNS = 200;
export const START_GOLD = 400;

/** The rest of the full kit, in buying order (about 700 G at FF1 prices, Cap 80 G). */
export const SHOPPING: Array<{ who: string; item?: string; spell?: string }> = [
  { who: 'black_mage', spell: 'lit' },
  { who: 'warrior', item: 'chain_mail' },
  { who: 'black_mage', spell: 'slep' },
  { who: 'white_mage', spell: 'ruse' },
];
const priceOf = (s: (typeof SHOPPING)[number]): number => (s.item ? item(s.item).price : spellPrice(spell(s.spell!)));
const innPrice = SHOPS.find((s) => s.id === 'cornelia_inn')?.innPrice ?? 30;
/** §1.5: what the party's 400 G starting kit costs at the real prices (370 G for Warrior / Thief / White / Black). */
export const START_KIT_COST = PARTY.reduce((sum, c) => sum + kitCost(START_KIT[c], spellPrice), 0);

export interface Campaign {
  /** Battle number at which the whole party first reached each level. */
  reachedAt: Record<number, number>;
  wipes: number;
  inns: number;
  gold: number;
  bought: number;
  levels: number[];
  /** Battle number (battles fought so far) at which each SHOPPING entry was bought, by index. */
  boughtAt: number[];
  /** Gold in hand at whole-party Lv 2 (after that battle's reward and inn rule); undefined if never reached. */
  goldAtL2?: number;
}

export interface CampaignOptions {
  noShopBeforeL2?: boolean;
  /** The zones and battle counts to fight (default SCHEDULE). */
  schedule?: Array<[Zone, number]>;
}

/**
 * The temple-approach-only route (final play test, pass F): the party walks straight to the approach (wolves and
 * Gr.Imps, no goblins) and levels on wolf XP. The gold at whole-party Lv 2 must hold on this route too.
 */
export const APPROACH_ONLY: Array<[Zone, number]> = [['approach', 20], ['temple', 10]];

export function campaign(seed: number, opts: CampaignOptions = {}): Campaign {
  const rng = mulberry32(seed);
  const party: Character[] = makeParty(1, 'start', true);
  let gold = START_GOLD - START_KIT_COST;
  let next = 0, inns = 0, wipes = 0, battles = 0;
  const reachedAt: Record<number, number> = {};
  const boughtAt: number[] = [];
  const shop = (): void => {
    if (opts.noShopBeforeL2 && reachedAt[2] === undefined) return;
    while (next < SHOPPING.length && gold >= priceOf(SHOPPING[next])) {
      const s = SHOPPING[next++];
      boughtAt.push(battles);
      gold -= priceOf(s);
      const c = party[PARTY.indexOf(s.who)];
      if (s.item) {
        const it = item(s.item);
        const slot = slotOf(it);
        if (!slot || c.equip(slot, it) === false) throw new Error(`${s.who} cannot equip ${s.item}`);
      } else {
        c.learnSpell(s.spell!, spell(s.spell!).level);
      }
    }
  };
  let goldAtL2: number | undefined;
  /** The inn rule; `atL2` = this battle is the one that took the whole party to Lv 2 (no shopping after it yet). */
  const inn = (atL2 = false): void => {
    inns++;
    gold -= Math.min(gold, innPrice);
    for (const c of party) { c.currentHp = c.maxHp; c.restoreAllCharges(); }
    if (!atL2 || !opts.noShopBeforeL2) shop();
  };
  for (const [zone, count] of opts.schedule ?? SCHEDULE) {
    shop();
    for (let b = 0; b < count; b++) {
      const r = runBattle(party, rollFormation(zone, rng), SPELLS, 'sensible', rng);
      battles++;
      if (r.outcome !== 'victory') {
        wipes++;
        gold = Math.floor(gold / 2);
        inn();
        continue;
      }
      const result = r.bsm.battleResult!;
      gold += result.goldReward;
      for (const c of party) if (c.currentHp > 0) c.addXp(result.xpPerMember);
      const minLevel = Math.min(...party.map((c) => c.level));
      const newL2 = minLevel >= 2 && reachedAt[2] === undefined;
      for (let L = 2; L <= minLevel; L++) reachedAt[L] ??= battles;
      const hp = party.reduce((s, c) => s + Math.max(0, c.currentHp), 0);
      const max = party.reduce((s, c) => s + c.maxHp, 0);
      const wm = party[PARTY.indexOf('white_mage')];
      if (party.some((c) => c.currentHp <= 0) || hp < 0.45 * max
        || (!wm.hasCharges(1) && party.some((c) => c.currentHp < 0.5 * c.maxHp))) inn(newL2);
      if (newL2) goldAtL2 = gold;
    }
  }
  shop();
  return { reachedAt, wipes, inns, gold, bought: next, levels: party.map((c) => c.level), boughtAt, goldAtL2 };
}

export const median = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
/** The p-th percentile (nearest rank, p in [0, 1]). */
export const percentile = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
