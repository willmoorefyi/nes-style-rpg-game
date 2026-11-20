/**
 * Pass CHT: the Boosts screen (up / down move, left / right change, confirm cycles, cancel closes) and the field menu's
 * indicator of the boosts off their defaults.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { BoostsScene } from '../../src/scenes/BoostsScene.js';
import { FieldMenuScene } from '../../src/scenes/FieldMenuScene.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import type { Game } from '../../src/core/Game.js';
import { DEFAULT_BOOSTS, defaultBoosts, type Boosts } from '../../src/core/Boosts.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

function open(boosts: Boosts = defaultBoosts()) {
  const game = { input: tapInput(), boosts, scenes: { pop: vi.fn(() => Promise.resolve()) } };
  const scene = new BoostsScene(game as unknown as Game);
  scene.enter();
  const tap = (a: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel', n = 1) => {
    for (let i = 0; i < n; i++) game.input.tap(a, () => scene.update(1));
  };
  return { scene, game, tap };
}

describe('BoostsScene', () => {
  it('lists the six rows with their values; the cursor starts on Gold with its help line', () => {
    const { scene } = open();
    const labels = visibleLabels(scene.container);
    for (const l of ['Boosts', 'Gold', 'Experience', 'Encounters', 'Battle speed', 'Walk speed', 'Escape']) {
      expect(labels).toContain(l);
    }
    expect(scene.valueLines).toEqual(['< x1 >', '< x1 >', '< x1 >', '< x1 >', '< x1 >', '< Off >']);
    expect(scene.selectedKey).toBe('gold');
    expect(scene.helpLine).toContain('Gold won in battle');
    expect(scene.statusLine).toBe('All at normal.');
  });

  it('right / left change the highlighted value at once and stop at the ends', () => {
    const { scene, game, tap } = open();
    tap('right');
    expect(game.boosts.gold).toBe(2);
    tap('right', 5);
    expect(game.boosts.gold).toBe(4);
    expect(scene.valueLines[0]).toBe('< x4 >');
    tap('left', 9);
    expect(game.boosts.gold).toBe(0);
    expect(scene.valueLines[0]).toBe('< x0 >');
    expect(scene.statusLine).toContain('Boosts on');
  });

  it('down moves to each row in turn; every row changes only its own value', () => {
    const { scene, game, tap } = open();
    tap('down');
    expect(scene.selectedKey).toBe('xp');
    expect(scene.helpLine).toContain('Experience');
    tap('left');
    tap('down');
    tap('left', 3);                   // Encounters: x1 -> x0.5 -> Off, then stops
    tap('down');
    tap('right', 2);                  // Battle speed x4
    tap('down');
    tap('right');                     // Walk speed x2
    tap('down');
    tap('right');                     // Escape On
    expect(game.boosts).toEqual({ gold: 1, xp: 0.5, encounters: 0, battleSpeed: 4, walkSpeed: 2, alwaysEscape: true });
    expect(scene.valueLines).toEqual(['< x1 >', '< x0.5 >', '< Off >', '< x4 >', '< x2 >', '< On >']);
    tap('down');
    expect(scene.selectedKey).toBe('gold'); // wraps to the top
  });

  it('confirm steps the value forward and wraps past the last', () => {
    const { game, tap } = open();
    tap('down', 5);
    tap('confirm');
    expect(game.boosts.alwaysEscape).toBe(true);
    tap('confirm');
    expect(game.boosts.alwaysEscape).toBe(false);
    tap('up', 2);                     // Battle speed
    tap('confirm', 3);
    expect(game.boosts.battleSpeed).toBe(1);
  });

  it('cancel closes the screen once; later presses do nothing', () => {
    const { game, tap } = open();
    tap('cancel');
    expect(game.scenes.pop).toHaveBeenCalledTimes(1);
    tap('cancel');
    tap('right');
    expect(game.scenes.pop).toHaveBeenCalledTimes(1);
    expect(game.boosts).toEqual(DEFAULT_BOOSTS);
  });

  it('re-entering starts on the first row again and shows the current values', () => {
    const { scene, game, tap } = open();
    tap('down', 2);
    game.boosts = { ...game.boosts, encounters: 2 };
    scene.enter();
    expect(scene.selectedKey).toBe('gold');
    expect(scene.valueLines[2]).toBe('< x2 >');
  });
});

describe('the field menu shows when boosts are on', () => {
  function menu(boosts: Boosts) {
    const exploration = { canSave: () => true, getMapName: () => 'Cornelia' };
    const game = { party: new PartyManager(), playTime: 0, boosts, input: tapInput(),
      scenes: { get: vi.fn(() => exploration), push: vi.fn(), pop: vi.fn() } };
    const scene = new FieldMenuScene(game as unknown as Game);
    scene.enter();
    return { scene, game };
  }

  it('no indicator at the defaults', () => {
    const { scene } = menu(defaultBoosts());
    expect(visibleLabels(scene.container).some((l) => l.startsWith('BOOST'))).toBe(false);
  });

  it('the party panel names the boosts off their defaults, and follows a change made in the Boosts screen', () => {
    const { scene, game } = menu({ ...defaultBoosts(), gold: 4, encounters: 0 });
    expect(visibleLabels(scene.container)).toContain('BOOST G x4 ENC Off');
    game.boosts = defaultBoosts();
    scene.onPause();
    scene.onResume();
    expect(visibleLabels(scene.container).some((l) => l.startsWith('BOOST'))).toBe(false);
  });
});
