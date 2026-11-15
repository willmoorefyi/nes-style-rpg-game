/**
 * E1 (docs/ENEMY_ANIM_ISSUES.md, revision 8): `nextActorLosesTurn` is a pure lookahead of the start-of-turn tick, so the
 * battle scene can skip an enemy's wind-up and lunge when its turn is certain to be lost. It consumes no RNG and
 * changes no state; its answer always matches what `executeNextAction` then does.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import type { StatusEffect } from '../../src/battle/StatusEffects.js';
import type { EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import { loadRealRegistries } from '../helpers/realData.js';
import { enemyCopy, SPELLS } from '../helpers/balanceData.js';

beforeAll(async () => { await loadRealRegistries(); });

/** A goblin that acts before the lone fighter; `prep` sets its status and HP. RNG calls are counted. */
function goblinFirst(prep: (goblin: EnemyInstance) => void) {
  const hero = new Character({ name: 'HERO', classData: ClassRegistry.getClass('warrior')! });
  hero.stats.agility = 0;
  const goblin = enemyCopy('goblin');
  goblin.stats.agility = 99;
  let rolls = 0;
  const bsm = new BattleStateMachine({ party: [hero], enemies: [goblin], spells: SPELLS }, () => { rolls++; return 0.99; });
  bsm.startBattle();
  bsm.advanceFromIntro();
  bsm.submitCommand({ type: 'item', actorId: 'party_0' });
  bsm.prepareRound();
  prep(bsm.allEnemies[0]);
  expect(bsm.peekNextAction()?.actorId).toBe('enemy_0');
  return { bsm, goblin: bsm.allEnemies[0], rolls: () => rolls };
}

const withStatus = (effect: StatusEffect, turns = Infinity) => goblinFirst((g) => g.status.apply(effect, turns));

describe('E1: nextActorLosesTurn', () => {
  it.each(['sleep', 'stun', 'stone'] as const)('%s: the turn is lost, and executeNextAction agrees', (effect) => {
    const { bsm, rolls } = withStatus(effect);
    const before = rolls();
    expect(bsm.nextActorLosesTurn()).toBe(true);
    expect(rolls()).toBe(before);                         // no RNG consumed
    const r = bsm.executeNextAction();
    expect(r.messages.map(m => m.text)).toEqual([expect.stringMatching(/ is (asleep|stunned)!$/)]);  // no attack
  });

  it('sleep with 1 turn left still skips (skipTurn is decided before the status expires)', () => {
    const { bsm, goblin } = withStatus('sleep', 1);
    expect(bsm.nextActorLosesTurn()).toBe(true);
    bsm.executeNextAction();
    expect(goblin.status.has('sleep')).toBe(false);
  });

  it('lethal poison (enemy max HP from data.stats.hp): not lost (re-test A), the goblin acts and then falls to it', () => {
    const { bsm, goblin } = goblinFirst((g) => {
      g.status.apply('poison');
      g.data.stats.hp = 100;                              // 5 poison damage per tick
      g.currentHp = 5;
    });
    expect(bsm.nextActorLosesTurn()).toBe(false);
    const texts = bsm.executeNextAction().messages.map((m) => m.text);
    expect(texts.slice(-2)).toEqual([expect.stringMatching(/ takes 5 poison damage!$/), expect.stringMatching(/ defeated!$/)]);
    expect(texts.length).toBeGreaterThan(2);              // the goblin's own action came first
    expect(goblin.currentHp).toBe(0);
  });

  it('non-lethal poison: the goblin still acts', () => {
    const { bsm } = goblinFirst((g) => { g.status.apply('poison'); g.data.stats.hp = 100; g.currentHp = 6; });
    expect(bsm.nextActorLosesTurn()).toBe(false);
  });

  it('poison that deals 0 damage (max HP < 20) never counts as lethal', () => {
    const { bsm } = goblinFirst((g) => { g.status.apply('poison'); g.data.stats.hp = 19; g.currentHp = 1; });
    expect(bsm.nextActorLosesTurn()).toBe(false);
  });

  it.each(['blind', 'silence', 'fear'] as const)('%s: not a certain loss, so the enemy still lunges (O1: fear too)', (effect) => {
    const { bsm, rolls } = withStatus(effect);
    const before = rolls();
    expect(bsm.nextActorLosesTurn()).toBe(false);
    expect(rolls()).toBe(before);
  });

  it('a party member asleep counts too (char.maxHp), and an empty queue is false', () => {
    const hero = new Character({ name: 'HERO', classData: ClassRegistry.getClass('warrior')! });
    hero.stats.agility = 99;
    hero.statusTracker.apply('sleep');
    const goblin = enemyCopy('goblin');
    goblin.stats.agility = 0;
    const bsm = new BattleStateMachine({ party: [hero], enemies: [goblin], spells: SPELLS }, () => 0.99);
    bsm.startBattle();
    bsm.advanceFromIntro();
    bsm.submitCommand({ type: 'item', actorId: 'party_0' });
    bsm.prepareRound();
    expect(bsm.peekNextAction()?.actorId).toBe('party_0');
    expect(bsm.nextActorLosesTurn()).toBe(true);
    bsm.skipRemainingActions();
    expect(bsm.nextActorLosesTurn()).toBe(false);
  });
});
