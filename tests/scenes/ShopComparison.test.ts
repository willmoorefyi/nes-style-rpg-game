import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ShopScene } from '../../src/scenes/ShopScene.js';
import type { Game } from '../../src/core/Game.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

describe('MS-2: shop comparison respects who can equip the item', () => {
  it('a mage gets "n/a" for a Rapier, a warrior gets a +/- value', () => {
    const fighter = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    const mage = new Character({ name: 'B.MAG', classData: ClassRegistry.getClass('black_mage')! });
    const input = tapInput();
    const game = {
      input,
      inventory: new Inventory(),
      party: { all: [fighter, mage], gold: 10000 },
      events: { emit: vi.fn() },
      scenes: { pop: vi.fn() },
    };
    const scene = new ShopScene(game as unknown as Game, 'cornelia_weapon');
    scene.enter();
    input.tap('confirm', () => scene.update(1)); // Buy (Nunchaku, Knife, Staff, Rapier, Hammer)
    for (let i = 0; i < 3; i++) input.tap('down', () => scene.update(1)); // to the Rapier
    scene.update(1);                              // draws the comparison panel
    const labels = visibleLabels(scene.container);
    expect(labels).toContain('B.MAG  n/a');
    expect(labels.some((l) => /^\s*\+\d+$/.test(l))).toBe(true); // the warrior's gain
    expect(labels.filter((l) => /^\s*[+-]?\d+$/.test(l))).toHaveLength(1); // only one member is compared
  });
});
