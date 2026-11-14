import { describe, it, expect } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { Character } from '../../src/entities/Character.js';
import type { EnemyData, CharacterClassData } from '../../src/types/index.js';
import { mulberry32, testClass, testEnemy } from '../helpers/testUtils.js';

const mockClass: CharacterClassData = {
  id: 'warrior',
  name: 'Warrior',
  baseStats: { hp: 50, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: [],
  spellLevels: { white: 0, black: 0 },
};

const mockEnemy: EnemyData = {
  id: 'goblin',
  name: 'Goblin',
  stats: { hp: 20, strength: 4, agility: 6, intelligence: 2, vitality: 3, luck: 3, attack: 8, defense: 4, magicDefense: 2 },
  xpReward: 10,
  goldReward: 5,
  sprite: 'goblin',
};

describe('BattleStateMachine', () => {
  it('should start in intro state', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] });
    battle.startBattle();
    expect(battle.state).toBe('intro');
  });

  it('should transition intro → command_select', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] });
    battle.startBattle();
    battle.advanceFromIntro();
    expect(battle.state).toBe('command_select');
  });

  it('should transition command_select → execution after all commands', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] });
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    expect(battle.state).toBe('execution');
  });

  it('should transition execution → resolution', () => {
    const char = new Character({ name: 'Hero', classData: mockClass });
    const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, () => 0.5);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    expect(battle.state).toBe('resolution');
  });

  it('should reach victory when all enemies dead', () => {
    const weakEnemy: EnemyData = { ...mockEnemy, stats: { ...mockEnemy.stats, hp: 1, defense: 0 } };
    const char = new Character({ name: 'Hero', classData: mockClass });
    const battle = new BattleStateMachine({ party: [char], enemies: [weakEnemy] }, () => 0.5);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    battle.resolveRound();
    expect(battle.state).toBe('victory');
    expect(battle.battleResult?.victory).toBe(true);
    expect(battle.battleResult?.xpReward).toBe(10);
  });

  it('should reach defeat when all party dead', () => {
    const strongEnemy: EnemyData = { ...mockEnemy, stats: { ...mockEnemy.stats, attack: 999 } };
    const char = new Character({ name: 'Hero', classData: mockClass, currentHp: 1 });
    const battle = new BattleStateMachine({ party: [char], enemies: [strongEnemy] }, () => 0.5);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.executeRound();
    battle.resolveRound();
    expect(battle.state).toBe('defeat');
    expect(battle.battleResult?.victory).toBe(false);
  });

  it('should auto-retarget when target dies', () => {
    const weakEnemy: EnemyData = { ...mockEnemy, stats: { ...mockEnemy.stats, hp: 1, defense: 0, agility: 1 } };
    const char1 = new Character({ name: 'Hero1', classData: { ...mockClass, baseStats: { ...mockClass.baseStats, agility: 20 } } });
    const char2 = new Character({ name: 'Hero2', classData: mockClass });
    const battle = new BattleStateMachine(
      { party: [char1, char2], enemies: [weakEnemy, weakEnemy] },
      () => 0.5
    );
    battle.startBattle();
    battle.advanceFromIntro();
    // Both target enemy_0, but Hero1 is faster and kills it
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.submitCommand({ type: 'fight', actorId: 'party_1', targetId: 'enemy_0' });
    battle.executeRound();
    // Hero2's attack should have been retargeted to enemy_1
    const messages = battle.currentMessages.map(m => m.text);
    expect(messages.some(m => m.includes('Hero2 hits'))).toBe(true);
  });

  describe('fear status in combat', () => {
    it('enemy with fear skips turn when rng < 0.5', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      // rng sequence: need to control the fear check specifically
      // tickCombatantStatus for enemy calls: tick() then checks fear with this.rng()
      // We need rng < 0.5 for the fear check
      let callCount = 0;
      const rng = () => {
        callCount++;
        // Return 0.3 for fear check (< 0.5 → skip), 0.5 for everything else
        return 0.3;
      };
      const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, rng);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      // Apply fear to the enemy before execution
      battle.allEnemies[0].status.apply('fear');
      battle.prepareRound();
      // Execute all actions and collect messages
      const allMessages: string[] = [];
      while (battle.actionQueueLength > 0) {
        const result = battle.executeNextAction();
        allMessages.push(...result.messages.map(m => m.text));
      }
      expect(allMessages.some(m => m.includes('trembling with fear'))).toBe(true);
    });

    it('enemy with fear acts normally when rng >= 0.5', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, () => 0.8);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.allEnemies[0].status.apply('fear');
      battle.prepareRound();
      const allMessages: string[] = [];
      while (battle.actionQueueLength > 0) {
        const result = battle.executeNextAction();
        allMessages.push(...result.messages.map(m => m.text));
      }
      expect(allMessages.some(m => m.includes('trembling with fear'))).toBe(false);
      // Enemy should have acted (hit or missed)
      expect(allMessages.some(m => m.includes('Goblin hits') || m.includes('Goblin missed'))).toBe(true);
    });
  });

  describe('dead actor skipping', () => {
    it('isNextActorAlive returns false for dead enemy', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, () => 0.5);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.prepareRound();
      // Kill the enemy after it's queued
      battle.allEnemies[0].currentHp = 0;
      expect(battle.isNextActorAlive()).toBe(false);
    });

    it('isNextActorAlive returns true for living enemy', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, () => 0.5);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.prepareRound();
      expect(battle.isNextActorAlive()).toBe(true);
    });

    it('isNextActorAlive returns false for empty queue', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, () => 0.5);
      expect(battle.isNextActorAlive()).toBe(false);
    });

    it('skips dead enemy actions in executeNextAction', () => {
      // Use high enemy agility so enemy goes first in the queue
      const fastEnemy: EnemyData = { ...mockEnemy, stats: { ...mockEnemy.stats, agility: 99 } };
      const char = new Character({ name: 'Hero', classData: mockClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [fastEnemy] }, () => 0.5);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.prepareRound();
      // Kill the enemy after it's queued but before execution
      battle.allEnemies[0].currentHp = 0;
      const result = battle.executeNextAction();
      // Dead actor's action should produce no messages or damage
      expect(result.messages).toHaveLength(0);
      expect(result.damageEvents).toHaveLength(0);
    });

    it('skips dead party member actions in executeNextAction', () => {
      // Use high party agility so party goes first
      const slowEnemy: EnemyData = { ...mockEnemy, stats: { ...mockEnemy.stats, agility: 1 } };
      const fastClass = { ...mockClass, baseStats: { ...mockClass.baseStats, agility: 99 } };
      const char = new Character({ name: 'Hero', classData: fastClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [slowEnemy] }, () => 0.5);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.prepareRound();
      // Kill the party member after queued
      char.currentHp = 0;
      const result = battle.executeNextAction();
      expect(result.messages).toHaveLength(0);
      expect(result.damageEvents).toHaveLength(0);
    });
  });

  describe('early battle end', () => {
    it('skipRemainingActions clears queue and sets state to resolution', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, () => 0.5);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.prepareRound();
      expect(battle.actionQueueLength).toBeGreaterThan(0);
      battle.skipRemainingActions();
      expect(battle.actionQueueLength).toBe(0);
      expect(battle.state).toBe('resolution');
    });

    it('resolveRound detects victory after skipRemainingActions', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, () => 0.5);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.prepareRound();
      battle.allEnemies[0].currentHp = 0;
      battle.skipRemainingActions();
      battle.resolveRound();
      expect(battle.state).toBe('victory');
      expect(battle.battleResult?.victory).toBe(true);
      expect(battle.battleResult?.xpReward).toBe(10);
      expect(battle.battleResult?.goldReward).toBe(5);
    });

    it('resolveRound detects defeat after skipRemainingActions', () => {
      const char = new Character({ name: 'Hero', classData: mockClass });
      const battle = new BattleStateMachine({ party: [char], enemies: [mockEnemy] }, () => 0.5);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.prepareRound();
      char.currentHp = 0;
      battle.skipRemainingActions();
      battle.resolveRound();
      expect(battle.state).toBe('defeat');
      expect(battle.battleResult?.victory).toBe(false);
    });
  });
});

