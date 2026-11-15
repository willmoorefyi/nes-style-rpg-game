/**
 * Final play test, pass F item 2: a poisoned actor's tick line ("THF takes 4 poison damage!") came between the
 * view's announcement ("THF attacks Goblin!") and the attack's result, and split HEAL's result lines. The tick's lines
 * now follow the action's own result lines; a lost turn (lethal poison, sleep) still shows only the tick's lines.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { loadRealRegistries } from '../helpers/realData.js';
import { enemyCopy, SPELLS } from '../helpers/balanceData.js';

beforeAll(async () => { await loadRealRegistries(); });

const POISON = / takes \d+ poison damage!$/;

function hero(name: string, cls: string, agility: number): Character {
  const c = new Character({ name, classData: ClassRegistry.getClass(cls)!, level: 30 });
  c.currentHp = c.maxHp - 50;
  c.stats.agility = agility;
  return c;
}

/** One poisoned hero acts first with `cmd`; the goblin (sturdy, slow) acts after. */
function firstAction(actor: Character, others: Character[], cmd: (id: string) => Parameters<BattleStateMachine['submitCommand']>[0]) {
  actor.statusTracker.apply('poison');
  const goblin = enemyCopy('goblin');
  goblin.stats.hp = 999; goblin.stats.agility = 0;
  const party = [actor, ...others];
  const bsm = new BattleStateMachine({ party, enemies: [goblin], spells: SPELLS }, () => 0.5);
  bsm.startBattle();
  bsm.advanceFromIntro();
  party.forEach((_, i) => bsm.submitCommand(i === 0 ? cmd('party_0') : { type: 'item', actorId: `party_${i}` }));
  bsm.prepareRound();
  expect(bsm.peekNextAction()?.actorId).toBe('party_0');
  return bsm.executeNextAction().messages.map((m) => m.text);
}

describe('pass F play test item 2: status tick lines follow the action result', () => {
  it('a poisoned Thief attacks: the hit line comes first, the poison line last', () => {
    const texts = firstAction(hero('THF', 'thief', 99), [], (id) => ({ type: 'fight', actorId: id, targetId: 'enemy_0' }));
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(texts[0]).toMatch(/^THF /);
    expect(texts[0]).not.toMatch(POISON);
    expect(texts[texts.length - 1]).toMatch(POISON);
  });

  it('a poisoned White Mage casts HEAL: every result line comes before the poison line', () => {
    const whm = hero('WHM2', 'white_mage', 99);
    whm.learnSpell('heal', 3);
    whm.setSpellCharges(3, 3);
    const mates = [hero('WAR', 'warrior', 1), hero('BLM', 'black_mage', 1)];
    const texts = firstAction(whm, mates, (id) => ({ type: 'magic', actorId: id, spellId: 'heal', targetId: 'party_0' }));
    const poisonAt = texts.findIndex((t) => POISON.test(t));
    expect(poisonAt).toBe(texts.length - 1);
    expect(texts.filter((t) => /HP|recover|heal/i.test(t)).length).toBeGreaterThan(0);
  });

  it('lethal poison: the turn is lost and only the tick lines show', () => {
    const thf = hero('THF', 'thief', 99);
    thf.currentHp = 1;
    const texts = firstAction(thf, [hero('WAR', 'warrior', 1)], (id) => ({ type: 'fight', actorId: id, targetId: 'enemy_0' }));
    expect(texts).toEqual([expect.stringMatching(POISON), 'THF fell!']);
  });
});
