import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { BattleScene, COMMAND_CONFIRM_GUARD_FRAMES, type BattleSceneConfig } from '../../src/scenes/BattleScene.js';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import type { EnemyData, CharacterClassData } from '../../src/types/index.js';
import type { InputAction } from '../../src/core/InputManager.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { createMockBattleSceneDeps, createMockInput, type MockInput } from '../helpers/testUtils.js';

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

/** One frame with an optional key press. */
function tick(scene: BattleScene, input: MockInput, action?: InputAction): void {
  if (action) input.press(action);
  scene.update(1);
  input.clear();
}

function toCommandMenu(scene: BattleScene, input: MockInput): void {
  tick(scene, input, 'confirm'); // skip the intro
  expect(scene.uiPhase).toBe('command');
  for (let i = 0; i < COMMAND_CONFIRM_GUARD_FRAMES; i++) tick(scene, input);
}

const sturdy: CharacterClassData = { ...mockClassData, baseStats: { ...mockClassData.baseStats, hp: 100 } };
const harmless: EnemyData = { ...mockEnemy, stats: { ...mockEnemy.stats, hp: 500, attack: 1, agility: 1 } };

describe('BattleScene: a boss phase line (ST-6)', () => {
  it('shows before the first announcement and then auto-advances into the actions', () => {
    const input = createMockInput();
    const deps = createMockBattleSceneDeps(input);
    const boss: EnemyData = { ...harmless, name: 'Garland', bossPhases: [{ hpThreshold: 1, patternId: 'aggressive', message: "Garland's attacks grow fiercer!" }] };
    const scene = new BattleScene(deps, { party: [new Character({ name: 'Hero', classData: sturdy })], enemies: [boss], rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    tick(scene, input, 'confirm'); // Fight
    tick(scene, input, 'confirm'); // the target: the round starts
    expect(scene.uiPhase).toBe('message');
    expect(scene.messageLine).toBe("Garland's attacks grow fiercer!");
    // no input: the message timer moves on to the first action's announcement
    const lines: string[] = [];
    for (let i = 0; i < 120 && scene.uiPhase !== 'executing'; i++) tick(scene, input);
    expect(scene.uiPhase).toBe('executing');
    for (let i = 0; i < 5; i++) { tick(scene, input); lines.push(scene.messageLine); }
    expect(lines.some(l => /attacks/.test(l))).toBe(true);
  });
});

describe('BattleScene: Phoenix Down from Item (BA-5)', () => {
  beforeEach(async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => [
      { id: 'phoenix_down', name: 'Phoenix Down', type: 'consumable' as const, stats: {}, price: 500, usableBy: [] },
      { id: 'tent', name: 'Tent', type: 'consumable' as const, stats: {}, price: 75, usableBy: [] },
    ] } as Pick<DataLoader, 'loadItems'> as DataLoader);
  });

  it('targets the KO\'d member, and the member stands up with 1 HP', () => {
    const input = createMockInput();
    const deps = createMockBattleSceneDeps(input);
    const hero = new Character({ name: 'Hero', classData: sturdy });
    const fallen = new Character({ name: 'Ally', classData: sturdy, currentHp: 0 });
    const inventory = new Inventory();
    inventory.add('tent');
    inventory.add('phoenix_down');
    const submit = vi.spyOn(BattleStateMachine.prototype, 'submitCommand');
    const scene = new BattleScene(deps, { party: [hero, fallen], enemies: [harmless], inventory, rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    tick(scene, input, 'down');
    tick(scene, input, 'down');
    tick(scene, input, 'confirm'); // Item
    expect(scene.uiPhase).toBe('item_ui');
    tick(scene, input, 'confirm'); // the first listed item: Phoenix Down (the Tent is not listed in battle)
    expect(scene.uiPhase).toBe('target');
    tick(scene, input, 'confirm'); // the only target: the fallen member
    expect(submit).toHaveBeenCalledWith({ type: 'item', actorId: 'party_0', targetId: 'party_1', itemId: 'phoenix_down' });
    for (let i = 0; i < 400 && scene.uiPhase !== 'command'; i++) tick(scene, input, i % 10 === 0 ? 'confirm' : undefined);
    expect(fallen.currentHp).toBe(1);
    expect(inventory.has('phoenix_down')).toBe(false);
    expect(inventory.has('tent')).toBe(true);
    submit.mockRestore();
  });
});
