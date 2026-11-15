import { describe, it, expect, vi } from 'vitest';
import { Menu } from '../../src/ui/Menu.js';
import { FieldMenuScene } from '../../src/scenes/FieldMenuScene.js';
import type { Game } from '../../src/core/Game.js';
import type { InputManager } from '../../src/core/InputManager.js';
import { allTexts, tapInput } from '../helpers/realData.js';
import { PartyManager } from '../../src/entities/PartyManager.js';

const GREY = 0x808080;
const WHITE = 0xffffff;
const fillOf = (root: Parameters<typeof allTexts>[0], label: string) =>
  allTexts(root).find((t) => t.text === label)?.style.fill;

describe('MS-4: Menu.setItemEnabled redraws the item', () => {
  it('a disabled item turns grey and an enabled one white, and the enabled state gates selection', () => {
    const onSelect = vi.fn();
    const menu = new Menu({ items: [{ label: 'Save', value: 'save', enabled: false }], onSelect });
    expect(fillOf(menu, 'Save')).toBe(GREY);
    menu.setItemEnabled(0, true);
    expect(fillOf(menu, 'Save')).toBe(WHITE);
    menu.setItemEnabled(0, false);
    expect(fillOf(menu, 'Save')).toBe(GREY);
    const input = tapInput();
    input.tap('confirm', () => menu.update(input as unknown as InputManager));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('MS-4: Save is drawn enabled where the map allows saving', () => {
  function menuFor(canSave: boolean) {
    const input = tapInput();
    const game = {
      input,
      party: new PartyManager(),
      playTime: 0,
      scenes: { get: vi.fn(() => ({ canSave: () => canSave, getMapName: () => '' })), push: vi.fn(), pop: vi.fn() },
    };
    const scene = new FieldMenuScene(game as unknown as Game);
    scene.enter();
    return { scene, game };
  }

  it('town and castle maps (canSave true/default): Save is white and opens the save menu', () => {
    const { scene, game } = menuFor(true);
    expect(fillOf(scene.container, 'Save')).toBe(WHITE);
    const input = game.input;
    for (let i = 0; i < 6; i++) input.tap('down', () => scene.update(1));   // Save is 6 down (after Order and Bestiary, Fh)
    input.tap('confirm', () => scene.update(1));
    expect(game.scenes.push).toHaveBeenCalledWith('saveMenu');
  });

  it('the Temple (canSave false): Save is grey', () => {
    const { scene } = menuFor(false);
    expect(fillOf(scene.container, 'Save')).toBe(GREY);
  });

  it('re-entering on a different map redraws the Save item', () => {
    let allowed = false;
    const game = {
      input: tapInput(),
      party: new PartyManager(),
      playTime: 0,
      scenes: { get: vi.fn(() => ({ canSave: () => allowed, getMapName: () => '' })), push: vi.fn(), pop: vi.fn() },
    };
    const scene = new FieldMenuScene(game as unknown as Game);
    scene.enter();
    expect(fillOf(scene.container, 'Save')).toBe(GREY);
    allowed = true;
    scene.enter();
    expect(fillOf(scene.container, 'Save')).toBe(WHITE);
  });
});
