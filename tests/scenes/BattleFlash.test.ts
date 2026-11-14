import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import type { Game } from '../../src/core/Game.js';
import { EventBus } from '../../src/core/EventBus.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Character } from '../../src/entities/Character.js';
import { createMockGame, createMapData, testClass } from '../helpers/testUtils.js';
import type { MockGame } from '../helpers/testUtils.js';

describe('ExplorationScene - C5 Battle flash', () => {
  let game: MockGame;
  let scene: ExplorationScene;

  beforeEach(() => {
    game = createMockGame();
    scene = new ExplorationScene(game as unknown as Game);
  });

  it('constructs without error with battle flash support', () => {
    expect(scene).toBeDefined();
    expect(scene.container).toBeDefined();
  });

  it('loads and updates without error', async () => {
    await scene.enter();
    expect(() => scene.update(1)).not.toThrow();
  });
});

describe('BA-13: the battle-start flash does not survive the battle', () => {
  const slime = {
    id: 'slime', name: 'Slime', xpReward: 1, goldReward: 1, sprite: 'slime.png',
    stats: { hp: 5, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1, attack: 1, defense: 0, magicDefense: 0 },
  };

  beforeEach(() => {
    // Controls hint already seen (it would swallow the first inputs).
    const store: Record<string, string> = { ff1_controlsSeen: 'true' };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; }, clear: () => {},
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  /** Full-screen white rectangles directly on the scene's container (the flash; the fade overlay is black). */
  const isWhite = (g: Graphics): boolean => g.context.instructions.some(
    (i) => i.action === 'fill' && (i.data as { style?: { color?: number } }).style?.color === 0xffffff);
  const flashes = (root: Container): Graphics[] =>
    root.children.filter((c): c is Graphics =>
      c instanceof Graphics && c.visible && c.width >= 1920 && c.height >= 1080 && isWhite(c));

  it('after push(battle) and pop, no white frame is left and the first Down press moves the player', async () => {
    const base = createMockGame(createMapData({ id: 'field', width: 8, height: 8 }));
    const party = new PartyManager();
    party.add(new Character({ name: 'WAR', classData: testClass('warrior') }));
    let down = false;
    const game = {
      ...base,
      events: new EventBus(),
      party,
      input: { ...base.input, isPressed: vi.fn((a: string) => down && a === 'down'), isJustPressed: vi.fn(() => false) },
      data: { ...base.data, loadEnemies: vi.fn().mockResolvedValue([slime]) },
    };
    game.currentMapId = 'field';
    game.playerPosition = { x: 3, y: 3 };
    (game as unknown as Game).pendingBattle = { enemyIds: ['slime'] };
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    await new Promise((r) => setTimeout(r, 20));
    expect(game.scenes.push).toHaveBeenCalledWith('battle');
    expect(flashes(scene.container)).toHaveLength(1); // mid-flash when the battle is pushed

    // what SceneManager does around the battle
    scene.onPause();
    scene.onResume();
    expect(flashes(scene.container)).toHaveLength(0);

    const moves: Array<{ x: number; y: number }> = [];
    game.events.on('playerMove', (p) => moves.push(p as { x: number; y: number }));
    down = true;
    scene.update(100);
    scene.update(100);
    expect(moves).toEqual([{ x: 3, y: 4 }]);
  });
});
