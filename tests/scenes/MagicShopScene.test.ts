import { describe, it, expect, beforeAll, vi } from 'vitest';
import { MagicShopScene } from '../../src/scenes/MagicShopScene.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { spellPrice, SPELL_PRICE_BY_LEVEL } from '../../src/systems/SpellPurchase.js';
import type { Game } from '../../src/core/Game.js';
import type { SpellData } from '../../src/types/index.js';
import { loadRealRegistries, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

const spell = (id: string): SpellData => SpellRegistry.getSpell(id)!;

describe('spellPrice (FF1 prices by spell level)', () => {
  it('LIT costs 100, ICE 400, FIR2 1500', () => {
    expect(spellPrice(spell('lit'))).toBe(100);
    expect(spellPrice(spell('ice'))).toBe(400);
    expect(spellPrice(spell('fir2'))).toBe(1500);
  });

  it('follows the FF1 table for every spell level', () => {
    expect(SPELL_PRICE_BY_LEVEL).toEqual([100, 400, 1500, 4000, 8000, 20000, 45000, 60000]);
    expect(spellPrice({ ...spell('fire'), level: 8, price: undefined })).toBe(60000);
  });

  it('a spell with an explicit price uses it', () => {
    expect(spellPrice({ ...spell('ice'), price: 250 })).toBe(250);
    expect(spellPrice({ ...spell('ice'), price: 0 })).toBe(0);
  });
});

describe('MagicShopScene prices', () => {
  it('lists Elfheim\'s black magic at the FF1 prices', () => {
    const game = {
      input: { isJustPressed: vi.fn(() => false), isPressed: vi.fn(() => false) },
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      scenes: { pop: vi.fn() },
      party: { gold: 500, all: [] },
    };
    const scene = new MagicShopScene(game as unknown as Game, 'elfheim_black');
    scene.enter();
    const labels = visibleLabels(scene.container);
    expect(labels).toContain('ICE L2 400G');
    expect(labels).toContain('FIR2 L3 1500G');
  });
});
