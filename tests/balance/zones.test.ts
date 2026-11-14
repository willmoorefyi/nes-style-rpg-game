/**
 * T4d formation attrition and spell numbers on the real engine (docs/FIX_PLAN_PENINSULA.md T4 §4.4, §4.5): a fresh
 * Lv1 party with the 400 G kit, Fight only, over the §1.6 tables (inline until T4e); FIRE and CURE in a real battle.
 */
import { describe, it, expect } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { runBattle, mulberry32 } from '../helpers/battlePolicies.js';
import { makeParty, makeMember, rollFormation, enemyCopy, SPELLS, START_KIT, type Zone } from '../helpers/balanceData.js';

const N = 1000;

function freshWinRate(zone: Zone, level: number): number {
  let won = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s * 31 + level);
    const r = runBattle(makeParty(level, 'start', false), rollFormation(zone, rng), SPELLS, 'careless', rng);
    if (r.outcome === 'victory') won++;
  }
  return won / N;
}

describe('T4d formations at Lv1 (fresh 400 G kit, Fight only)', () => {
  it('the fields are won >= 98 % of the time', () => {
    expect(freshWinRate('fields', 1)).toBeGreaterThanOrEqual(0.98);
  });

  it('the temple is won 90-99 % of the time (it can hurt)', () => {
    const rate = freshWinRate('temple', 1);
    expect(rate).toBeGreaterThanOrEqual(0.9);
    expect(rate).toBeLessThanOrEqual(0.99);
  });
});

describe('T4d spells in battle (real data)', () => {
  /** One round in which the Lv1 Black Mage casts `spellId` at enemy 0 or the White Mage cures member 0. */
  function castOnce(seed: number, enemyId: string, spellId: 'fire' | 'cure'): { dealt: number; healed: number } {
    const rng = mulberry32(seed);
    const party = ['warrior', 'thief', 'white_mage', 'black_mage'].map((c, i) => makeMember(c, 1, START_KIT[c], i));
    party[0].currentHp = 1; // the Warrior (35 HP) has room for any CURE
    const enemy = enemyCopy(enemyId);
    enemy.stats.hp = 999; // survives the spell, so the HP lost is the whole damage
    const bsm = new BattleStateMachine({ party, enemies: [enemy], spells: SPELLS, canRun: false }, rng);
    bsm.startBattle();
    bsm.advanceFromIntro();
    bsm.allEnemies[0].status.apply('sleep'); // it loses this round's turn, so only the spell changes any HP
    while (bsm.state === 'command_select') {
      const actorId = bsm.currentCommandActorId!;
      const actor = bsm.currentCommandActor!;
      if (spellId === 'fire' && actor === party[3]) bsm.submitCommand({ type: 'magic', actorId, targetId: 'enemy_0', spellId });
      else if (spellId === 'cure' && actor === party[2]) bsm.submitCommand({ type: 'magic', actorId, targetId: 'party_0', spellId });
      else bsm.submitCommand({ type: 'run', actorId });
    }
    bsm.prepareRound();
    let dealt = 0, healed = 0;
    while (bsm.actionQueueLength > 0 && !bsm.isOver) {
      const next = bsm.peekNextAction();
      const enemyHp = bsm.allEnemies[0].currentHp;
      const memberHp = party[0].currentHp;
      bsm.executeNextAction();
      if (next?.spellName) {
        dealt += enemyHp - bsm.allEnemies[0].currentHp;
        healed += party[0].currentHp - memberHp;
      }
    }
    return { dealt, healed };
  }

  it('a Lv1 Black Mage\'s FIRE does 15-60 to a Goblin (weak to fire), never more (EB-4)', () => {
    const dealt = Array.from({ length: 400 }, (_, i) => castOnce(i + 1, 'goblin', 'fire').dealt);
    expect(Math.max(...dealt)).toBeLessThanOrEqual(60);
    expect(Math.min(...dealt)).toBeGreaterThanOrEqual(15);
  });

  it('CURE heals 16-32 in battle', () => {
    const healed = Array.from({ length: 400 }, (_, i) => castOnce(i + 1, 'goblin', 'cure').healed);
    expect(Math.min(...healed)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...healed)).toBeLessThanOrEqual(32);
    expect(new Set(healed).size).toBeGreaterThan(5); // it varies
  });
});
