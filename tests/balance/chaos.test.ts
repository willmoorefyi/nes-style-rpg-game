/**
 * Chaos balance (docs/CHAOS_FIX_PLAN.md 0, 2.5, 2.6; U-2 level 40, U-3 pool 20000, D-C7-19): seeded four-form fights
 * on the real `BattleStateMachine` with the real data, the `chaos_forms` party at level 40 (set in the harness,
 * tests/helpers/chaosBattle.ts), 400 seeds per policy.
 *
 * Bounds are tied to the plan's targets (section 0) and sit at least 3 points (round counts: 2 rounds) from the
 * measured value given in each test name. The invariants are exact.
 *
 * MEASURED is this engine at F2 (C7, B3-20k data of 2.5, pool 20000, TS-B's mechanism M1-M6): identical to the plan's
 * out-of-repo sim (2.3.1). Margins: all >= 2 9.5 / 9.5, in 10-16 9 / 9, median 12 (2 rounds above 10, 3 below 15),
 * win 3.0 to the 99.5 cap (typical) and 5.2 to the 97 cap (aggressive), KO 17.5 / 23.5, F1 >= 1 and command phase 3
 * (ceiling-limited at 100), hit 77 / 68. Re-measure after any Chaos, item or formula change (2.5 re-tune rules). On
 * 7c86057 (pool 6000, no arrival turn, no gated crack) this file was RED: 4 rounds, no form acted twice in every win,
 * and the crack was skipped in 363 / 362 of the runs that reached F4 (2.2).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadRealRegistries } from '../helpers/realData.js';
import { CHAOS_FORMS, chaosParty, chaosSeed, runChaos, type ChaosPolicy, type ChaosRun } from '../helpers/chaosBattle.js';

const N = 400;
const LEVEL = 40;
const POLICIES: ChaosPolicy[] = ['typical', 'aggressive'];

/** 2.1: the level-40 chaos_forms party (KNGT / NINJ / MSTR / WWIZ). */
const PARTY_MAX_HP = [666, 420, 586, 303];
const PARTY_AGILITY = [45, 213, 88, 49];

// Measured on this engine at C7 F2 (400 seeds per policy); equal to the plan's B3-20k sim (2.3.1).
const MEASURED: Record<ChaosPolicy, { all2: number; in10_16: number; median: number; win: number; ko: number;
  f1: number; cmd: number; hit: number }> = {
  typical: { all2: 99.5, in10_16: 100, median: 12, win: 96.5, ko: 87.5, f1: 100, cmd: 100, hit: 577 },
  aggressive: { all2: 99.5, in10_16: 100, median: 12, win: 91.8, ko: 93.5, f1: 100, cmd: 100, hit: 568 },
};
/** Win-rate band per policy (2.5). */
const WIN_BAND: Record<ChaosPolicy, [number, number]> = { typical: [85, 99.5], aggressive: [75, 97] };

interface Summary {
  runs: ChaosRun[]; wins: ChaosRun[]; win: number; in10_16: number; median: number; all2: number;
  ge2: number[]; f1: number; cmd: number[]; ko: number; hit: number;
}

const pct = (part: number, whole: number): number => +(100 * part / Math.max(1, whole)).toFixed(1);
const medianOf = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

function measure(policy: ChaosPolicy, level: number): Summary {
  const runs: ChaosRun[] = [];
  for (let s = 1; s <= N; s++) runs.push(runChaos(chaosSeed(s), policy, level));
  const wins = runs.filter((r) => r.win);
  const ofWins = (f: (r: ChaosRun) => boolean): number => pct(wins.filter(f).length, wins.length);
  const acts = (r: ChaosRun, f: string): number => r.acts.get(f) ?? 0;
  return {
    runs, wins,
    win: pct(wins.length, N),
    in10_16: pct(runs.filter((r) => r.rounds >= 10 && r.rounds <= 16).length, N),
    median: medianOf(runs.map((r) => r.rounds)),
    all2: ofWins((r) => CHAOS_FORMS.every((f) => acts(r, f) >= 2)),
    ge2: CHAOS_FORMS.map((f) => ofWins((r) => acts(r, f) >= 2)),
    f1: ofWins((r) => acts(r, 'chaos') >= 1),
    cmd: CHAOS_FORMS.map((f) => ofWins((r) => (r.cmdPhases.get(f) ?? 0) >= 1)),
    ko: pct(runs.filter((r) => r.kos > 0).length, N),
    hit: medianOf(runs.flatMap((r) => r.heroHits)),
  };
}

