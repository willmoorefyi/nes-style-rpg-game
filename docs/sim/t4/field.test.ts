import { test } from 'vitest';
import { installNewModel, makeChar, runBattle, mulberry32, ENEMIES, XP_TO, CHARGES, SPELLS, ITEMS } from './model.ts';
import type { Character } from '/Users/wlmmoor/personal/ff-game/src/entities/Character.ts';

installNewModel();

type Group = { id: string; min: number; max: number };
type Formation = { groups: Group[]; weight: number };
const g = (id: string, min: number, max = min): Group => ({ id, min, max });
export const ZONES: Record<string, Formation[]> = {
  fields: [
    { groups: [g('goblin', 3, 5)], weight: 5 },
    { groups: [g('wolf', 1, 2)], weight: 3 },
    { groups: [g('goblin', 2, 3), g('wolf', 1)], weight: 3 },
    { groups: [g('gr_imp', 1, 2), g('goblin', 1, 3)], weight: 2 },
    { groups: [g('wolf', 2, 4)], weight: 1 },
  ],
  approach: [
    { groups: [g('gr_imp', 2, 4)], weight: 3 },
    { groups: [g('wolf', 2, 4)], weight: 3 },
    { groups: [g('goblin', 4, 6)], weight: 2 },
    { groups: [g('gr_imp', 1, 2), g('wolf', 1, 2)], weight: 2 },
  ],
  east: [
    { groups: [g('wolf', 3, 5)], weight: 3 },
    { groups: [g('gr_imp', 3, 5)], weight: 2 },
    { groups: [g('gr_wolf', 1), g('wolf', 0, 2)], weight: 1 },
  ],
  temple: [
    { groups: [g('skeleton', 2, 4)], weight: 4 },
    { groups: [g('skeleton', 1, 3), g('gr_imp', 1, 2)], weight: 3 },
    { groups: [g('gr_imp', 2, 4)], weight: 2 },
    { groups: [g('wolf', 2, 3)], weight: 1 },
    { groups: [g('skeleton', 4, 6)], weight: 1 },
  ],
};
function roll(z: Formation[], rng: () => number): string[] {
  const tot = z.reduce((s, f) => s + f.weight, 0);
  let r = rng() * tot;
  let f = z[z.length - 1];
  for (const x of z) { r -= x.weight; if (r < 0) { f = x; break; } }
  const out: string[] = [];
  for (const gr of f.groups) { const n = gr.min + Math.floor(rng() * (gr.max - gr.min + 1)); for (let i = 0; i < n; i++) out.push(gr.id); }
  return out.length ? out.slice(0, 9) : [f.groups[0].id];
}
function levelFor(xp: number) { let L = 1; while (L + 1 < XP_TO.length && xp >= XP_TO[L + 1]) L++; return L; }

const COMP = ['warrior', 'thief', 'white_mage', 'black_mage'];
const KIT: Record<string, string[]> = { warrior: ['rapier', 'leather_armor', 'wooden_shield'], thief: ['rapier', 'leather_armor'], white_mage: ['hammer', 'cloth'], black_mage: ['small_knife', 'cloth'] };
const SP: Record<string, string[]> = { white_mage: ['cure'], black_mage: ['fire'] };
// shopping list in order, bought when affordable after an inn visit
const SHOP: Array<{ who: string; item?: string; spell?: string; price: number; replaces?: string }> = [
  { who: 'black_mage', spell: 'lit', price: 100 }, { who: 'warrior', item: 'cap', price: 10 }, { who: 'thief', item: 'cap', price: 10 },
  { who: 'white_mage', item: 'cap', price: 10 }, { who: 'black_mage', item: 'cap', price: 10 },
  { who: 'warrior', item: 'chain_mail', price: 80, replaces: 'leather_armor' }, { who: 'black_mage', spell: 'slep', price: 100 },
  { who: 'white_mage', spell: 'ruse', price: 100 },
];

