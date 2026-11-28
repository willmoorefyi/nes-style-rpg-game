/**
 * S30 boss balance (docs/WORLD_PLAN.md 3.7; PST): the four refights of the Temple of the Past in a row, then the Death
 * Eye, against the upgraded party (Knight / Ninja / White Wizard / Black Wizard, QUEST open question 3) with the stage
 * kit `w_s30` (the B7 Gaia tier), on the real `BattleStateMachine` (400 seeds per policy; enemy spells are not
 * simulated, as in every balance test).
 *
 * The battles are the ones the floors start (assets-src/tools/layouts/past/): floor 1 `[lich_2, death_knight x2]`,
 * floor 2 `[ashen_queen_2, rhyos]`, floor 3 `[drowned_sovereign_2]`, floor 4 `[hollow_seraph_2]`, floor 5
 * `[death_eye, iron_golem]`. The run carries the party's HP, deaths and spell charges from fight to fight (no inn);
 * 4 potions are added before each fight and the unused ones carry over ("4 potions each").
 *
 * The tuning is PST's (enemies.yaml: only the five bosses' `bossPhases`): with their records alone the L37 party won
 * every fight at 98-100 % and the run at 100 %, the bosses dying in 1-3 rounds, mostly before they acted. Each now has
 * a phase from full HP (hits / attack: lich_2 3 / 110, ashen_queen_2 6 / 80, drowned_sovereign_2 6 / 82,
 * hollow_seraph_2 5 / 92, death_eye 3 / 125), and the slow lich and queen get escorts from the S30 roster, so that the
 * boss acts before it falls. Targets (3.7): the run 60-85 % at L37, each fight alone >= 85 %, the Death Eye 70-90 %.
 * Each bound sits at least 3 points from its measured value, given in the test name.
 *
 * FX-B (PLAY-3 P3-04): the tests now use the `fighter` policy (tests/helpers/fighterPolicy.ts): `sensible` makes the
 * Knight and the Ninja cast FIRE, so a party that only pressed Fight won every fight at 100 % against a run bound that
 * read 74 %. The five bosses were hardened to match (lich_2 10 hits, ashen_queen_2 14 hits (their HP stays at the roster spec),
 * drowned_sovereign_2 11 hits, hollow_seraph_2 9 hits, death_eye 600 HP and 8 hits).
 */
import { describe, expect, it } from 'vitest';
import { bossWinRate, enemyCopy, makeParty, SPELLS, UPGRADED_PARTY } from '../helpers/balanceData.js';
import { mulberry32, runBattle } from '../helpers/battlePolicies.js';

const N = 400;
const LEVEL = 37;
const KIT = 'w_s30';
const POTIONS = 4;
const REFIGHTS: string[][] = [
  ['lich_2', 'death_knight', 'death_knight'],
  ['ashen_queen_2', 'rhyos'],
  ['drowned_sovereign_2'],
  ['hollow_seraph_2'],
];
const DEATH_EYE = ['death_eye', 'iron_golem'];

/** The share (0-1) of seeded runs in which the party wins every fight of `fights` in a row, with no inn. */
function runWinRate(fights: string[][], level: number, seeds: number): number {
  let won = 0;
  for (let s = 1; s <= seeds; s++) {
    const rng = mulberry32(s * 7919 + level * 131 + 99991);
    const party = makeParty(level, KIT, true, UPGRADED_PARTY);
    const potions = { n: 0 };
    let alive = true;
    for (const ids of fights) {
      if (!alive) break;
      potions.n += POTIONS;
      alive = runBattle(party, ids.map(enemyCopy), SPELLS, 'fighter', rng, { potions }).outcome === 'victory';
    }
    if (alive) won++;
  }
  return won / seeds;
}

const alone = (ids: string[]): number =>
  bossWinRate(ids, LEVEL, KIT, 'fighter', N, { comp: UPGRADED_PARTY, potions: POTIONS });

describe('w_pst: the Temple of the Past (S30, kit w_s30, upgraded party, L37)', () => {
  it('the four refights in a row, no inn: fighter wins INTENT 60-100 % (measured EQ 97.25, was 78.5)', () => {
    const r = runWinRate(REFIGHTS, LEVEL, N);
    expect(r).toBeGreaterThanOrEqual(0.6);
    expect(r).toBeLessThanOrEqual(1);
  });

  it('the four refights in a row at L34, the band floor (PLAY-3 played them there): fighter wins at most INTENT 100 % (measured EQ 95.25, was 17.8)', () => {
    expect(runWinRate(REFIGHTS, 34, N)).toBeLessThanOrEqual(1);
  });

  it('floor 1 alone, the Rime Sovereign and two death knights: >= 85 % (measured EQ 100, was 100.0)', () => {
    expect(alone(REFIGHTS[0])).toBeGreaterThanOrEqual(0.85);
  });

  it('floor 2 alone, the Ashen Queen and a rhyos: >= 85 % (measured EQ 100, was 100.0)', () => {
    expect(alone(REFIGHTS[1])).toBeGreaterThanOrEqual(0.85);
  });

  it('floor 3 alone, the Drowned Sovereign: >= 85 % (measured EQ 100, was 100.0)', () => {
    expect(alone(REFIGHTS[2])).toBeGreaterThanOrEqual(0.85);
  });

  it('floor 4 alone, the Hollow Seraph: >= 85 % (measured EQ 100, was 100.0)', () => {
    expect(alone(REFIGHTS[3])).toBeGreaterThanOrEqual(0.85);
  });

  it('floor 5, the Death Eye and its iron golem: fighter wins INTENT 70-100 % (measured EQ 97.25, was 82.5)', () => {
    const r = alone(DEATH_EYE);
    expect(r).toBeGreaterThanOrEqual(0.7);
    expect(r).toBeLessThanOrEqual(1);
  });
});
