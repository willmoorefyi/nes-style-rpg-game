/**
 * Final play test, pass F item 3: a sleeping (or stunned / stoned, or about to die of poison) hero got the command
 * menu and then did nothing. Such a member now gets no menu (`losesTurn`); a `skip` command keeps their place in the
 * turn order, where the tick shows "WAR is asleep!" as FF does. Undo steps back over skipped members.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import type { StatusEffect } from '../../src/battle/StatusEffects.js';
import { loadRealRegistries } from '../helpers/realData.js';
import { enemyCopy, SPELLS } from '../helpers/balanceData.js';

beforeAll(async () => { await loadRealRegistries(); });

function battle(statuses: Array<StatusEffect | null>) {
  const party = statuses.map((st, i) => {
    const c = new Character({ name: ['WAR', 'THF', 'WHM', 'BLM'][i], classData: ClassRegistry.getClass('warrior')!, level: 10 });
    c.stats.agility = 50 - i * 10; // WAR acts first
    if (st) c.statusTracker.apply(st);
    return c;
  });
  const goblin = enemyCopy('goblin');
  goblin.stats.hp = 999; goblin.stats.agility = 0;
  const bsm = new BattleStateMachine({ party, enemies: [goblin], spells: SPELLS }, () => 0.99);
  bsm.startBattle();
  bsm.advanceFromIntro();
  return { bsm, party };
}

const fight = (bsm: BattleStateMachine) => bsm.submitCommand({ type: 'fight', actorId: bsm.currentCommandActorId!, targetId: 'enemy_0' });

describe('play-test item 3: helpless members get no command menu', () => {
  it.each(['sleep', 'stun', 'stone'] as const)('a %s hero is skipped; the menu opens for the next member', (st) => {
    const { bsm } = battle([st, null]);
    expect(bsm.state).toBe('command_select');
    expect(bsm.currentCommandActorId).toBe('party_1');
  });

  it('the skipped hero keeps their turn: no announcement-worthy action, only the tick line', () => {
    const { bsm } = battle(['sleep', null]);
    fight(bsm);
    expect(bsm.state).toBe('execution');
    bsm.prepareRound();
    const next = bsm.peekNextAction()!;
    expect(next).toMatchObject({ actorId: 'party_0', actionType: 'skip' });
    expect(bsm.nextActorLosesTurn()).toBe(true);
    const r = bsm.executeNextAction();
    expect(r.messages.map((m) => m.text)[0]).toBe('WAR is asleep!');
    expect(r.damageEvents).toHaveLength(0);
  });

  it('a whole party that cannot act goes straight to execution (no menu at all)', () => {
    const { bsm } = battle(['sleep', 'stun']);
    expect(bsm.state).toBe('execution');
    expect(bsm.currentCommandActor).toBeNull();
  });

  it('a member skipped mid-menu: undo from the next member returns to the last member who chose a command', () => {
    const { bsm } = battle([null, 'sleep', null]);
    expect(bsm.currentCommandActorId).toBe('party_0');
    fight(bsm);
    expect(bsm.currentCommandActorId).toBe('party_2');   // THF (asleep) skipped
    expect(bsm.undoCommand()).toBe(true);
    expect(bsm.currentCommandActorId).toBe('party_0');
    fight(bsm);
    expect(bsm.currentCommandActorId).toBe('party_2');
  });

  it('undo with only skipped members before the current one does nothing', () => {
    const { bsm } = battle(['sleep', null]);
    expect(bsm.undoCommand()).toBe(false);
    expect(bsm.currentCommandActorId).toBe('party_1');
  });

  it('the next round skips the member again while they sleep; awake, they get the menu', () => {
    const { bsm, party } = battle([null, 'sleep']);
    fight(bsm);
    bsm.prepareRound();
    while (bsm.actionQueueLength > 0 && !bsm.isOver) bsm.executeNextAction();
    party[1].statusTracker.apply('sleep'); // still asleep (the wake roll could have cleared it)
    bsm.resolveRound();
    expect(bsm.currentCommandActorId).toBe('party_0');
    fight(bsm);
    expect(bsm.state).toBe('execution');
    bsm.prepareRound();
    while (bsm.actionQueueLength > 0 && !bsm.isOver) bsm.executeNextAction();
    party[1].statusTracker.remove('sleep');
    bsm.resolveRound();
    fight(bsm);
    expect(bsm.currentCommandActorId).toBe('party_1');
  });

  it('poison that is not lethal still gets the menu (the member acts)', () => {
    const { bsm } = battle(['poison', null]);
    expect(bsm.currentCommandActorId).toBe('party_0');
  });
});
