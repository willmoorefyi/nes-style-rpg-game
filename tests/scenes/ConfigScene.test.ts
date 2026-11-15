/** Pass F item 6 (docs/FEEDBACK_PLAN_2026-11-14.md §3.6): the Config screen sets and persists the message speed. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigScene, SAMPLE_LINES, speedRow } from '../../src/scenes/ConfigScene.js';
import { SETTINGS_KEY, getSettings, resetSettingsCache } from '../../src/core/Settings.js';
import { RESULT_FRAMES, holdFrames } from '../../src/scenes/battle/battleTiming.js';
import type { Game } from '../../src/core/Game.js';
import { tapInput } from '../helpers/realData.js';

function memoryStore(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, removeItem: vi.fn(), clear: vi.fn() };
}

function open() {
  const game = { input: tapInput(), scenes: { pop: vi.fn(() => Promise.resolve()) } };
  const scene = new ConfigScene(game as unknown as Game);
  scene.enter();
  return { scene, game };
}

beforeEach(() => { resetSettingsCache(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); resetSettingsCache(); });

describe('ConfigScene: message speed 1-5', () => {
  it('shows "1 2 [3] 4 5" at the default speed (3)', () => {
    vi.stubGlobal('localStorage', memoryStore());
    const { scene } = open();
    expect(speedRow(3)).toBe(' 1  2 [3] 4  5 ');
    expect(scene.speedLine).toContain('[3]');
  });

  it('right / left change the speed, clamp at 1 and 5, and write it through to localStorage', () => {
    const store = memoryStore();
    vi.stubGlobal('localStorage', store);
    const { scene, game } = open();
    game.input.tap('right', () => scene.update(1));
    expect(getSettings().messageSpeed).toBe(4);
    expect(scene.speedLine).toContain('[4]');
    expect(JSON.parse(store.data[SETTINGS_KEY])).toEqual({ messageSpeed: 4 });
    for (let i = 0; i < 3; i++) game.input.tap('right', () => scene.update(1));
    expect(getSettings().messageSpeed).toBe(5);
    for (let i = 0; i < 6; i++) game.input.tap('left', () => scene.update(1));
    expect(getSettings().messageSpeed).toBe(1);
    // persisted: a fresh read (a new session) gets it back
    resetSettingsCache();
    expect(getSettings().messageSpeed).toBe(1);
  });

  it('the sample line changes after one result-line hold at the chosen speed', () => {
    vi.stubGlobal('localStorage', memoryStore());
    const { scene, game } = open();
    game.input.tap('left', () => scene.update(1));      // speed 2; restarts the sample timer
    expect(scene.sampleLine).toBe(SAMPLE_LINES[0]);
    for (let i = 0; i < holdFrames(RESULT_FRAMES, 2) - 1; i++) scene.update(1);
    expect(scene.sampleLine).toBe(SAMPLE_LINES[0]);
    scene.update(1);
    expect(scene.sampleLine).toBe(SAMPLE_LINES[1]);
  });

  it('confirm and cancel close the screen', () => {
    vi.stubGlobal('localStorage', memoryStore());
    for (const key of ['confirm', 'cancel'] as const) {
      const { scene, game } = open();
      game.input.tap(key, () => scene.update(1));
      expect(game.scenes.pop).toHaveBeenCalledTimes(1);
      scene.update(1);
      expect(game.scenes.pop).toHaveBeenCalledTimes(1);
    }
  });

  it('an unreadable store warns once and uses speed 3', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: vi.fn() });
    const { scene } = open();
    expect(scene.speedLine).toContain('[3]');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
