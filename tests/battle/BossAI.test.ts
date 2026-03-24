import { describe, it, expect } from 'vitest';
import { BossAI, type BossPattern } from '../../src/battle/BossAI.js';
import { Character } from '../../src/entities/Character.js';
import type { EnemyInstance } from '../../src/battle/BattleStateMachine.js';
import type { CharacterClassData, EnemyData } from '../../src/types/index.js';
import { StatusTracker } from '../../src/battle/StatusEffects.js';

const mockClass: CharacterClassData = {
  id: 'warrior', name: 'Warrior',
  baseStats: { hp: 50, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
  usableEquipment: [], spellLevels: { white: 0, black: 0 },
};

const bossData: EnemyData = {
  id: 'lich', name: 'Lich',
  stats: { hp: 200, strength: 15, agility: 10, intelligence: 20, vitality: 12, luck: 8, attack: 25, defense: 15, magicDefense: 20 },
  xpReward: 500, goldReward: 200, sprite: 'lich',
};

function makeBoss(hp?: number): EnemyInstance {
  return {
    id: 'enemy_0', data: bossData,
    currentHp: hp ?? bossData.stats.hp,
    status: new StatusTracker(), buffs: new Map(),
  };
}

function makeParty(): Character[] {
  return [new Character({ name: 'Hero', classData: mockClass })];
}

describe('BossAI', () => {
  it('should select fight when pattern has only fight actions', () => {
    const pattern: BossPattern = { actions: [{ type: 'fight', weight: 1 }] };
    const ai = new BossAI(pattern);
    const cmd = ai.selectAction(makeBoss(), makeParty(), [], 1, () => 0);
    expect(cmd.type).toBe('fight');
    expect(cmd.actorId).toBe('enemy_0');
  });

  it('should select magic action with spellId when weighted', () => {
    const pattern: BossPattern = {
      actions: [
        { type: 'magic', spellId: 'fire', weight: 1 },
      ],
    };
    const ai = new BossAI(pattern);
    const cmd = ai.selectAction(makeBoss(), makeParty(), [], 1, () => 0);
    expect(cmd.type).toBe('magic');
    expect(cmd.spellId).toBe('fire');
  });

  it('should respect weighted random selection', () => {
    const pattern: BossPattern = {
      actions: [
        { type: 'fight', weight: 1 },           // 0.0 - 0.25
        { type: 'magic', spellId: 'fire', weight: 3 }, // 0.25 - 1.0
      ],
    };
    const ai = new BossAI(pattern);
    // rng=0.1 → roll=0.4, first item weight=1, 0.4-1=-0.6 still >0? No: 0.4-1=-0.6 <=0 → fight
    // Actually: total=4, roll=0.1*4=0.4, 0.4-1=-0.6<=0 → fight
    const cmd1 = ai.selectAction(makeBoss(), makeParty(), [], 1, () => 0.1);
    expect(cmd1.type).toBe('fight');

    // rng=0.5 → roll=2.0, 2.0-1=1.0>0, 1.0-3=-2.0<=0 → magic
    const cmd2 = ai.selectAction(makeBoss(), makeParty(), [], 1, () => 0.5);
    expect(cmd2.type).toBe('magic');
  });

  it('should filter actions by condition', () => {
    const pattern: BossPattern = {
      actions: [
        { type: 'fight', weight: 1 },
        {
          type: 'magic', spellId: 'fire', weight: 100,
          condition: (_self, turn) => turn % 3 === 0, // only on turns divisible by 3
        },
      ],
    };
    const ai = new BossAI(pattern);

    // Turn 1: condition fails, only fight available
    const cmd1 = ai.selectAction(makeBoss(), makeParty(), [], 1, () => 0.99);
    expect(cmd1.type).toBe('fight');

    // Turn 3: condition passes, fire has weight 100 vs fight weight 1
    const cmd3 = ai.selectAction(makeBoss(), makeParty(), [], 3, () => 0.5);
    expect(cmd3.type).toBe('magic');
    expect(cmd3.spellId).toBe('fire');
  });

  it('should support HP-based conditions', () => {
    const pattern: BossPattern = {
      actions: [
        { type: 'fight', weight: 1 },
        {
          type: 'magic', spellId: 'heal', weight: 100,
          condition: (self) => self.currentHp / self.data.stats.hp < 0.3,
        },
      ],
    };
    const ai = new BossAI(pattern);

    // Full HP: heal condition fails
    const cmd1 = ai.selectAction(makeBoss(200), makeParty(), [], 1, () => 0.5);
    expect(cmd1.type).toBe('fight');

    // Low HP: heal condition passes
    const cmd2 = ai.selectAction(makeBoss(50), makeParty(), [], 1, () => 0.5);
    expect(cmd2.type).toBe('magic');
    expect(cmd2.spellId).toBe('heal');
  });

  it('should fall back to fight when all conditions fail', () => {
    const pattern: BossPattern = {
      actions: [
        { type: 'magic', spellId: 'fire', weight: 1, condition: () => false },
      ],
    };
    const ai = new BossAI(pattern);
    const cmd = ai.selectAction(makeBoss(), makeParty(), [], 1, () => 0);
    expect(cmd.type).toBe('fight');
  });

  it('should switch pattern via setPattern', () => {
    const phase1: BossPattern = { actions: [{ type: 'fight', weight: 1 }] };
    const phase2: BossPattern = { actions: [{ type: 'magic', spellId: 'nuke', weight: 1 }] };
    const ai = new BossAI(phase1);

    const cmd1 = ai.selectAction(makeBoss(), makeParty(), [], 1, () => 0);
    expect(cmd1.type).toBe('fight');

    ai.setPattern(phase2);
    const cmd2 = ai.selectAction(makeBoss(), makeParty(), [], 2, () => 0);
    expect(cmd2.type).toBe('magic');
    expect(cmd2.spellId).toBe('nuke');
  });

  it('should target a living party member', () => {
    const pattern: BossPattern = { actions: [{ type: 'fight', weight: 1 }] };
    const ai = new BossAI(pattern);
    const dead = new Character({ name: 'Dead', classData: mockClass, currentHp: 0 });
    const alive = new Character({ name: 'Alive', classData: mockClass });
    const cmd = ai.selectAction(makeBoss(), [dead, alive], [], 1, () => 0);
    expect(cmd.targetId).toBe('Alive');
  });
});