const line = (name: string, s: Summary): string => `${name}: win ${s.win} rounds med ${s.median} in10-16 ${s.in10_16}`
  + ` all>=2|win ${s.all2} F1..F4>=2|win ${s.ge2.join('/')} F1>=1 ${s.f1} cmd|win ${s.cmd.join('/')} ko ${s.ko} hit ${s.hit}`;

const results = {} as Record<ChaosPolicy, Summary>;

beforeAll(async () => {
  await loadRealRegistries();
  // the party check comes first and fails loudly (2.6, rev-2 should-fix 8)
  const party = chaosParty(LEVEL);
  const hp = party.map((c) => c.maxHp);
  const agi = party.map((c) => c.stats.agility);
  if (hp.join() !== PARTY_MAX_HP.join() || agi.join() !== PARTY_AGILITY.join()) {
    throw new Error(`chaos_forms party at level ${LEVEL}: max HP ${hp} (want ${PARTY_MAX_HP}), agility ${agi} (want ${PARTY_AGILITY})`);
  }
  for (const p of POLICIES) {
    results[p] = measure(p, LEVEL);
    console.info(line(`chaos L${LEVEL} ${p}`, results[p]));
  }
}, 240_000);

describe('Chaos balance: the level-40 chaos_forms party', () => {
  it('the party is KNGT / NINJ / MSTR / WWIZ with max HP 666 / 420 / 586 / 303 and agility 45 / 213 / 88 / 49', () => {
    const party = chaosParty(LEVEL);
    expect(party.map((c) => c.name)).toEqual(['KNGT', 'NINJ', 'MSTR', 'WWIZ']);
    expect(party.map((c) => c.maxHp)).toEqual(PARTY_MAX_HP);
    expect(party.map((c) => c.stats.agility)).toEqual(PARTY_AGILITY);
  });
});

describe.each(POLICIES)('Chaos balance, %s play (400 seeds, level 40)', (policy) => {
  const m = MEASURED[policy];
  const s = (): Summary => results[policy];

  it(`each form acts >= 2 times in >= 90 % of wins [${m.all2}]`, () => {
    expect(s().all2, line(policy, s())).toBeGreaterThanOrEqual(90);
  });
  it(`rounds in 10-16 in >= 91 % of runs [${m.in10_16}]`, () => {
    expect(s().in10_16, line(policy, s())).toBeGreaterThanOrEqual(91);
  });
  it(`median rounds in [10, 15] [${m.median}]`, () => {
    expect(s().median, line(policy, s())).toBeGreaterThanOrEqual(10);
    expect(s().median, line(policy, s())).toBeLessThanOrEqual(15);
  });
  it(`win rate in [${WIN_BAND[policy].join(', ')}] % [${m.win}]`, () => {
    expect(s().win, line(policy, s())).toBeGreaterThanOrEqual(WIN_BAND[policy][0]);
    expect(s().win, line(policy, s())).toBeLessThanOrEqual(WIN_BAND[policy][1]);
  });
  it(`at least one KO in >= 70 % of runs [${m.ko}]`, () => {
    expect(s().ko, line(policy, s())).toBeGreaterThanOrEqual(70);
  });
  it(`F1 acts >= 1 in >= 97 % of wins [${m.f1}]`, () => {
    expect(s().f1, line(policy, s())).toBeGreaterThanOrEqual(97);
  });
  it(`every form has a command phase in >= 97 % of wins [${m.cmd}]`, () => {
    for (const v of s().cmd) expect(v, line(policy, s())).toBeGreaterThanOrEqual(97);
  });
  it(`median party hit >= 500 (U-3) [${m.hit}]`, () => {
    expect(s().hit, line(policy, s())).toBeGreaterThanOrEqual(500);
  });

  it('invariant: in every run that reaches F4, the crack line comes before the change to F4', () => {
    const reached = s().runs.filter((r) => r.reachedF4);
    expect(reached.length).toBeGreaterThan(0);
    expect(reached.filter((r) => !r.crackBeforeF4).length, 'runs reaching F4 without the crack').toBe(0);
  });
  it('invariant: the forms appear in chain order, each at most once (all four in every win)', () => {
    for (const r of s().runs) {
      expect(r.formOrder).toEqual(CHAOS_FORMS.slice(0, r.formOrder.length));
      if (r.win) expect(r.formOrder).toEqual([...CHAOS_FORMS]);
    }
  });
});

describe('Chaos level cliff (report only, not pinned)', () => {
  it('reports levels 35, 38, 42 and 45', () => {
    for (const level of [35, 38, 42, 45]) {
      for (const p of POLICIES) console.info(line(`chaos L${level} ${p}`, measure(p, level)));
    }
  }, 240_000);
});