describe('BattleStateMachine: FF1 maths wiring (T4a)', () => {
  /** One round in which only `enemy` fights `target`; returns the damage it dealt. */
  function enemyHit(rng: () => number): number {
    const tank = new Character({ name: 'Tank', classData: testClass('warrior', { baseStats: { hp: 999, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1 } }) });
    const brute = testEnemy({ name: 'Brute', stats: { hp: 999, agility: 50, attack: 20, accuracy: 100, defense: 50 } });
    const battle = new BattleStateMachine({ party: [tank], enemies: [brute], canRun: false }, rng);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'run', actorId: 'party_0' });
    battle.prepareRound();
    battle.executeNextAction();
    return 999 - tank.currentHp;
  }

  it('enemy damage varies: the same enemy and target under two RNG streams deal different damage (EB-10)', () => {
    const results = new Set([1, 2, 3, 4, 5, 6].map(seed => enemyHit(mulberry32(seed))));
    expect(results.size).toBeGreaterThan(1);
    for (const d of results) {
      expect(d).toBeGreaterThanOrEqual(20);
      expect(d).toBeLessThanOrEqual(80); // rand(20, 40), plus a crit's second roll
    }
  });

  it('a party hit that lands twice says "(2 hits)"', () => {
    const fast = testClass('warrior', { hitPercent: { base: 40, growth: 0 }, baseStats: { hp: 99, strength: 20, agility: 50, intelligence: 1, vitality: 1, luck: 1 } });
    const hero = new Character({ name: 'Hero', classData: fast });
    const battle = new BattleStateMachine({ party: [hero], enemies: [testEnemy({ stats: { hp: 999, defense: 0, evade: 0 } })] }, () => 0);
    battle.startBattle();
    battle.advanceFromIntro();
    battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
    battle.prepareRound();
    const { messages } = battle.executeNextAction();
    // rng 0: two hits of rand(10, 20) = 10 each; crit 0 never fires
    expect(messages[0].text).toBe('Hero hits Goblin for 20! (2 hits)');
  });

  it('an enemy whose target died retargets by the original slots (front-weighted)', () => {
    const cls = testClass('warrior', { baseStats: { hp: 999, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1 } });
    const party = [0, 1, 2, 3].map(i => new Character({ name: `P${i}`, classData: cls }));
    const enemy = testEnemy({ stats: { hp: 999, agility: 50, accuracy: 200 } });
    const battle = new BattleStateMachine({ party, enemies: [enemy], canRun: false }, () => 0.6);
    battle.setEnemyAI(0, { selectAction: (self) => ({ type: 'fight', actorId: self.id, targetId: 'party_1' }) });
    battle.startBattle();
    battle.advanceFromIntro();
    party.forEach((_, i) => battle.submitCommand({ type: 'run', actorId: `party_${i}` }));
    party[1].currentHp = 0;
    battle.prepareRound();
    battle.executeNextAction();
    // living slots 0, 2, 3 keep weights 4/1/1: 0.6 × 6 = 3.6 → slot 0 (uniform would give slot 2)
    expect(party[0].currentHp).toBeLessThan(999);
    expect(party[2].currentHp).toBe(999);
  });

  it('Run uses the runner’s luck and level: a Lv1 Thief escapes on 0.70, a Lv1 Warrior does not (EB-9, B9 cap)', () => {
    const run = (luck: number) => {
      const cls = testClass('x', { baseStats: { hp: 99, strength: 1, agility: 99, intelligence: 1, vitality: 1, luck } });
      const battle = new BattleStateMachine({ party: [new Character({ name: 'R', classData: cls })], enemies: [testEnemy()] }, () => 0.70);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'run', actorId: 'party_0' });
      battle.executeRound();
      return battle.outcome;
    };
    expect(run(15)).toBe('escaped');
    expect(run(5)).toBeNull();
  });

  it('the action result carries `missed`: true for a fight that misses, false for one that lands (T6 review)', () => {
    const swing = (roll: number) => {
      const hero = new Character({ name: 'Hero', classData: testClass('warrior', { baseStats: { hp: 99, strength: 20, agility: 50, intelligence: 1, vitality: 1, luck: 1 } }) });
      const battle = new BattleStateMachine({ party: [hero], enemies: [testEnemy({ stats: { hp: 999, defense: 0, evade: 0, agility: 1 } })] }, () => roll);
      battle.startBattle();
      battle.advanceFromIntro();
      battle.submitCommand({ type: 'fight', actorId: 'party_0', targetId: 'enemy_0' });
      battle.prepareRound();
      return battle.executeNextAction();   // the hero is faster: the first action is the hero's
    };
    const miss = swing(0.999);
    expect(miss.messages[0].text).toBe('Hero missed!');
    expect(miss.missed).toBe(true);
    expect(miss.damageEvents).toHaveLength(0);
    const hit = swing(0);
    expect(hit.missed).toBe(false);
    expect(hit.damageEvents).toHaveLength(1);
  });
});

