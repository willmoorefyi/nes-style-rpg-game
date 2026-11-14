import { describe, it, expect, beforeAll, vi } from 'vitest';
import { MagicShopScene } from '../../src/scenes/MagicShopScene.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { spellPrice, SPELL_PRICE_BY_LEVEL } from '../../src/systems/SpellPurchase.js';
import type { Game } from '../../src/core/Game.js';
import type { SpellData } from '../../src/types/index.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { classInitials, learnersLine } from '../../src/scenes/shop/spellLearners.js';

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

describe('MS-7: the magic shop shows the description and who can learn each spell', () => {
  function open(classes: string[], shopId = 'cornelia_white') {
    const input = tapInput();
    const all = classes.map((cls, i) => new Character({ name: `M${i}`, classData: ClassRegistry.getClass(cls)! }));
    const game = { input, events: { emit: vi.fn() }, scenes: { pop: vi.fn() }, party: { gold: 5000, all } };
    const scene = new MagicShopScene(game as unknown as Game, shopId);
    scene.enter();
    const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => scene.update(1));
    return { scene, tap };
  }

  it('class initials: two-word names give their initials, one-word names their first two letters', () => {
    expect(classInitials('White Mage')).toBe('WM');
    expect(classInitials('Warrior')).toBe('Wa');
  });

  it('CURE: the description in the help bar, and "Learn: WM RM" (white and red mages)', () => {
    const { scene } = open(['warrior', 'white_mage']);
    expect(scene.helpText).toBe(spell('cure').description);
    expect(visibleLabels(scene.container)).toContain(spell('cure').description);
    expect(scene.learners).toEqual({ text: 'Learn: WM RM', greyed: false });
    expect(learnersLine(spell('cure'))).toBe('Learn: WM RM');
  });

  it('the line follows the cursor, and is greyed when nobody in the party can learn the spell', () => {
    const { scene, tap } = open(['warrior', 'thief']);
    expect(scene.learners.greyed).toBe(true);
    tap('down'); // HARM
    expect(scene.helpText).toBe(spell('harm').description);
    expect(scene.learners.text).toBe(learnersLine(spell('harm')));
    expect(scene.learners.greyed).toBe(true);
  });

  it('black magic lists the black and red mages', () => {
    const { scene } = open(['black_mage'], 'cornelia_black');
    expect(scene.learners).toEqual({ text: 'Learn: BM RM', greyed: false });
  });
});
