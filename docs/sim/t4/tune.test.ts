import { test } from 'vitest';
import { installNewModel, makeChar, runBattle, mulberry32, ENEMIES, type Policy } from './model.ts';

installNewModel();

const START: Record<string, string[]> = {
  warrior: ['rapier', 'leather_armor', 'wooden_shield'], thief: ['rapier', 'leather_armor'],
  monk: ['wooden_nunchaku', 'cloth'], white_mage: ['hammer', 'cloth'], black_mage: ['small_knife', 'cloth'], red_mage: ['rapier', 'cloth'],
};
const FULL: Record<string, string[]> = {
  warrior: ['rapier', 'chain_mail', 'wooden_shield', 'cap'], thief: ['rapier', 'leather_armor', 'cap'],
  monk: ['wooden_nunchaku', 'leather_armor', 'cap'], white_mage: ['hammer', 'cloth', 'cap'], black_mage: ['small_knife', 'cloth', 'cap'],
  red_mage: ['rapier', 'leather_armor', 'cap'],
};
const SP_START: Record<string, string[]> = { white_mage: ['cure'], black_mage: ['fire'], red_mage: ['cure'] };
const SP_FULL: Record<string, string[]> = { white_mage: ['cure', 'ruse'], black_mage: ['fire', 'lit', 'slep'], red_mage: ['cure', 'fire'] };
const COMPS: Record<string, string[]> = {
  WTWB: ['warrior', 'thief', 'white_mage', 'black_mage'],
  WMoWB: ['warrior', 'monk', 'white_mage', 'black_mage'],
  WMoRW: ['warrior', 'monk', 'red_mage', 'white_mage'],
  WTRB: ['warrior', 'thief', 'red_mage', 'black_mage'],
};

function trial(g: any, comp: string[], level: number, gear: 'start' | 'full', policy: Policy, potions: number, n = 1500) {
  let wins = 0, rounds = 0;
  for (let s = 1; s <= n; s++) {
    const rng = mulberry32(s * 7919 + level);
    const party = comp.map((cls, i) => makeChar({ cls, level, gear: (gear === 'start' ? START : FULL)[cls],
      spells: policy === 'careless' ? [] : ((gear === 'full' ? SP_FULL : SP_START)[cls] ?? []) }, i, true));
    const r = runBattle(party, [structuredClone(g)], policy, rng, true, { n: potions });
    if (r.outcome === 'victory') wins++;
    rounds += r.rounds;
  }
  return `${(100 * wins / n).toFixed(0).padStart(3)}% (${(rounds / n).toFixed(1)}r)`;
}

const VARIANTS: Array<[string, any]> = [
  ['240/16 2h', { hp: 240, attack: 16, hits: 2 }],
  ['220/16 2h', { hp: 220, attack: 16, hits: 2 }],
  ['220/17 2h', { hp: 220, attack: 17, hits: 2 }],
  ['260/16 2h', { hp: 260, attack: 16, hits: 2 }],
  ['240/18 1h>2h@50', { hp: 240, attack: 18, hits: 1, hitsLow: 2 }],
  ['260/18 1h>2h@50', { hp: 260, attack: 18, hits: 1, hitsLow: 2 }],
  ['280/18 1h>2h@50', { hp: 280, attack: 18, hits: 1, hitsLow: 2 }],
];

test('tune garland', () => {
  const out: string[] = [];
  for (const [label, v] of VARIANTS) {
    const g = structuredClone(ENEMIES.garland) as any;
    if (v.hp) g.stats.hp = v.hp;
    if (v.attack) g.stats.attack = v.attack;
    if (v.accuracy) g.accuracy = v.accuracy;
    if (v.hits) g.hits = v.hits; if (v.hitsLow) g.hitsLow = v.hitsLow;
    for (const [cn, comp] of Object.entries(COMPS)) {
      const cells: string[] = [];
      for (const L of [1, 2, 3]) {
        cells.push(`L${L} care ${trial(g, comp, L, 'start', 'careless', 0)} careF ${trial(g, comp, L, 'full', 'careless', 0)} sensS ${trial(g, comp, L, 'start', 'sensible', 0)} sensF ${trial(g, comp, L, 'full', 'sensible', 3)} slp ${trial(g, comp, L, 'full', 'sleep', 3)}`);
      }
      out.push(`${label.padEnd(14)} ${cn.padEnd(6)} | ${cells.join(' | ')}`);
    }
  }
  console.log(out.join('\n'));
}, 600000);
