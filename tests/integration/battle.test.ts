import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleScene, type BattleSceneConfig, type BattleSceneDeps } from '../../src/scenes/BattleScene.js';
import type { EnemyData, CharacterClassData } from '../../src/types/index.js';
import { Character } from '../../src/entities/Character.js';
import type { InputAction } from '../../src/core/InputManager.js';
import { createMockInput, createMockBattleSceneDeps, type MockInput } from '../helpers/testUtils.js';

const mockClassData: CharacterClassData = {
  id: 'fighter',
  name: 'Fighter',
  baseStats: { hp: 100, strength: 20, agility: 10, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 1, vitality: 2, luck: 1 },
  usableEquipment: ['sword'],
  spellLevels: { white: 0, black: 0 },
};

const weakEnemy: EnemyData = {
  id: 'slime',
  name: 'Slime',
  stats: { hp: 1, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1, attack: 1, defense: 0, magicDefense: 0 },
  xpReward: 5,
  goldReward: 3,
  sprite: 'slime.png',
};

const strongEnemy: EnemyData = {
  id: 'dragon',
  name: 'Dragon',
  stats: { hp: 999, strength: 99, agility: 99, intelligence: 99, vitality: 99, luck: 99, attack: 999, defense: 999, magicDefense: 999 },
  xpReward: 100,
  goldReward: 500,
  sprite: 'dragon.png',
};

function createConfig(party: Character[], enemies: EnemyData[]): BattleSceneConfig {
  return { party, enemies };
}

/** Helper to advance scene with input then clear */
function tick(scene: BattleScene, input: MockInput, action?: InputAction) {
  if (action) input.press(action);
  scene.update(1);
  input.clear();
}

describe('Battle Integration', () => {
  let input: MockInput;
  let deps: BattleSceneDeps;

  beforeEach(() => {
    input = createMockInput();
    deps = createMockBattleSceneDeps(input);
  });

  it('complete victory flow: intro → command → execute → victory', () => {
    const hero = new Character({ name: 'Hero', classData: mockClassData });
    const scene = new BattleScene(deps, createConfig([hero], [weakEnemy]));
    scene.enter();

    // Access internal state for debugging
    const getState = () => (scene as unknown as { uiState: string }).uiState;
    const getBattleState = () => (scene as unknown as { battle: { state: string } }).battle.state;

    // Advance from intro
    tick(scene, input, 'confirm');
    expect(getState()).toBe('command');

    // Select Fight command
    tick(scene, input, 'confirm');
    expect(getState()).toBe('target');

    // Select target
    tick(scene, input, 'confirm');
    // After target selection with 1 party member, should go to executing then message
    expect(['executing', 'message']).toContain(getState());

    // Advance through messages until we reach 'end' state
    let iterations = 0;
    while (getState() !== 'end' && iterations < 50) {
      tick(scene, input, 'confirm');
      iterations++;
    }

    expect(getState()).toBe('end');
    expect(getBattleState()).toBe('victory');

    // Final confirm to trigger endBattle
    tick(scene, input, 'confirm');

    const emitCalls = (deps.events.emit as ReturnType<typeof vi.fn>).mock.calls;
    const battleEndCall = emitCalls.find(c => c[0] === 'battleEnd');
    expect(battleEndCall).toBeDefined();
    expect(battleEndCall![1].victory).toBe(true);
  });

  it('complete defeat flow: party dies → game over', () => {
    const hero = new Character({ name: 'Hero', classData: mockClassData, currentHp: 1 });
    const scene = new BattleScene(deps, createConfig([hero], [strongEnemy]));
    scene.enter();

    const getState = () => (scene as unknown as { uiState: string }).uiState;
    const getBattleState = () => (scene as unknown as { battle: { state: string } }).battle.state;

    tick(scene, input, 'confirm'); // intro
    tick(scene, input, 'confirm'); // fight
    tick(scene, input, 'confirm'); // target

    let iterations = 0;
    while (getState() !== 'end' && iterations < 50) {
      tick(scene, input, 'confirm');
      iterations++;
    }

    expect(getState()).toBe('end');
    expect(getBattleState()).toBe('defeat');

    tick(scene, input, 'confirm');

    const emitCalls = (deps.events.emit as ReturnType<typeof vi.fn>).mock.calls;
    const battleEndCall = emitCalls.find(c => c[0] === 'battleEnd');
    expect(battleEndCall).toBeDefined();
    expect(battleEndCall![1].victory).toBe(false);
  });

  it('command selection: navigate menu and cancel target selection', () => {
    const hero = new Character({ name: 'Hero', classData: mockClassData });
    const scene = new BattleScene(deps, createConfig([hero], [weakEnemy]));
    scene.enter();

    const getState = () => (scene as unknown as { uiState: string }).uiState;

    tick(scene, input, 'confirm'); // intro
    expect(getState()).toBe('command');

    tick(scene, input, 'down');    // navigate
    tick(scene, input, 'up');      // back
    tick(scene, input, 'confirm'); // select Fight
    expect(getState()).toBe('target');

    tick(scene, input, 'cancel');  // cancel
    expect(getState()).toBe('command');

    tick(scene, input, 'confirm'); // Fight again
    tick(scene, input, 'confirm'); // target

    let iterations = 0;
    while (getState() !== 'end' && iterations < 50) {
      tick(scene, input, 'confirm');
      iterations++;
    }

    tick(scene, input, 'confirm');

    const emitCalls = (deps.events.emit as ReturnType<typeof vi.fn>).mock.calls;
    const battleEndCall = emitCalls.find(c => c[0] === 'battleEnd');
    expect(battleEndCall).toBeDefined();
  });

  it('flee attempt: run command is processed', () => {
    const hero = new Character({ name: 'Hero', classData: mockClassData });
    const scene = new BattleScene(deps, createConfig([hero], [weakEnemy]));
    scene.enter();

    const getState = () => (scene as unknown as { uiState: string }).uiState;

    tick(scene, input, 'confirm'); // intro
    tick(scene, input, 'down');    // Magic
    tick(scene, input, 'down');    // Item
    tick(scene, input, 'down');    // Run
    tick(scene, input, 'confirm'); // select Run

    // Run command submitted - battle continues
    // Either we escape (defeat state) or fail to escape and continue fighting
    let iterations = 0;
    while (iterations < 50) {
      tick(scene, input, 'confirm');
      iterations++;
      // If we're in end state, we can break
      if (getState() === 'end') break;
    }

    // Battle should complete without error
    expect(() => tick(scene, input)).not.toThrow();
  });
});
