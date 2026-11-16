/**
 * CHAOS_FORMS_PLAN 2.2 item 9 (R9, A4): F3's slam, the one scoped new mechanic. A multi-target physical attack chosen
 * as the AI action `{type: slam, weight}` (its share of the non-spell turns `1 - rate`, alongside Fight); it hits 2
 * different living heroes, each hit rolled with the normal formula, with one damage event per target in target order.
 */
import { describe, it, expect } from 'vitest';
import { BattleStateMachine, type ActionResult } from '../../src/battle/BattleStateMachine.js';
import { dataAiPattern, dataDrivenAI } from '../../src/battle/enemyAiPattern.js';
import { Character } from '../../src/entities/Character.js';
import { validateEnemyData } from '../../src/core/schemaValidation.js';
import type { EnemyData, SpellData } from '../../src/types/index.js';
import { mulberry32, testClass, testEnemy } from '../helpers/testUtils.js';

const SPELLS = [{ id: 'ice', name: 'ICE', level: 2, type: 'black', effect: 'damage', targeting: 'single', power: 20, element: 'ice' }] as SpellData[];
const HORIZON: EnemyData = testEnemy({
  id: 'horizon', name: 'Chaos', sprite: 'chaos', size: 'boss', colossus: 'horizon', slam: { targets: 2 }, attack: 'melee',
  ai: { rate: 0, actions: [{ type: 'slam', weight: 1 }] },
  stats: { hp: 6000, agility: 99, attack: 30, accuracy: 0, hits: 3 },
});

const member = (name: string, hp = 500): Character => {
  const c = new Character({ name, classData: testClass('warrior', { baseStats: { hp, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1 } }) });
  return c;
};

/** Chaos slams first (agility 99); every hero idles. */
function slamRound(party: Character[], rng: () => number, stats: Partial<EnemyData['stats']> = {}): { result: ActionResult; peek: string | undefined } {
  const enemy = { ...HORIZON, stats: { ...HORIZON.stats, ...stats } };
  const bsm = new BattleStateMachine({ party, enemies: [enemy], spells: SPELLS, canRun: false }, rng);
  bsm.setEnemyAI(0, dataDrivenAI(HORIZON.ai!, SPELLS)!);
  bsm.startBattle(); bsm.advanceFromIntro();
  while (bsm.state === 'command_select') bsm.submitCommand({ type: 'item', actorId: bsm.currentCommandActorId! });
  bsm.prepareRound();
  const peek = bsm.peekNextAction()?.actionType;
  return { result: bsm.executeNextAction(), peek };
}

describe('the F3 slam (R9)', () => {
  it('hits 2 distinct living heroes with 2 damage events, in target order, and peekNextAction reports slam', () => {
    const party = [member('A'), member('B'), member('C'), member('D')];
    const { result, peek } = slamRound(party, () => 0.3);
    expect(peek).toBe('slam');
    const ids = result.damageEvents.map((d) => d.targetId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    const lines = result.messages.map((m) => m.text).filter((t) => t.startsWith('Chaos hits '));
    expect(lines.map((t) => t.split(' ')[2])).toEqual(ids.map((id) => party[Number(id.slice(6))].name));
    for (const d of result.damageEvents) expect(d.damage).toBeGreaterThan(0);
  });

  it('1 target and 1 event if only 1 hero lives', () => {
    const party = [member('A'), member('B'), member('C')];
    party[0].currentHp = 0; party[2].currentHp = 0;
    const { result } = slamRound(party, () => 0.3);
    expect(result.damageEvents.map((d) => d.targetId)).toEqual(['party_1']);
  });

  it('a miss rolls per target: over seeds, a slam can hit one hero and miss the other', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const { result } = slamRound([member('A'), member('B')], mulberry32(seed), { accuracy: -80, hits: 1 });
      const hit = result.messages.filter((m) => m.text.startsWith('Chaos hits ')).length;
      const miss = result.messages.filter((m) => m.text.startsWith('Chaos missed ')).length;
      expect(hit + miss).toBe(2);
      expect(result.damageEvents.length).toBe(hit);
      expect(result.missed).toBe(hit === 0);
      outcomes.add(`${hit}/${miss}`);
    }
    expect(outcomes.has('1/1')).toBe(true);
  });

  it('the weight comes from the non-spell share 1 - rate, alongside Fight', () => {
    const p = dataAiPattern({ rate: 0.4, actions: [{ type: 'slam', weight: 0.5 }, { type: 'magic', spellId: 'ice', weight: 1 }] }, SPELLS)!;
    expect(p.actions.map((a) => [a.type, a.spellId, +a.weight.toFixed(6)])).toEqual([['fight', undefined, 0.3], ['slam', undefined, 0.3], ['magic', 'ice', 0.4]]);
    const all = dataAiPattern({ rate: 0, actions: [{ type: 'slam', weight: 1 }] }, SPELLS)!;
    expect(all.actions.map((a) => a.type)).toEqual(['slam']);
    // no slam: unchanged (the existing pin in enemyAiPattern.test.ts)
    expect(dataAiPattern({ rate: 0.5, actions: [{ type: 'magic', spellId: 'ice', weight: 1 }] }, SPELLS)!.actions.map((a) => [a.type, a.weight]))
      .toEqual([['fight', 0.5], ['magic', 0.5]]);
  });

  it('the validator refuses a slam without colossus:, targets other than 2, and a slam action without a slam', () => {
    expect(() => validateEnemyData(HORIZON)).not.toThrow();
    expect(() => validateEnemyData({ ...HORIZON, colossus: undefined })).toThrow(/slam/);
    expect(() => validateEnemyData({ ...HORIZON, slam: { targets: 3 } })).toThrow(/targets/);
    expect(() => validateEnemyData({ ...HORIZON, slam: undefined })).toThrow(/slam/);
    expect(() => validateEnemyData({ ...HORIZON, ai: { rate: 0, actions: [{ type: 'slam', weight: 1.5 }] } })).toThrow(/weight/);
  });
});
