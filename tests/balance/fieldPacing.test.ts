/**
 * T4d field pacing (docs/FIX_PLAN_PENINSULA.md T4 §3, §4.4, §4.5; EB-3): a seeded campaign on the real battle engine,
 * real characters (FF1 XP table, level-up HP) and real prices, over the §1.6 formation tables as the compiled maps
 * hold them (T4e: the overworld's default table and its `temple_approach` zone, and the temple's table).
 *
 * Campaign: the 400 G kit; 20 fields battles, then 10 temple-approach battles, then 10 temple battles, sensible
 * play. The party rests at the inn (30 G) after a battle when someone is down, party HP is below 45 %, or the White
 * Mage has no CURE left and someone is below 50 %; it then buys the next items on the shopping list it can afford.
 * A wipe halves the gold and sends the party to the inn.
 */
import { describe, it, expect } from 'vitest';
import { runBattle, mulberry32 } from '../helpers/battlePolicies.js';
import { makeParty, rollFormation, item, spell, SPELLS, SHOPS, PARTY, type Zone } from '../helpers/balanceData.js';
import { spellPrice } from '../../src/systems/SpellPurchase.js';
import { slotOf } from '../../src/entities/EquipmentRules.js';
import type { Character } from '../../src/entities/Character.js';

const SCHEDULE: Array<[Zone, number]> = [['fields', 20], ['approach', 10], ['temple', 10]];
const RUNS = 200;
const START_GOLD = 400;

/** The rest of the full kit, in buying order (about 700 G at FF1 prices, Cap 80 G). */
const SHOPPING: Array<{ who: string; item?: string; spell?: string }> = [
  { who: 'black_mage', spell: 'lit' },
  { who: 'warrior', item: 'cap' }, { who: 'thief', item: 'cap' }, { who: 'white_mage', item: 'cap' }, { who: 'black_mage', item: 'cap' },
  { who: 'warrior', item: 'chain_mail' },
  { who: 'black_mage', spell: 'slep' },
  { who: 'white_mage', spell: 'ruse' },
];
const priceOf = (s: (typeof SHOPPING)[number]): number => (s.item ? item(s.item).price : spellPrice(spell(s.spell!)));
const innPrice = SHOPS.find((s) => s.id === 'cornelia_inn')?.innPrice ?? 30;

interface Campaign { reachedAt: Record<number, number>; wipes: number; inns: number; gold: number; bought: number; levels: number[] }

function campaign(seed: number): Campaign {
  const rng = mulberry32(seed);
  const party: Character[] = makeParty(1, 'start', true);
  let gold = START_GOLD - 370; // §1.5: the kit costs 370
  let next = 0, inns = 0, wipes = 0, battles = 0;
  const reachedAt: Record<number, number> = {};
  const inn = (): void => {
    inns++;
    gold -= Math.min(gold, innPrice);
    for (const c of party) { c.currentHp = c.maxHp; c.restoreAllCharges(); }
    while (next < SHOPPING.length && gold >= priceOf(SHOPPING[next])) {
      const s = SHOPPING[next++];
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
  for (const [zone, count] of SCHEDULE) {
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
      for (let L = 2; L <= minLevel; L++) reachedAt[L] ??= battles;
      const hp = party.reduce((s, c) => s + Math.max(0, c.currentHp), 0);
      const max = party.reduce((s, c) => s + c.maxHp, 0);
      const wm = party[PARTY.indexOf('white_mage')];
      if (party.some((c) => c.currentHp <= 0) || hp < 0.45 * max
        || (!wm.hasCharges(1) && party.some((c) => c.currentHp < 0.5 * c.maxHp))) inn();
    }
  }
  return { reachedAt, wipes, inns, gold, bought: next, levels: party.map((c) => c.level) };
}

const median = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const runs = Array.from({ length: RUNS }, (_, i) => campaign(i + 1));

describe('T4d field pacing (seeded campaign, §4.5)', () => {
  it('the whole party reaches Lv2 within battles 4-10 and Lv3 within 15-35 (median), and every run reaches Lv3', () => {
    const l2 = runs.map((r) => r.reachedAt[2] ?? Infinity);
    const l3 = runs.map((r) => r.reachedAt[3] ?? Infinity);
    expect(median(l2)).toBeGreaterThanOrEqual(4);
    expect(median(l2)).toBeLessThanOrEqual(10);
    expect(median(l3)).toBeGreaterThanOrEqual(15);
    expect(median(l3)).toBeLessThanOrEqual(35);
    expect(l3.filter((b) => b === Infinity), 'runs that never reach Lv3 in 40 battles').toHaveLength(0);
  });

  it('wipes fewer than 0.2 times per 40-battle run', () => {
    expect(runs.reduce((s, r) => s + r.wipes, 0) / RUNS).toBeLessThan(0.2);
  });

  it('leaves 200-1200 G after 40 battles on average, with at least 7 of the 8 full-kit purchases made', () => {
    const gold = runs.reduce((s, r) => s + r.gold, 0) / RUNS;
    expect(gold).toBeGreaterThanOrEqual(200);
    expect(gold).toBeLessThanOrEqual(1200);
    expect(runs.reduce((s, r) => s + r.bought, 0) / RUNS).toBeGreaterThanOrEqual(SHOPPING.length - 1);
  });
});
