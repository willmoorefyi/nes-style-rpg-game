/**
 * Proofs (d) bands with (d3) gold prices, (e) no early shops and (f) price walls (docs/WORLD_PLAN.md 6.0,
 * docs/QUEST_PLAN.md 5.2 (d), (e)) on the late_clean fixture, each failing on its RED variant; the curve model's
 * pieces; the constants copied from the game; and the same proofs on the repository.
 */
import { describe, expect, it } from 'vitest';
import { SPELL_PRICE_BY_LEVEL } from '../../src/systems/SpellPurchase.js';
import { STARTING_GOLD } from '../../src/entities/PartyManager.js';
import type { MapNPC } from '../../src/types/index.js';
import type { ProofResult } from '../../src/progression/questTypes.js';
import { buildQuestWorld, loadQuestWorld } from '../../src/progression/questData.js';
import { createQuestContext } from '../../src/progression/questProofs.js';
import {
  attachLate, buildLateData, kitPrice, loadLateData, SPELL_PRICES, START_GOLD, type LateInput,
} from '../../src/progression/questLateData.js';
import { curveOf, encounterAt, fractionalLevel, tableRewards } from '../../src/progression/questCurve.js';
import { proofBands, runLateProofs } from '../../src/progression/questProofsLate.js';
import { proofEarlyShops, proofPriceWalls, walled } from '../../src/progression/questShops.js';
import { fixtureInput } from '../fixtures/quest/loadFixture.js';

const LATE: LateInput = {
  enemies: [{ id: 'goblin', xpReward: 6, goldReward: 50 }, { id: 'ogre', xpReward: 40, goldReward: 100 }],
  items: [{ id: 'sword', price: 100 }, { id: 'great_sword', price: 1800 }],
  kits: { k_low: { warrior: { gear: ['sword'], spells: [] } }, k_high: { warrior: { gear: ['great_sword'], spells: [] } } },
  travelRows: [],
};

type Input = ReturnType<typeof fixtureInput>;
type Obj = Record<string, unknown>;

function ctxOf(edit?: (i: Input) => void, late: LateInput = LATE): ReturnType<typeof createQuestContext> {
  const input = fixtureInput('late_clean');
  edit?.(input);
  return attachLate(createQuestContext(buildQuestWorld(input)), buildLateData(late));
}

const stage = (i: Input, id: string): Obj => ((i.quest as Obj).stages as Obj[]).find((s) => s.id === id)!;
const npc = (i: Input, map: string, id: string): MapNPC => i.maps.find((m) => m.id === map)!.npcs.find((n) => n.id === id)!;
const msgs = (r: ProofResult): string[] => r.failures.map((f) => f.message);

describe('questLate: the constants mirror the game', () => {
  it('spell prices and the starting gold', () => {
    expect(SPELL_PRICES).toEqual(SPELL_PRICE_BY_LEVEL);
    expect(START_GOLD).toBe(STARTING_GOLD);
  });

  it('kitPrice is W1-F\'s 4-member (W / T / WM / BM) figure: w_s1 520, w_pravoka 1725', () => {
    const data = loadLateData();
    expect(kitPrice(data, 'w_s1')).toBe(520);
    expect(kitPrice(data, 'w_pravoka')).toBe(1725);
    expect(kitPrice(data, 'no_such_kit')).toBeNull();
  });
});

describe('questLate: the curve model', () => {
  it('expected rewards, zones by mode, fractional levels', () => {
    const data = buildLateData(LATE);
    expect(tableRewards(data, [{ weight: 1, groups: [{ id: 'goblin', min: 1, max: 3 }] }, { weight: 1, enemies: ['ogre'] }]))
      .toEqual({ xp: (12 + 40) / 2, gold: (100 + 100) / 2 });
    const map = buildQuestWorld(fixtureInput('late_clean')).maps.get('overworld')!;
    expect(encounterAt(map, 3, 1, 'walking')?.rate).toEqual({ min: 4, max: 4 });
    expect(encounterAt(map, 3, 1, 'ship')).toBeNull();
    expect(fractionalLevel(0)).toBe(1);
    expect(fractionalLevel(40)).toBe(2);
    expect(fractionalLevel(118)).toBeCloseTo(2.5, 5);
  });

  it('walks the witness: 2 goblin fights to the ogre, the trader\'s price, the outpost\'s first gold', () => {
    const c = curveOf(ctxOf());
    expect(c.points.get('S1')).toMatchObject({ at: 'boss', boss: 'ogre', fights: 2 });
    expect(c.takeGold).toEqual([{ id: 'cave:trade:trader', price: 100, stage: 'S1' }]);
    expect(c.townFirstGold.get('outpost')).toBe(400);
    expect(c.stageStartGold.get('S2')).toBeGreaterThanOrEqual(900);
  });
});