interface M { cls: string; xp: number; gear: string[]; spells: string[]; c: Character }
function rebuild(m: M, i: number) {
  const L = levelFor(m.xp);
  const old = m.c;
  const c = makeChar({ cls: m.cls, level: L, gear: m.gear, spells: m.spells }, i, true);
  // keep current HP (+ the max-HP gain) and spent charges
  c.currentHp = old ? Math.min(c.maxHp, old.currentHp + (c.maxHp - old.maxHp)) : c.maxHp;
  if (old) for (let l = 1; l <= 3; l++) c.setSpellCharges(l, Math.min(c.getSpellCharges(l), old.getSpellCharges(l) + (c.getSpellCharges(l) - (old.level === L ? c.getSpellCharges(l) : maxCh(m.cls, old.level, l)))));
  m.c = c;
}
const maxCh = (cls: string, L: number, l: number) => (CHARGES[cls] ? CHARGES[cls][Math.min(L, CHARGES[cls].length) - 1][l - 1] ?? 0 : 0);

function campaign(seed: number, schedule: Array<[string, number]>) {
  const rng = mulberry32(seed);
  const ms: M[] = COMP.map((cls) => ({ cls, xp: 0, gear: [...KIT[cls]], spells: [...(SP[cls] ?? [])], c: undefined as unknown as Character }));
  ms.forEach((m, i) => rebuild(m, i));
  let gold = 400 - 370, shopIdx = 0, inns = 0, wipes = 0, battles = 0;
  const log: Record<string, { n: number; won: number; xp: number; gold: number }> = {};
  const reachedAt: Record<number, number> = {};
  const inn = () => {
    inns++; gold -= Math.min(gold, 30);
    ms.forEach((m, i) => { rebuild(m, i); m.c.currentHp = m.c.maxHp; for (let l = 1; l <= 3; l++) m.c.setSpellCharges(l, maxCh(m.cls, m.c.level, l)); });
    while (shopIdx < SHOP.length && gold >= SHOP[shopIdx].price) {
      const s = SHOP[shopIdx++]; const m = ms.find((x) => x.cls === s.who)!; gold -= s.price;
      if (s.item) { if (s.replaces) m.gear = m.gear.filter((x) => x !== s.replaces); m.gear.push(s.item); }
      if (s.spell) m.spells.push(s.spell);
      const i = ms.indexOf(m); const hp = m.c.currentHp; rebuild(m, i); m.c.currentHp = hp; for (let l = 1; l <= 3; l++) m.c.setSpellCharges(l, maxCh(m.cls, m.c.level, l));
    }
  };
  for (const [zone, count] of schedule) {
    log[zone] ??= { n: 0, won: 0, xp: 0, gold: 0 };
    for (let b = 0; b < count; b++) {
      const ids = roll(ZONES[zone], rng);
      const party = ms.map((m) => m.c);
      const r = runBattle(party, ids.map((id) => structuredClone(ENEMIES[id])), 'sensible', rng, true, { n: 0 });
      battles++; log[zone].n++;
      if (r.outcome === 'victory') {
        log[zone].won++;
        const living = ms.filter((m) => m.c.currentHp > 0);
        const xp = ids.reduce((s, id) => s + ENEMIES[id].xpReward, 0);
        const gd = ids.reduce((s, id) => s + ENEMIES[id].goldReward, 0);
        const share = Math.floor(xp / living.length);
        log[zone].xp += share; log[zone].gold += gd; gold += gd;
        living.forEach((m) => { m.xp += share; });
        ms.forEach((m, i) => { if (levelFor(m.xp) !== m.c.level) rebuild(m, i); });
        const minL = Math.min(...ms.map((m) => levelFor(m.xp)));
        for (let L = 2; L <= minL; L++) reachedAt[L] ??= battles;
      } else { wipes++; gold = Math.floor(gold / 2); inn(); continue; }
      const p = ms.map((m) => m.c);
      const low = p.some((c) => c.currentHp <= 0) || p.reduce((s, c) => s + c.currentHp, 0) < 0.45 * p.reduce((s, c) => s + c.maxHp, 0)
        || (p[2].getSpellCharges(1) === 0 && p.some((c) => c.currentHp < 0.5 * c.maxHp));
      if (low) inn();
    }
  }
  return { levels: ms.map((m) => levelFor(m.xp)), gold, inns, wipes, battles, log, reachedAt, shopped: shopIdx };
}

