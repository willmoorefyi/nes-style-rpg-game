import { test } from 'vitest';
import { installNewModel, makeChar, runBattle, mulberry32, ENEMIES, stats, type MemberSpec, type Policy } from './model.ts';

installNewModel();

const START: Record<string, MemberSpec['gear']> = {
  warrior: ['rapier', 'leather_armor', 'wooden_shield'], thief: ['rapier', 'leather_armor'],
  monk: ['wooden_nunchaku', 'cloth'], white_mage: ['hammer', 'cloth'], black_mage: ['small_knife', 'cloth'], red_mage: ['rapier', 'cloth'],
};
const FULL: Record<string, MemberSpec['gear']> = {
  warrior: ['rapier', 'chain_mail', 'wooden_shield', 'cap'], thief: ['rapier', 'leather_armor', 'cap'],
  monk: ['wooden_nunchaku', 'leather_armor', 'cap'], white_mage: ['hammer', 'cloth', 'cap'], black_mage: ['small_knife', 'cloth', 'cap'],
  red_mage: ['rapier', 'leather_armor', 'cap'],
};
const SP_START: Record<string, string[]> = { white_mage: ['cure'], black_mage: ['fire'], red_mage: ['cure'] };
const SP_FULL: Record<string, string[]> = { white_mage: ['cure', 'ruse'], black_mage: ['fire', 'lit', 'slep'], red_mage: ['cure', 'fire'] };

const COMPS: Record<string, string[]> = {
  'W T WM BM': ['warrior', 'thief', 'white_mage', 'black_mage'],
  'W Mo WM BM': ['warrior', 'monk', 'white_mage', 'black_mage'],
  'W Mo RM WM': ['warrior', 'monk', 'red_mage', 'white_mage'],
  'WM BM T W (mages front)': ['white_mage', 'black_mage', 'thief', 'warrior'],
};

function trial(comp: string[], level: number, gear: 'start' | 'full' | 'naked', policy: Policy, potions: number, n = 2000) {
  let wins = 0, rounds = 0, deaths = 0;
  stats.sleepTurnsLost = 0; stats.slepCasts = 0; stats.slepHits = 0;
  for (let s = 1; s <= n; s++) {
    const rng = mulberry32(s * 7919);
    const party = comp.map((cls, i) => makeChar({
      cls, level,
      gear: gear === 'naked' ? [] : (gear === 'start' ? START : FULL)[cls],
      spells: policy === 'careless' ? [] : ((gear === 'full' ? SP_FULL : SP_START)[cls] ?? []),
    }, i, true));
    const r = runBattle(party, [structuredClone(ENEMIES.garland)], policy, rng, true, { n: potions });
    if (r.outcome === 'victory') { wins++; deaths += party.filter((c) => c.currentHp <= 0).length; }
    rounds += r.rounds;
  }
  return { win: (100 * wins / n).toFixed(1) + '%', rounds: (rounds / n).toFixed(1), deadPerWin: wins ? (deaths / wins).toFixed(2) : '-',
    sleepLost: (stats.sleepTurnsLost / n).toFixed(2), slepHit: stats.slepCasts ? (100 * stats.slepHits / stats.slepCasts).toFixed(0) + '%' : '-' };
}

test('garland', () => {
  const rows: string[] = [];
  for (const [name, comp] of Object.entries(COMPS)) {
    for (const level of [1, 2, 3, 4]) {
      const cases: Array<[string, 'start' | 'full' | 'naked', Policy, number]> = [
        ['careless start', 'start', 'careless', 0],
        ['careless naked', 'naked', 'careless', 0],
        ['sensible start', 'start', 'sensible', 0],
        ['sensible full+3pot', 'full', 'sensible', 3],
        ['sleep full+3pot', 'full', 'sleep', 3],
      ];
      for (const [label, gear, pol, pots] of cases) {
        const r = trial(comp, level, gear, pol, pots);
        rows.push(`${name.padEnd(24)} L${level} ${label.padEnd(20)} win ${r.win.padStart(6)} rounds ${r.rounds} deadPerWin ${r.deadPerWin} garlandSleepTurns ${r.sleepLost} slepHit ${r.slepHit}`);
      }
    }
  }
  console.log(rows.join('\n'));
}, 600000);
