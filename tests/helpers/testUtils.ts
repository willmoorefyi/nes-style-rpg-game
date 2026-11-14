import { vi } from 'vitest';
import type { InputAction } from '../../src/core/InputManager.js';

/** Creates a mock input that tracks pressed state per-frame */
export function createMockInput() {
  let pressedThisFrame: InputAction | null = null;
  return {
    isPressed: vi.fn().mockReturnValue(false),
    isJustPressed: vi.fn((action: InputAction) => action === pressedThisFrame),
    press(action: InputAction) { pressedThisFrame = action; },
    clear() { pressedThisFrame = null; },
  };
}

export type MockInput = ReturnType<typeof createMockInput>;
import { Container, Texture } from 'pixi.js';
import type { CharacterClassData, EnemyData, MapData } from '../../src/types/index.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { Inventory } from '../../src/entities/Inventory.js';
import type { BattleSceneDeps } from '../../src/scenes/BattleScene.js';

export function createMockAudio() {
  return {
    playMusic: vi.fn().mockResolvedValue(undefined),
    stopMusic: vi.fn(),
    playSFX: vi.fn().mockResolvedValue(undefined),
    setMusicVolume: vi.fn(),
    setSFXVolume: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    isMuted: false,
    currentTrack: null,
  };
}

export function createMockGame(mapData?: MapData) {
  const map = mapData ?? createMapData();
  return {
    app: { stage: new Container() },
    scenes: { register: vi.fn(), unregister: vi.fn(), switchTo: vi.fn(), push: vi.fn(), pop: vi.fn() },
    assets: { load: vi.fn().mockResolvedValue(Texture.WHITE) },
    input: {
      isPressed: vi.fn().mockReturnValue(false),
      isJustPressed: vi.fn().mockReturnValue(false),
      attach: vi.fn(),
      detach: vi.fn(),
      update: vi.fn(),
    },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    data: { loadMap: vi.fn().mockResolvedValue(map), loadEnemies: vi.fn().mockResolvedValue([]), loadSpells: vi.fn().mockResolvedValue([]) },
    party: { all: [] as readonly unknown[], get: vi.fn().mockReturnValue(null), gold: 0, distributeXp: vi.fn(), addGold: vi.fn() },
    audio: createMockAudio(),
    // Game state the exploration scene reads on enter (new game: no map yet)
    currentMapId: '',
    playerPosition: { x: 0, y: 0 },
    pendingEntrance: null as string | null,
    battleRetry: null,
    pendingBattle: null,
    gameFlags: new GameFlags(),
    inventory: new Inventory(),
  };
}

export type MockGame = ReturnType<typeof createMockGame>;

export function createMockBattleSceneDeps(input?: MockInput): BattleSceneDeps {
  return {
    input: input ?? {
      isPressed: vi.fn().mockReturnValue(false),
      isJustPressed: vi.fn().mockReturnValue(false),
    },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    audio: createMockAudio(),
  } as unknown as BattleSceneDeps;
}

export function createMapData(overrides: Partial<MapData> = {}): MapData {
  const width = overrides.width ?? 8;
  const height = overrides.height ?? 8;
  const size = width * height;
  
  return {
    id: 'test-map',
    width,
    height,
    layers: [Array(size).fill(2)],
    tilesets: ['tileset.png'],
    collision: Array(size).fill(0),
    npcs: [],
    transitions: [],
    ...overrides,
  };
}
/**
 * Shared synthetic class (FF1-style combat fields included, so battle maths tests don't depend on
 * classes.yaml). Defaults to a Warrior-like class; `overrides` replace whole fields.
 */
export function testClass(id = 'warrior', overrides: Partial<CharacterClassData> = {}): CharacterClassData {
  return {
    id,
    name: id,
    baseStats: { hp: 50, strength: 10, agility: 5, intelligence: 1, vitality: 8, luck: 5 },
    statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 0, vitality: 1, luck: 1 },
    usableEquipment: [],
    spellLevels: { white: 0, black: 0 },
    hitPercent: { base: 10, growth: 3 },
    magicDefense: { base: 15, growth: 3 },
    spellCharges: [],
    ...overrides,
  };
}

/** Shared synthetic enemy (an FF1 IMP-like Goblin by default); `stats` merges with the defaults. */
export function testEnemy(overrides: Partial<Omit<EnemyData, 'stats'>> & { stats?: Partial<EnemyData['stats']> } = {}): EnemyData {
  const { stats, ...rest } = overrides;
  return {
    id: 'goblin',
    name: 'Goblin',
    xpReward: 6,
    goldReward: 6,
    sprite: 'goblin',
    ...rest,
    stats: {
      hp: 8, strength: 0, agility: 6, intelligence: 1, vitality: 0, luck: 0,
      attack: 4, defense: 4, magicDefense: 16, accuracy: 2, evade: 6,
      ...stats,
    },
  };
}

/** Small seeded RNG (mulberry32) for statistical battle tests. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
