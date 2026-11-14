import { describe, it, expect, vi } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Character } from '../../src/entities/Character.js';
import type { EnemyData, CharacterClassData } from '../../src/types/index.js';

const fighter: CharacterClassData = {
  id: 'warrior',
  name: 'Warrior',
  baseStats: { hp: 50, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: [],
  spellLevels: { white: 0, black: 0 },
};

const goblin: EnemyData = {
  id: 'goblin',
  name: 'Goblin',
  stats: { hp: 20, strength: 4, agility: 1, intelligence: 2, vitality: 3, luck: 3, attack: 8, defense: 4, magicDefense: 2 },
  xpReward: 10,
  goldReward: 5,
  sprite: 'goblin',
};

/** Two-member party with the same name; party_0 runs, party_1 fights. The goblin (agility 1) always acts last. */
function runRound(rng: () => number, canRun = true) {
  const a = new Character({ name: 'FGHTR', classData: fighter });
  const b = new Character({ name: 'FGHTR', classData: fighter });
  const battle = new BattleStateMachine({ party: [a, b], enemies: [goblin], canRun }, rng);
  battle.startBattle();
  battle.advanceFromIntro();
  battle.submitCommand({ type: 'run', actorId: 'party_0' });
  battle.submitCommand({ type: 'fight', actorId: 'party_1', targetId: 'enemy_0' });
  battle.prepareRound();
  return { battle, a, b };
}

describe('battle outcome (BA-1)', () => {
  it('a successful escape ends the battle as escaped and is never overwritten', () => {
    const { battle, a } = runRound(() => 0);
    const clear = vi.spyOn(a, 'clearBattleState');
    let steps = 0;
    while (battle.actionQueueLength > 0 && !battle.isOver && steps++ < 10) battle.executeNextAction();

    expect(battle.outcome).toBe('escaped');
    expect(battle.isOver).toBe(true);
    expect(battle.state).toBe('escaped');
    expect(battle.actionQueueLength).toBe(0);
    expect(battle.battleResult).toEqual({ victory: false, escaped: true, xpReward: 0, xpPerMember: 0, goldReward: 0 });
    expect(clear).toHaveBeenCalled();

    // Nothing afterwards may move it back to resolution / command_select
    expect(battle.executeNextAction()).toEqual({ done: true, messages: [], damageEvents: [], missed: false });
    battle.skipRemainingActions();
    battle.resolveRound();
    expect(battle.state).toBe('escaped');
  });

  it('executeRound with a successful escape stays escaped', () => {
    const { battle } = runRound(() => 0);
    battle.executeRound();
    expect(battle.state).toBe('escaped');
    expect(battle.currentMessages.map(m => m.text)).toContain('Escaped!');
  });

  it('a failed escape continues the battle', () => {
    const { battle } = runRound(() => 0.99);
    battle.executeRound();
    expect(battle.outcome).toBeNull();
    expect(battle.state).toBe('resolution');
    battle.resolveRound();
    expect(battle.state).toBe('command_select');
  });

  it('Run is refused when the battle forbids it', () => {
    const { battle } = runRound(() => 0, false);
    battle.executeRound();
    expect(battle.outcome).toBeNull();
    expect(battle.currentMessages.map(m => m.text)).toContain('Cannot escape!');
  });

  it('victory shows only its end line, not the last action messages again', () => {
    const hero = new Character({ name: 'Hero', classData: fighter });
    const weak = { ...goblin, stats: { ...goblin.stats, hp: 1, defense: 0 } };
    const battle = new BattleStateMachine({ party: [hero], enemies: [weak] }, () => 0.5);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    battle.resolveRound();
    expect(battle.outcome).toBe('victory');
    expect(battle.currentMessages).toEqual([{ text: 'Victory! 10 XP each, 5 Gold.' }]);
    expect(battle.battleResult).toMatchObject({ victory: true, xpReward: 10, xpPerMember: 10, goldReward: 5 });
  });

  /** Win against Goblin ×4 (6 XP each, 24 in all) with `fallen` members already down. */
  function winAgainstFourGoblins(fallen: number) {
    const imp = { ...goblin, xpReward: 6, goldReward: 6, stats: { ...goblin.stats, hp: 1, defense: 0 } };
    const party = [0, 1, 2, 3].map(i => new Character({ name: `H${i}`, classData: fighter, currentHp: i < fallen ? 0 : undefined }));
    const battle = new BattleStateMachine({ party, enemies: [imp, imp, imp, imp] }, () => 0);
    battle.startBattle();
    battle.advanceFromIntro();
    party.forEach((c, i) => {
      if (c.currentHp > 0) battle.submitCommand({ type: 'fight', actorId: `party_${i}`, targetId: `enemy_${i - fallen}` });
    });
    // the living fight one goblin each; whatever is left, keep fighting until it ends
    for (let round = 0; round < 10 && !battle.isOver; round++) {
      if (battle.state === 'command_select') {
        party.forEach((c, i) => {
          if (c.currentHp > 0) battle.submitCommand({ type: 'fight', actorId: `party_${i}`, targetId: battle.livingEnemies[0]?.id });
        });
      }
      battle.executeRound();
      battle.resolveRound();
    }
    return battle;
  }

  it('the victory line shows the XP per living member: Goblin ×4 (24 XP) with 4 alive says "6 XP each" (BA-10)', () => {
    const battle = winAgainstFourGoblins(0);
    expect(battle.outcome).toBe('victory');
    expect(battle.currentMessages).toEqual([{ text: 'Victory! 6 XP each, 24 Gold.' }]);
    expect(battle.battleResult).toMatchObject({ xpReward: 24, xpPerMember: 6 });
  });

  it('with 3 alive each gets 8', () => {
    const battle = winAgainstFourGoblins(1);
    expect(battle.outcome).toBe('victory');
    expect(battle.battleResult?.xpPerMember).toBe(8);
    expect(battle.currentMessages[0].text).toBe('Victory! 8 XP each, 24 Gold.');
  });

  it('defeat ends as defeat, not escaped', () => {
    const hero = new Character({ name: 'Hero', classData: fighter, currentHp: 1 });
    const brute = { ...goblin, stats: { ...goblin.stats, agility: 99, attack: 999 } };
    const battle = new BattleStateMachine({ party: [hero], enemies: [brute] }, () => 0.5);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    battle.resolveRound();
    expect(battle.outcome).toBe('defeat');
    expect(battle.battleResult).toMatchObject({ victory: false, escaped: false });
  });
});

describe('peekNextAction carries the actor id (NG-3)', () => {
  it('returns party_i for each party member even when names repeat', () => {
    const { battle } = runRound(() => 0.99);
    const ids: string[] = [];
    while (battle.actionQueueLength > 0) {
      const next = battle.peekNextAction();
      if (next) ids.push(next.actorId);
      battle.executeNextAction();
    }
    expect(ids.sort()).toEqual(['enemy_0', 'party_0', 'party_1']);
  });
});

describe('B9: the run chance counts the living enemies', () => {
  const lucky: CharacterClassData = { ...fighter, id: 'thief', baseStats: { ...fighter.baseStats, luck: 18, agility: 99 } };

  /** One lucky runner (18/17, capped at 75 %) against `n` goblins, every roll at 0.70. */
  function runAgainst(n: number) {
    const runner = new Character({ name: 'THIEF', classData: lucky });
    const battle = new BattleStateMachine({ party: [runner], enemies: Array.from({ length: n }, () => goblin) }, () => 0.7);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'run', actorId: 'party_0' });
    battle.prepareRound();
    battle.executeNextAction(); // the runner (agility 99) acts first
    return battle.outcome;
  }

  it('a roll of 0.70 escapes from 1 enemy (75 %) but not from 3 (65 %); the old chance was 100 %', () => {
    expect(runAgainst(1)).toBe('escaped');
    expect(runAgainst(3)).toBeNull();
  });

  it('a fallen enemy no longer counts: 3 goblins with 2 down is the 1-enemy chance', () => {
    const runner = new Character({ name: 'THIEF', classData: lucky });
    const battle = new BattleStateMachine({ party: [runner], enemies: [goblin, goblin, goblin] }, () => 0.7);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.allEnemies[1].currentHp = 0;
    battle.allEnemies[2].currentHp = 0;
    battle.submitCommand({ type: 'run', actorId: 'party_0' });
    battle.prepareRound();
    battle.executeNextAction();
    expect(battle.outcome).toBe('escaped');
  });
});

describe('B5: queued item commands reserve the item', () => {
  it('reservedItems counts this round\'s item commands, and undo releases them', () => {
    const a = new Character({ name: 'A', classData: fighter });
    const b = new Character({ name: 'B', classData: fighter });
    const battle = new BattleStateMachine({ party: [a, b], enemies: [goblin] }, () => 0.5);
    battle.startBattle();
    battle.advanceFromIntro();
    expect(battle.reservedItems('potion')).toBe(0);
    battle.submitCommand({ type: 'item', actorId: 'party_0', targetId: 'party_0', itemId: 'potion' });
    expect(battle.reservedItems('potion')).toBe(1);
    expect(battle.reservedItems('ether')).toBe(0);
    battle.undoCommand();
    expect(battle.reservedItems('potion')).toBe(0);
  });
});
