/**
 * Final play test, pass F item 2: a poisoned actor's tick line ("THF takes 4 poison damage!") came between the
 * view's announcement ("THF attacks Goblin!") and the attack's result, and split HEAL's result lines.
 * Re-test A: pass F only moved the lines; the damage was still applied before the action, so a poisoned White Mage
 * at full HP "recovered 9 HP" from HEAL and then "took 9 poison damage", and her HP never changed. Poison now hurts at
 * the END of the turn (FF-style): the action's numbers are real and the poison line and damage follow them. Lethal
 * poison no longer costs the turn: the actor acts, then falls. A lost turn (sleep) shows its line, then the poison.
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

  it('lethal poison: the actor still acts, then the poison line and the fall end the turn', () => {
    const thf = hero('THF', 'thief', 99);
    thf.currentHp = 1;
    const texts = firstAction(thf, [hero('WAR', 'warrior', 1)], (id) => ({ type: 'fight', actorId: id, targetId: 'enemy_0' }));
    expect(texts[0]).toMatch(/^THF /);
    expect(texts.slice(-2)).toEqual([expect.stringMatching(POISON), 'THF fell!']);
    expect(thf.currentHp).toBe(0);
  });
});

describe('re-test A: poison resolves after the action', () => {
  /** The repro: f_spells_white's WHM2, poisoned at full HP, casts HEAL on a party at full HP. */
  function healAtFullHp() {
    const whm = hero('WHM2', 'white_mage', 99);
    whm.currentHp = whm.maxHp;
    whm.learnSpell('heal', 3);
    whm.setSpellCharges(3, 3);
    const mates = [hero('WAR', 'warrior', 1), hero('BLM', 'black_mage', 1)];
    mates.forEach((m) => { m.currentHp = m.maxHp; });
    whm.statusTracker.apply('poison');
    const goblin = enemyCopy('goblin');
    goblin.stats.hp = 999; goblin.stats.agility = 0;
    const party = [whm, ...mates];
    const bsm = new BattleStateMachine({ party, enemies: [goblin], spells: SPELLS }, () => 0.5);
    bsm.startBattle();
    bsm.advanceFromIntro();
    party.forEach((_, i) => bsm.submitCommand(i === 0 ? { type: 'magic', actorId: 'party_0', spellId: 'heal', targetId: 'party_0' } : { type: 'item', actorId: `party_${i}` }));
    bsm.prepareRound();
    return { whm, result: bsm.executeNextAction() };
  }

  it('HEAL at full HP heals nothing, then the poison hurts: the HP really drops by the poison line', () => {
    const { whm, result } = healAtFullHp();
    const texts = result.messages.map((m) => m.text);
    const dmg = Math.floor(whm.maxHp * 0.05);
    expect(texts).not.toContain(expect.stringMatching(/^WHM2 recovers/));
    expect(texts).toContain("WHM2's HP is full!");
    expect(texts[texts.length - 1]).toBe(`WHM2 takes ${dmg} poison damage!`);
    expect(whm.currentHp).toBe(whm.maxHp - dmg);
  });

  it('the view holds the HP until the poison line shows (the result carries the pre-poison HP)', () => {
    const { whm, result } = healAtFullHp();
    const poisonLine = result.messages[result.messages.length - 1];
    expect(result.holds).toEqual([{ line: poisonLine, actorId: 'party_0', hp: whm.maxHp, statuses: ['poison'] }]);
  });

  it('a hurt poisoned healer: HEAL restores real HP, then the poison takes its share', () => {
    const whm = hero('WHM2', 'white_mage', 99);
    whm.learnSpell('heal', 3);
    whm.setSpellCharges(3, 3);
    const start = whm.currentHp; // maxHp - 50
    const texts = firstAction(whm, [], (id) => ({ type: 'magic', actorId: id, spellId: 'heal', targetId: 'party_0' }));
    const healed = Number(texts.find((t) => t.startsWith('WHM2 recovers'))!.match(/(\d+) HP/)![1]);
    const dmg = Math.floor(whm.maxHp * 0.05);
    expect(healed).toBeGreaterThan(0);
    expect(whm.currentHp).toBe(Math.min(whm.maxHp, start + healed) - dmg);
  });

  it('a sleeper that is poisoned: the asleep line, then the poison (the turn is spent either way)', () => {
    const war = hero('WAR', 'warrior', 99);
    war.currentHp = 39; // too low to wake (rand(0..80) = 40 at rng 0.5)
    war.statusTracker.apply('sleep');
    const texts = firstAction(war, [hero('THF', 'thief', 1)], (id) => ({ type: 'fight', actorId: id, targetId: 'enemy_0', skip: true }));
    expect(texts).toEqual(['WAR is asleep!', expect.stringMatching(POISON)]);
    expect(war.currentHp).toBe(39 - Math.floor(war.maxHp * 0.05));
  });
});
