import { test } from 'vitest';
import { installNewModel, makeChar, runBattle, mulberry32, ENEMIES, type Policy } from './model.ts';
installNewModel();
const g = (id: string, min: number, max = min) => ({ id, min, max });
const TEMPLE = [
  { groups: [g('skeleton', 2, 4)], weight: 4 }, { groups: [g('skeleton', 1, 3), g('gr_imp', 1, 2)], weight: 3 },
  { groups: [g('gr_imp', 2, 4)], weight: 2 }, { groups: [g('wolf', 2, 3)], weight: 1 }, { groups: [g('skeleton', 4, 6)], weight: 1 },
];
function roll(rng: () => number) {
  const tot = TEMPLE.reduce((s, f) => s + f.weight, 0); let r = rng() * tot; let f = TEMPLE[0];
  for (const x of TEMPLE) { r -= x.weight; if (r < 0) { f = x; break; } }
  const out: string[] = []; for (const gr of f.groups) { const n = gr.min + Math.floor(rng() * (gr.max - gr.min + 1)); for (let i = 0; i < n; i++) out.push(gr.id); } return out;
}
const FULL: Record<string, string[]> = { warrior: ['rapier', 'chain_mail', 'wooden_shield', 'cap'], thief: ['rapier', 'leather_armor', 'cap'], white_mage: ['hammer', 'cloth', 'cap'], black_mage: ['small_knife', 'cloth', 'cap'] };
const START: Record<string, string[]> = { warrior: ['rapier', 'leather_armor', 'wooden_shield'], thief: ['rapier', 'leather_armor'], white_mage: ['hammer', 'cloth'], black_mage: ['small_knife', 'cloth'] };
const SPF: Record<string, string[]> = { white_mage: ['cure', 'ruse'], black_mage: ['fire', 'lit', 'slep'] };
const SPS: Record<string, string[]> = { white_mage: ['cure'], black_mage: ['fire'] };
const GARLAND = { ...structuredClone(ENEMIES.garland), stats: { ...ENEMIES.garland.stats, hp: 240, attack: 16 }, hits: 2 };
function go(L: number, kit: 'full' | 'start', pol: Policy, pots: number, pre: number, n = 2000) {
  let w = 0, reach = 0;
  for (let s = 1; s <= n; s++) {
    const rng = mulberry32(s * 101 + L * 7 + pre);
    const comp = ['warrior', 'thief', 'white_mage', 'black_mage'];
    const party = comp.map((cls, i) => makeChar({ cls, level: L, gear: (kit === 'full' ? FULL : START)[cls], spells: pol === 'careless' ? [] : (kit === 'full' ? SPF : SPS)[cls] ?? [] }, i, true));
    const potions = { n: pots }; let dead = false;
    for (let b = 0; b < pre; b++) { const r = runBattle(party, roll(rng).map((id) => structuredClone(ENEMIES[id])), pol === 'careless' ? 'careless' : 'sensible', rng, true, potions); if (r.outcome !== 'victory') { dead = true; break; } }
    if (dead) continue; reach++;
    if (runBattle(party, [structuredClone(GARLAND) as any], pol, rng, true, potions).outcome === 'victory') w++;
  }
  return `${(100 * w / n).toFixed(0)}% (reach ${(100 * reach / n).toFixed(0)}%)`;
}
test('temple run then Garland (240/16/2 hits)', () => {
  for (const pre of [0, 2, 3]) for (const L of [2, 3, 4])
    console.log(`pre ${pre} L${L}: careless start ${go(L, 'start', 'careless', 0, pre)} | sensible start ${go(L, 'start', 'sensible', 0, pre)} | sensible full+3pot ${go(L, 'full', 'sensible', 3, pre)} | sleep full+3pot ${go(L, 'full', 'sleep', 3, pre)}`);
}, 600000);
