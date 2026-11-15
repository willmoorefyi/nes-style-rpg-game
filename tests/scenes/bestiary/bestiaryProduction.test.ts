/**
 * @vitest-environment jsdom
 *
 * Fh test 8 (docs/BESTIARY_PLAN.md R9): in production the title has no Bestiary item and no deep link; the field
 * menu keeps its Bestiary row (the scene ships in every build; `npm run build` + the dist grep check that part).
 */
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { TitleScene } from '../../../src/scenes/TitleScene.js';
import { FieldMenuScene } from '../../../src/scenes/FieldMenuScene.js';
import { bestiaryDeepLink, resetBestiaryDeepLink } from '../../../src/scenes/bestiary/bestiaryLink.js';
import { PartyManager } from '../../../src/entities/PartyManager.js';
import type { Game } from '../../../src/core/Game.js';
import { createMockGame } from '../../helpers/testUtils.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../../helpers/realData.js';

beforeAll(loadRealRegistries);

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() } });

afterEach(() => {
  vi.unstubAllEnvs();
  resetBestiaryDeepLink();
  window.history.replaceState({}, '', '/');
});

describe('bestiary in production', () => {
  it('the title has no Bestiary item and ?bestiary= does nothing', () => {
    vi.stubEnv('DEV', false);
    window.history.replaceState({}, '', '/?bestiary=garland');
    const game = createMockGame();
    const scene = new TitleScene(game as unknown as Game);
    scene.enter();
    const labels = visibleLabels(scene.container);
    expect(labels).not.toContain('Bestiary');
    expect(labels).not.toContain('Debug');
    expect(game.scenes.push).not.toHaveBeenCalled();
    expect(bestiaryDeepLink('?bestiary=garland')).toBeNull();
  });

  it('the field menu still has the Bestiary row', () => {
    vi.stubEnv('DEV', false);
    const explorationScene = { canSave: vi.fn().mockReturnValue(true), getMapName: vi.fn().mockReturnValue('Cornelia') };
    const game = { party: new PartyManager(), playTime: 0, input: tapInput(),
      scenes: { get: vi.fn().mockReturnValue(explorationScene), push: vi.fn(), pop: vi.fn() } };
    const scene = new FieldMenuScene(game as unknown as Game);
    scene.enter();
    expect(visibleLabels(scene.container)).toContain('Bestiary');
  });

  it('in dev the deep link reads the id', () => {
    expect(bestiaryDeepLink('?mute=1&bestiary=garland')).toBe('garland');
    expect(bestiaryDeepLink('?mute=1')).toBeNull();
  });
});
