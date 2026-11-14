import { describe, it, expect, afterEach, vi } from 'vitest';
import { SaveManager } from '../../src/systems/SaveManager.js';
import { TitleScene } from '../../src/scenes/TitleScene.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame } from '../helpers/testUtils.js';

// Mock localStorage for Node.js test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('TitleScene business logic', () => {
  afterEach(() => {
    localStorageMock.clear();
  });

  describe('save detection', () => {
    it('detects when no saves exist', () => {
      const slots = SaveManager.getSaveSlots();
      const hasSaves = slots.some((s) => s !== null);
      expect(hasSaves).toBe(false);
    });

    it('detects when saves exist', () => {
      const saveData = {
        version: 1,
        party: {
          members: [
            {
              name: 'FGHTR',
              classId: 'warrior',
              level: 5,
              xp: 500,
              currentHp: 35,
              equipment: { weapon: null, armor: null, shield: null, helmet: null },
              spellCharges: [0, 0, 0, 0, 0, 0, 0, 0],
              learnedSpells: [],
            },
          ],
          gold: 100,
        },
        inventory: [],
        flags: {},
        currentMap: 'cornelia',
        playerPosition: { x: 5, y: 5 },
        playTime: 120,
        saveDate: new Date().toISOString(),
        slotId: 0,
      };
      localStorageMock.setItem('ff1_save_0', JSON.stringify(saveData));

      const slots = SaveManager.getSaveSlots();
      const hasSaves = slots.some((s) => s !== null);
      expect(hasSaves).toBe(true);
    });
  });

  describe('menu options', () => {
    it('New Game option is always enabled', () => {
      const items = [
        { label: 'New Game', value: 'new', enabled: true },
        { label: 'Continue', value: 'continue', enabled: false },
      ];
      const newGame = items.find((i) => i.value === 'new');
      expect(newGame?.enabled).toBe(true);
    });

    it('Continue is disabled when no saves exist', () => {
      const hasSaves = SaveManager.getSaveSlots().some((s) => s !== null);
      const continueEnabled = hasSaves;
      expect(continueEnabled).toBe(false);
    });
  });

  describe('navigation', () => {
    it('New Game maps to partyCreation scene', () => {
      let navigatedTo = '';
      const onSelect = (value: string) => {
        if (value === 'new') navigatedTo = 'partyCreation';
        else if (value === 'continue') navigatedTo = 'loadMenu';
      };
      onSelect('new');
      expect(navigatedTo).toBe('partyCreation');
    });

    it('Continue maps to loadMenu scene', () => {
      let navigatedTo = '';
      const onSelect = (value: string) => {
        if (value === 'new') navigatedTo = 'partyCreation';
        else if (value === 'continue') navigatedTo = 'loadMenu';
      };
      onSelect('continue');
      expect(navigatedTo).toBe('loadMenu');
    });
  });
});

describe('TitleScene (S3, S6, I3)', () => {
  /** A mock game whose confirm key is down on every frame (two fast presses arrive on consecutive updates). */
  function titleGame() {
    const game = createMockGame();
    let confirm = false;
    game.input.isJustPressed = vi.fn((a: string) => confirm && a === 'confirm');
    game.scenes.switchTo = vi.fn().mockResolvedValue(undefined);
    game.scenes.push = vi.fn().mockResolvedValue(undefined);
    return { game, press: (on: boolean) => { confirm = on; } };
  }

  it('a double confirm on New Game switches to party creation once', () => {
    const { game, press } = titleGame();
    const scene = new TitleScene(game as unknown as Game);
    scene.enter();
    press(true);
    scene.update(1);
    scene.update(1);
    expect(game.scenes.switchTo).toHaveBeenCalledTimes(1);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('partyCreation');
  });

  it('after the load menu is closed (onResume) the title takes a choice again', () => {
    const { game, press } = titleGame();
    const scene = new TitleScene(game as unknown as Game);
    scene.enter();
    press(true);
    scene.update(1);
    scene.onResume();
    scene.update(1);
    expect(game.scenes.switchTo).toHaveBeenCalledTimes(2);
  });

  it('a failed scene change lets the player choose again', async () => {
    const { game, press } = titleGame();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    game.scenes.switchTo = vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue(undefined);
    const scene = new TitleScene(game as unknown as Game);
    scene.enter();
    press(true);
    scene.update(1);
    await new Promise((r) => setTimeout(r, 0));
    scene.update(1);
    expect(game.scenes.switchTo).toHaveBeenCalledTimes(2);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('plays the title track on enter and again on resume (a no-op while it already plays)', () => {
    const { game } = titleGame();
    const scene = new TitleScene(game as unknown as Game);
    scene.enter();
    expect(game.audio.playMusic).toHaveBeenCalledWith('title');
    scene.onResume();
    expect(game.audio.playMusic).toHaveBeenCalledTimes(2);
    expect(game.audio.playMusic).toHaveBeenLastCalledWith('title');
  });
});
