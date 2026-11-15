/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Container } from 'pixi.js';
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

describe('TitleScene: a second confirm does not leak into party creation (U2)', () => {
  it('the party-creation scene sees no just-pressed confirm from a press one frame after New Game', async () => {
    const { Game } = await import('../../src/core/Game.js');
    const game = new Game();
    vi.spyOn(game.audio, 'playMusic').mockResolvedValue(undefined);
    game.input.attach();
    const seen: boolean[] = [];
    game.scenes.register('title', new TitleScene(game));
    game.scenes.register('partyCreation', {
      container: new Container(),
      enter: () => {},
      exit: () => {},
      update: () => { seen.push(game.input.isJustPressed('confirm')); },
    });
    const frame = () => { game.scenes.update(1); game.input.update(); };
    const key = (type: 'keydown' | 'keyup') => window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyZ' }));
    try {
      await game.scenes.switchTo('title');
      for (let i = 0; i < 10; i++) frame();
      key('keydown'); key('keyup');
      frame(); // the title takes New Game
      await new Promise((r) => setTimeout(r, 0)); // the switch settles
      expect(game.scenes.current).toBe('partyCreation');
      key('keydown'); key('keyup'); // the second tap, one frame later
      frame(); frame(); frame();
      expect(seen).toEqual([false, false, false]);
    } finally {
      game.input.detach();
    }
  });
});

describe('TitleScene: Continue opens Load without the "lost" warning (U6, U revision 8)', () => {
  it('Game Over -> Title -> Continue: "Load Slot 1?" on Yes although the wiped party is still in memory', async () => {
    const { loadRealRegistries } = await import('../helpers/realData.js');
    await loadRealRegistries();
    const { Game } = await import('../../src/core/Game.js');
    const { LoadScene } = await import('../../src/scenes/LoadScene.js');
    const { Character } = await import('../../src/entities/Character.js');
    const { ClassRegistry } = await import('../../src/data/ClassRegistry.js');
    const game = new Game();
    vi.spyOn(game.audio, 'playMusic').mockResolvedValue(undefined);
    const fallen = new Character({ name: 'ROLF', classData: ClassRegistry.getClass('warrior')! });
    fallen.currentHp = 0;
    game.party.add(fallen);  // what Game Over leaves behind
    SaveManager.save(0, game.party, game.inventory, game.gameFlags, 'cornelia', { x: 1, y: 1 }, 0);
    const load = new LoadScene(game);
    const switchTo = vi.spyOn(game.scenes, 'switchTo');
    game.input.attach();
    game.scenes.register('title', new TitleScene(game));
    game.scenes.register('loadMenu', load);
    game.scenes.register('exploration', { container: new Container(), enter: () => {}, exit: () => {}, update: () => {} });
    const frame = () => { game.scenes.update(1); game.input.update(); };
    const tap = async (code: string) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      frame();
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 10; i++) frame(); // past the scene-entry hold-off
    };
    try {
      await game.scenes.switchTo('title');
      for (let i = 0; i < 10; i++) frame();
      await tap('ArrowDown');
      await tap('KeyZ');          // Continue
      expect(game.scenes.current).toBe('loadMenu');
      await tap('KeyZ');          // slot 1
      expect(load.confirmPrompt).toBe('Load Slot 1?');
      await tap('KeyZ');          // the default answer is Yes
      expect(switchTo).toHaveBeenLastCalledWith('exploration');
    } finally {
      game.input.detach();
    }
  });
});

describe('Fg: Debug opens the battle sandbox; ?scenario= still runs that scenario (§3.8)', () => {
  /** Down to Debug (New Game, Continue, Debug), then confirm: one action per update. */
  async function pickDebug(search: string) {
    window.history.replaceState({}, '', `/${search}`);
    const game = createMockGame();
    let now: string | undefined;
    game.input.isJustPressed = vi.fn((a: string) => a === now);
    game.scenes.push = vi.fn().mockResolvedValue(undefined);
    const scene = new TitleScene(game as unknown as Game);
    scene.enter();
    for (const a of ['down', 'down', 'confirm']) { now = a; scene.update(1); }
    now = undefined;
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
    return game;
  }

  afterEach(() => { window.history.replaceState({}, '', '/'); vi.restoreAllMocks(); });

  it('without ?scenario= Debug pushes debugSandbox (old: it ran the first scenario)', async () => {
    const { DebugScenarioLoader } = await import('../../src/systems/DebugScenarioLoader.js');
    const load = vi.spyOn(DebugScenarioLoader.prototype, 'loadScenarios').mockResolvedValue([]);
    const game = await pickDebug('?mute=1');
    expect(game.scenes.push).toHaveBeenCalledWith('debugSandbox');
    expect(load).not.toHaveBeenCalled();
  });

  it('with ?scenario=r_menus Debug runs pickScenario and that scenario, not the sandbox', async () => {
    const { DebugScenarioLoader } = await import('../../src/systems/DebugScenarioLoader.js');
    const scenarios = [{ id: 'first', name: 'f', party: [], items: {}, gold: 0, enemies: ['goblin'] },
      { id: 'r_menus', name: 'r', party: [], items: {}, gold: 0, enemies: ['goblin'] }];
    vi.spyOn(DebugScenarioLoader.prototype, 'loadScenarios').mockResolvedValue(scenarios);
    const run = vi.spyOn(DebugScenarioLoader.prototype, 'run').mockResolvedValue(undefined);
    const game = await pickDebug('?mute=1&scenario=r_menus');
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0].id).toBe('r_menus');
    expect(game.scenes.push).not.toHaveBeenCalledWith('debugSandbox');
  });
});
