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
import type { MapData } from '../../src/types/index.js';
import type { BattleSceneDeps } from '../../src/scenes/BattleScene.js';

export function createMockGame(mapData?: MapData) {
  const map = mapData ?? createMapData();
  return {
    app: { stage: new Container() },
    scenes: { register: vi.fn(), switchTo: vi.fn() },
    assets: { load: vi.fn().mockResolvedValue(Texture.WHITE) },
    input: {
      isPressed: vi.fn().mockReturnValue(false),
      isJustPressed: vi.fn().mockReturnValue(false),
      attach: vi.fn(),
      detach: vi.fn(),
      update: vi.fn(),
    },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    data: { loadMap: vi.fn().mockResolvedValue(map), loadEnemies: vi.fn().mockResolvedValue([]) },
    party: { all: [], distributeXp: vi.fn(), addGold: vi.fn() },
  } as const;
}

export type MockGame = ReturnType<typeof createMockGame>;

export function createMockBattleSceneDeps(input?: MockInput): BattleSceneDeps {
  return {
    input: input ?? {
      isPressed: vi.fn().mockReturnValue(false),
      isJustPressed: vi.fn().mockReturnValue(false),
    },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
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