describe('questLate: each proof passes clean and fails on its RED variant', () => {
  it('clean: (d), (e), (f) OK', () => {
    const [d, e, f] = runLateProofs(ctxOf(), new Set(['d', 'e', 'f']));
    expect([d, e, f].flatMap(msgs)).toEqual([]);
    expect(d.line).toMatch(/^\(d\) bands: OK {2}ogre L1\.\d \[1,2\] {2}\(4 pending\) {2}prices: OK \(1 takeGold\)$/);
    expect(e.line).toBe('(e) early shops: OK  (2 towns)');
    expect(f.line).toBe('(f) price walls: OK  outpost 400/1800');
  });

  it('(d) RED band: the ogre at L1 outside [5, 9]', () => {
    expect(msgs(proofBands(ctxOf((i) => { stage(i, 'S1').band = [5, 9]; })))).toEqual([expect.stringMatching(/^BAND S1 ogre L1\.\d outside \[5,9\]$/)]);
  });

  it('(d) RED grind: a stage cannot declare its way into its band (the schema refuses it too)', () => {
    expect(() => ctxOf((i) => { stage(i, 'S2').grind = 4; })).toThrow(/grind: expected 1.0-3.0/);
    const ctx = ctxOf();
    ctx.world.stages.get('S2')!.grind = 4;
    expect(msgs(proofBands(ctx))).toEqual(['BAND S2 grind 4 outside [1.0, 3.0]']);
  });

  it('(d) RED gold: the outpost\'s band stage starts below half its kit\'s price', () => {
    const late = { ...LATE, items: [{ id: 'sword', price: 100 }, { id: 'great_sword', price: 2400 }] };
    expect(msgs(proofBands(ctxOf(undefined, late)))).toEqual([expect.stringMatching(/^BAND outpost gold \d+ at S2 below 50 % of 2400$/)]);
  });

  it('(d3) RED price: the trader asks more than 80 % of the gold at S1\'s start', () => {
    expect(msgs(proofBands(ctxOf((i) => { npc(i, 'cave', 'trader').takeGold = 500; }))))
      .toContain('BAND cave:trade:trader price 500 above 80 % of 400 at S1');
  });

  it('(e) RED early: the outpost\'s door before the key\'s gate', () => {
    const r = proofEarlyShops(ctxOf((i) => {
      const ow = i.maps.find((m) => m.id === 'overworld')!;
      ow.collision[2 * ow.width + 8] = 1;
      ow.collision[2 * ow.width + 4] = 0;
      ow.transitions = [...ow.transitions.filter((t) => t.targetMap !== 'outpost'), { x: 4, y: 2, targetMap: 'outpost', targetEntrance: 'gate' }];
    }));
    expect(msgs(r)).toEqual(['EARLY outpost talkable before S0']);
    expect(r.failures[0].path).not.toContain('cave:battle:boss:3,1');
  });

  it('(e) RED shopless: a town whose keeper is never talkable', () => {
    const r = proofEarlyShops(ctxOf((i) => {
      const op = i.maps.find((m) => m.id === 'outpost')!;
      op.transitions = [];
      const ow = i.maps.find((m) => m.id === 'overworld')!;
      ow.transitions = ow.transitions.filter((t) => t.targetMap !== 'outpost');
    }));
    expect(msgs(r)).toEqual(['SHOPLESS outpost no keeper is ever talkable']);
  });

  it('(f) RED wall: a cheaper kit leaves the outpost open to an S1 party', () => {
    const late = { ...LATE, items: [{ id: 'sword', price: 100 }, { id: 'great_sword', price: 900 }] };
    const ctx = ctxOf(undefined, late);
    expect(walled(ctx, ctx.world.quest.towns[1])).toBe(true);
    expect(msgs(proofPriceWalls(ctx))).toEqual(['PRICEWALL outpost 400 vs 900']);
  });
});

describe('questLate: the repository', () => {
  const ctx = createQuestContext(loadQuestWorld());
  const late = runLateProofs(ctx, new Set(['d', 'e', 'f']));

  it('(d) Garland in his band; (e) and (f) wait for the towns', () => {
    for (const p of late) expect(p.failures, p.line).toEqual([]);
    expect(late[0].line).toMatch(/garland L2\.\d \[2,3\]/);
    const built = ctx.world.quest.towns.filter((t) => t.status === 'built').length;     // 0 at W1; WND-O: lufenia
    expect(late[1].line).toBe(`(e) early shops: OK  (${built} towns, ${8 - built} pending)`);
  });

  it('the price walls are exactly crescent and gaia (WORLD 3.5)', () => {
    expect(ctx.world.quest.towns.filter((t) => walled(ctx, t)).map((t) => t.id)).toEqual(['crescent', 'gaia']);
    // each wall reads `pending` until the stages before its town are built, then `<gold>/<price>` (FIR-T merge)
    expect(late[2].line).toMatch(/^\(f\) price walls: OK {2}crescent (pending|\d+\/\d+) {2}gaia (pending|\d+\/\d+)$/);
  });
});
