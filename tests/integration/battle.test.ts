import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleScene, COMMAND_CONFIRM_GUARD_FRAMES, type BattleSceneConfig, type BattleSceneDeps } from '../../src/scenes/BattleScene.js';
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

function createConfig(party: Character[], enemies: EnemyData[], rng?: () => number): BattleSceneConfig {
  return { party, enemies, rng };
}

/** Helper to advance scene with input then clear */
function tick(scene: BattleScene, input: MockInput, action?: InputAction) {
  if (action) input.press(action);
  scene.update(1);
  input.clear();
}

/** Lets the command menu's mash guard run out (confirm is ignored for a few frames after it opens). */
function waitGuard(scene: BattleScene, input: MockInput) {
  for (let i = 0; i < COMMAND_CONFIRM_GUARD_FRAMES; i++) tick(scene, input);
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
    waitGuard(scene, input);

    // Select Fight command
    tick(scene, input, 'confirm');
    expect(getState()).toBe('target');

    // Select target
    tick(scene, input, 'confirm');
    // After target selection with 1 party member, should go to executing then message
    expect(['executing', 'message']).toContain(getState());

    // Advance through messages until we reach 'end' state
    let iterations = 0;
    while (getState() !== 'end' && iterations < 300) {
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
    waitGuard(scene, input);
    tick(scene, input, 'confirm'); // fight
    tick(scene, input, 'confirm'); // target

    let iterations = 0;
    while (getState() !== 'end' && iterations < 300) {
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
    waitGuard(scene, input);

    tick(scene, input, 'down');    // navigate
    tick(scene, input, 'up');      // back
    tick(scene, input, 'confirm'); // select Fight
    expect(getState()).toBe('target');

    tick(scene, input, 'cancel');  // cancel
    expect(getState()).toBe('command');

    tick(scene, input, 'confirm'); // Fight again
    tick(scene, input, 'confirm'); // target

    let iterations = 0;
    while (getState() !== 'end' && iterations < 300) {
      tick(scene, input, 'confirm');
      iterations++;
    }

    tick(scene, input, 'confirm');

    const emitCalls = (deps.events.emit as ReturnType<typeof vi.fn>).mock.calls;
    const battleEndCall = emitCalls.find(c => c[0] === 'battleEnd');
    expect(battleEndCall).toBeDefined();
  });

  /** Intro → Run selected for the only party member; returns the scene and private-state readers. */
  function startRun(rng: () => number) {
    const hero = new Character({ name: 'Hero', classData: mockClassData });   // agility 10 vs the Slime's 1: acts first
    const scene = new BattleScene(deps, createConfig([hero], [weakEnemy], rng));
    scene.enter();
    const internals = scene as unknown as { uiState: string; battle: { state: string; outcome: string | null } };
    tick(scene, input, 'confirm'); // intro
    waitGuard(scene, input);
    tick(scene, input, 'down');    // Magic
    tick(scene, input, 'down');    // Item
    tick(scene, input, 'down');    // Run
    tick(scene, input, 'confirm'); // select Run
    return { scene, internals };
  }

  it('a successful escape ends the battle as escaped, with no Game Over', () => {
    const { scene, internals } = startRun(() => 0);   // 0 < run chance: always escapes
    let frames = 0;
    while (internals.uiState !== 'end' && frames < 600) { tick(scene, input); frames++; }

    expect(internals.uiState).toBe('end');
    expect(internals.battle.state).toBe('escaped');
    expect(internals.battle.outcome).toBe('escaped');

    tick(scene, input, 'confirm');   // "Escaped!" closes on confirm
    const emitCalls = (deps.events.emit as ReturnType<typeof vi.fn>).mock.calls;
    const battleEnd = emitCalls.find(c => c[0] === 'battleEnd');
    expect(battleEnd![1]).toMatchObject({ victory: false, escaped: true, xpReward: 0, goldReward: 0 });
    expect(emitCalls.some(c => c[0] === 'battleVictory')).toBe(false);
  });

  it('a failed escape continues the battle at the next command menu', () => {
    const { scene, internals } = startRun(() => 0.99);   // 99 >= run chance: never escapes
    let frames = 0;
    while (internals.uiState !== 'command' && frames < 600) { tick(scene, input); frames++; }

    expect(internals.uiState).toBe('command');
    expect(internals.battle.state).toBe('command_select');
    expect(internals.battle.outcome).toBeNull();
    const emitCalls = (deps.events.emit as ReturnType<typeof vi.fn>).mock.calls;
    expect(emitCalls.some(c => c[0] === 'battleEnd')).toBe(false);
  });

  it('with no input, a round goes from resolution back to command_select within the frame budget (BA-2)', () => {
    // Hero vs a Dragon that can't be hurt: the hero survives one round (rng 0.99: the Dragon misses), nobody dies.
    const hero = new Character({ name: 'Hero', classData: mockClassData });
    const scene = new BattleScene(deps, createConfig([hero], [strongEnemy], () => 0.99));
    scene.enter();
    const internals = scene as unknown as { uiState: string; battle: { state: string } };
    tick(scene, input, 'confirm'); // intro
    waitGuard(scene, input);
    tick(scene, input, 'confirm'); // Fight
    tick(scene, input, 'confirm'); // target
    expect(internals.uiState).toBe('executing');

    // Two actions (announce 30 + move + results 25 each + return) and round_end 20: well under 400 frames
    const BUDGET = 400;
    let frames = 0;
    while (internals.uiState !== 'command' && frames < BUDGET) { tick(scene, input); frames++; }
    expect(internals.uiState).toBe('command');
    expect(internals.battle.state).toBe('command_select');
    expect(hero.currentHp).toBeGreaterThan(0);
  });

  it('confirm is ignored for a few frames after the command menu opens', () => {
    const hero = new Character({ name: 'Hero', classData: mockClassData });
    const scene = new BattleScene(deps, createConfig([hero], [weakEnemy]));
    scene.enter();
    const getState = () => (scene as unknown as { uiState: string }).uiState;
    tick(scene, input, 'confirm'); // intro
    expect(getState()).toBe('command');
    tick(scene, input, 'confirm'); // mashed: ignored
    expect(getState()).toBe('command');
    waitGuard(scene, input);
    tick(scene, input, 'confirm'); // now picks Fight
    expect(getState()).toBe('target');
  });

  it('"No spells available." is a one-off notice and never replays an old battle message (BA-6)', () => {
    const hero = new Character({ name: 'Hero', classData: mockClassData });
    const scene = new BattleScene(deps, createConfig([hero], [strongEnemy], () => 0.99));
    scene.enter();
    const internals = scene as unknown as { uiState: string; messageText: { fullText: string } };
    tick(scene, input, 'confirm'); // intro
    waitGuard(scene, input);
    // One full round first, so the battle has old action messages that must not come back
    tick(scene, input, 'confirm'); // Fight
    tick(scene, input, 'confirm'); // target
    for (let i = 0; i < 400 && internals.uiState !== 'command'; i++) tick(scene, input);
    expect(internals.uiState).toBe('command');
    waitGuard(scene, input);
    tick(scene, input, 'down');    // Magic
    tick(scene, input, 'confirm'); // no spells
    expect(internals.uiState).toBe('notice');
    const seen: string[] = [];
    for (let i = 0; i < 60 && internals.uiState !== 'command'; i++) { tick(scene, input); seen.push(internals.messageText.fullText); }
    expect(internals.uiState).toBe('command');
    expect(seen.every(t => t === 'No spells available.' || t === "Hero's turn")).toBe(true);
    expect(internals.messageText.fullText).toBe("Hero's turn");
  });
});
