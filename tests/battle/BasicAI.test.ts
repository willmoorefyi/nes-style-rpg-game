import { describe, it, expect } from 'vitest';
import { BasicAI } from '../../src/battle/BasicAI.js';
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

const mockEnemyData: EnemyData = {
  id: 'goblin', name: 'Goblin',
  stats: { hp: 20, strength: 4, agility: 6, intelligence: 2, vitality: 3, luck: 3, attack: 8, defense: 4, magicDefense: 2 },
  xpReward: 10, goldReward: 5, sprite: 'goblin',
};

function makeEnemy(id = 'enemy_0'): EnemyInstance {
  return { id, data: mockEnemyData, currentHp: 20, status: new StatusTracker(), buffs: new Map(), displayName: mockEnemyData.name };
}

describe('BasicAI', () => {
  const ai = new BasicAI();

  it('should return a fight command targeting a living party member', () => {
    const party = [new Character({ name: 'Hero', classData: mockClass })];
    const cmd = ai.selectAction(makeEnemy(), party, [], 1, () => 0);
    expect(cmd.type).toBe('fight');
    expect(cmd.targetId).toBe('party_0');
    expect(cmd.actorId).toBe('enemy_0');
  });

  it('should only target living party members', () => {
    const alive = new Character({ name: 'Alive', classData: mockClass });
    const dead = new Character({ name: 'Dead', classData: mockClass, currentHp: 0 });
    const cmd = ai.selectAction(makeEnemy(), [dead, alive], [], 1, () => 0);
    expect(cmd.targetId).toBe('party_1');
  });

  it('should use rng for target selection among multiple living members', () => {
    const a = new Character({ name: 'A', classData: mockClass });
    const b = new Character({ name: 'B', classData: mockClass });
    const c = new Character({ name: 'C', classData: mockClass });
    // rng=0.5 → floor(0.5*3)=1 → 'party_1'
    const cmd = ai.selectAction(makeEnemy(), [a, b, c], [], 1, () => 0.5);
    expect(cmd.targetId).toBe('party_1');
  });

  it('should return undefined targetId when all party members are dead', () => {
    const dead = new Character({ name: 'Dead', classData: mockClass, currentHp: 0 });
    const cmd = ai.selectAction(makeEnemy(), [dead], [], 1, () => 0);
    expect(cmd.targetId).toBeUndefined();
  });
});
