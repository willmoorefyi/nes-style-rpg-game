import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { BattleScene, type BattleSceneConfig } from '../../src/scenes/BattleScene.js';
import type { EnemyData, CharacterClassData } from '../../src/types/index.js';
import { Character } from '../../src/entities/Character.js';
import { createMockBattleSceneDeps } from '../helpers/testUtils.js';

const mockClassData: CharacterClassData = {
  id: 'fighter',
  name: 'Fighter',
  baseStats: { hp: 30, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 1, vitality: 2, luck: 1 },
  usableEquipment: ['sword', 'armor'],
  spellLevels: { white: 0, black: 0 },
};

const mockEnemy: EnemyData = {
  id: 'goblin',
  name: 'Goblin',
  stats: { hp: 10, strength: 5, agility: 4, intelligence: 2, vitality: 3, luck: 2, attack: 5, defense: 2, magicDefense: 1 },
  xpReward: 10,
  goldReward: 5,
  sprite: 'goblin.png',
};

function createConfig(): BattleSceneConfig {
  return {
    party: [new Character({ name: 'Hero', classData: mockClassData })],
    enemies: [mockEnemy],
  };
}

describe('BattleScene', () => {
  let deps: ReturnType<typeof createMockBattleSceneDeps>;
  let scene: BattleScene;

  beforeEach(() => {
    deps = createMockBattleSceneDeps();
    scene = new BattleScene(deps, createConfig());
  });

  it('has a container', () => {
    expect(scene.container).toBeInstanceOf(Container);
  });

  it('initializes battle on enter', () => {
    scene.enter();
    expect(scene.container.children.length).toBeGreaterThan(0);
  });

  it('updates without error in intro state', () => {
    scene.enter();
    expect(() => scene.update(1)).not.toThrow();
  });

  it('advances from intro on confirm press', () => {
    scene.enter();
    (deps.input.isJustPressed as ReturnType<typeof import('vitest').vi.fn>).mockReturnValue(true);
    scene.update(1);
    expect(() => scene.update(1)).not.toThrow();
  });

  it('cleans up on exit', () => {
    scene.enter();
    scene.exit();
    expect(scene.container.children.length).toBe(0);
  });
});