test('field campaign', () => {
  const schedule: Array<[string, number]> = [['fields', 20], ['approach', 10], ['temple', 10]];
  const N = 400;
  const agg = { L2: [] as number[], L3: [] as number[], L4: [] as number[], wipes: 0, inns: 0, gold: 0, lv: [0, 0, 0, 0], shopped: 0 };
  const zoneAgg: Record<string, { n: number; won: number; xp: number; gold: number }> = {};
  for (let s = 1; s <= N; s++) {
    const r = campaign(s, schedule);
    for (const L of [2, 3, 4]) if (r.reachedAt[L]) (agg as any)['L' + L].push(r.reachedAt[L]);
    agg.wipes += r.wipes; agg.inns += r.inns; agg.gold += r.gold; agg.shopped += r.shopped;
    r.levels.forEach((l, i) => (agg.lv[i] += l));
    for (const [z, v] of Object.entries(r.log)) { zoneAgg[z] ??= { n: 0, won: 0, xp: 0, gold: 0 }; for (const k of ['n', 'won', 'xp', 'gold'] as const) zoneAgg[z][k] += v[k]; }
  }
  const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  console.log(`campaign ${schedule.map((s) => s.join(':')).join(' ')} x${N}`);
  console.log(`whole party reaches L2 at battle ${med(agg.L2)} (${agg.L2.length}/${N}), L3 at ${med(agg.L3)} (${agg.L3.length}/${N}), L4 at ${med(agg.L4)} (${agg.L4.length}/${N})`);
  console.log(`after 40 battles: avg levels ${agg.lv.map((l) => (l / N).toFixed(2)).join(' ')}, wipes/run ${(agg.wipes / N).toFixed(2)}, inns/run ${(agg.inns / N).toFixed(1)}, gold left ${(agg.gold / N).toFixed(0)}, shop items bought ${(agg.shopped / N).toFixed(1)}/8`);
  for (const [z, v] of Object.entries(zoneAgg)) console.log(`  ${z}: win ${(100 * v.won / v.n).toFixed(1)}%, xp/member/battle ${(v.xp / v.won).toFixed(1)}, gold/battle ${(v.gold / v.won).toFixed(1)}`);
  // per-formation check at fixed levels
  for (const zone of Object.keys(ZONES)) for (const L of [1, 2, 3]) {
    let won = 0, lost = 0, rounds = 0, deadAny = 0; const n = 1000;
    for (let s = 1; s <= n; s++) {
      const rng = mulberry32(s * 31 + L);
      const party = COMP.map((cls, i) => makeChar({ cls, level: L, gear: KIT[cls], spells: SP[cls] ?? [] }, i, true));
      const ids = roll(ZONES[zone], rng);
      const before = party.reduce((a, c) => a + c.maxHp, 0);
      const r = runBattle(party, ids.map((id) => structuredClone(ENEMIES[id])), 'careless', rng, true);
      if (r.outcome === 'victory') won++;
      lost += 1 - party.reduce((a, c) => a + Math.max(0, c.currentHp), 0) / before; rounds += r.rounds;
      deadAny += party.some((c) => c.currentHp <= 0) ? 1 : 0;
    }
    console.log(`  fresh L${L} start kit, fight-only vs ${zone}: win ${(100 * won / n).toFixed(1)}%, party HP lost/battle ${(100 * lost / n).toFixed(1)}%, someone down ${(100 * deadAny / n).toFixed(1)}%, rounds ${(rounds / n).toFixed(1)}`);
  }
}, 600000);
