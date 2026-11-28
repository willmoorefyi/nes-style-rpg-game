import { describe, it, expect, beforeAll, vi } from 'vitest';
import { MagicShopScene } from '../../src/scenes/MagicShopScene.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { spellPrice, SPELL_PRICE_BY_LEVEL } from '../../src/systems/SpellPurchase.js';
import type { Game } from '../../src/core/Game.js';
import type { SpellData } from '../../src/types/index.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';
import { Character } from '../../src/entities/Character.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { learnersLine } from '../../src/scenes/shop/spellLearners.js';
import { classLabel } from '../../src/data/classLabel.js';

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
    // columns: `Name  L1  100G` (E2)
    // pass EQ: FF1's Elfland sells L3 and L4 black magic
    expect(labels.some((l) => /^SLP2 +L4 +4000G$/.test(l))).toBe(true);
    expect(labels.some((l) => /^FIR2 +L3 +1500G$/.test(l))).toBe(true);
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

  it('class labels: the classes.yaml abbr, else the full name', () => {
    expect(classLabel(ClassRegistry.getClass('white_mage')!)).toBe('WHM');
    expect(classLabel(ClassRegistry.getClass('warrior')!)).toBe('WAR');
    expect(classLabel({ name: 'Dragoon' })).toBe('Dragoon');
  });

  it('CURE: the description in the help bar, and "Learn: WHM RDM CLR RKN SCH BRD APO CLK AUT" (white and red mages, the cleric, the rune knight, the scholar, the bard, the apothecary, the clockmaker, the automaton)', () => {
    const { scene } = open(['warrior', 'white_mage']);
    expect(scene.helpText).toBe(spell('cure').description);
    expect(visibleLabels(scene.container)).toContain(spell('cure').description);
    expect(scene.learners).toEqual({ text: 'Learn: WHM RDM CLR RKN SCH BRD APO CLK AUT', greyed: false });
    expect(learnersLine(spell('cure'))).toBe('Learn: WHM RDM CLR RKN SCH BRD APO CLK AUT');
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
    expect(scene.learners).toEqual({ text: 'Learn: BLM RDM SHM WLK RKN SCH BRD APO GRV AUT', greyed: false });   // pass CB: the shaman and the warlock, black mage copies; the rune knight, the scholar, the bard, the apothecary and the automaton, red mage copies
  });

  it('upgraded classes in the party are listed when they can learn the spell (Knight and White Wizard for CURE)', () => {
    const { scene } = open(['knight', 'white_wizard', 'ninja']);
    expect(scene.learners).toEqual({ text: 'Learn: WHM RDM CLR RKN SCH BRD APO CLK AUT KNT WHW', greyed: false });
    // the Ninja learns black magic only: not listed for CURE; a Black Wizard is listed for the black shop's spells
    expect(open(['black_wizard', 'ninja'], 'cornelia_black').scene.learners).toEqual({ text: 'Learn: BLM RDM SHM WLK RKN SCH BRD APO GRV AUT NIN BLW', greyed: false });
  });

  it('an upgraded class that cannot learn the spell is not listed', () => {
    const { scene } = open(['knight', 'master']);
    expect(scene.learners.text).toBe('Learn: WHM RDM CLR RKN SCH BRD APO CLK AUT KNT');   // the Master learns no magic (pass CB: the cleric, a white mage copy, learns CURE)
  });
});

describe('E4: learning a spell takes a spell and a member, with no slot step', () => {
  function open() {
    const input = tapInput();
    const party = new PartyManager();
    const wmag = new Character({ name: 'W.MAG', classData: ClassRegistry.getClass('white_mage')! });
    wmag.learnSpell('cure', 1);
    const rmag = new Character({ name: 'R.MAG', classData: ClassRegistry.getClass('red_mage')! });
    for (const id of ['cure', 'harm', 'fog']) rmag.learnSpell(id, 1);
    const fghtr = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    for (const c of [wmag, rmag, fghtr]) party.add(c);
    party.addGold(3000);
    const game = { input, events: { emit: vi.fn() }, scenes: { pop: vi.fn() }, party };
    const scene = new MagicShopScene(game as unknown as Game, 'cornelia_white');
    scene.enter();
    const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => scene.update(1));
    return { scene, tap, party, wmag, rmag };
  }

  it('CURE, known by every member who could learn it, shows Known; the panel says who knows it', () => {
    const { scene } = open();
    expect(scene.menuItems[0].label).toMatch(/^CURE +L1 +100G +Known$/);
    expect(scene.menuItems[1].label).not.toMatch(/Known/); // HARM: the W.MAG can still learn it
    expect(scene.panelLines.some((l) => /^W\.MAG +knows$/.test(l))).toBe(true);
    expect(scene.panelLines.some((l) => /^FGHTR +n\/a$/.test(l))).toBe(true);
  });

  it('choosing a member with room buys the spell at once', () => {
    const { scene, tap, party, wmag } = open();
    tap('down'); // HARM
    tap('confirm');
    expect(scene.phase).toBe('character');
    expect(scene.menuItems.map((m) => m.enabled)).toEqual([true, false]); // W.MAG, R.MAG (knows it)
    expect(scene.menuItems[0].label).toMatch(/^W\.MAG +L1 1\/3$/);
    expect(scene.menuItems[1].label).toMatch(/^R\.MAG +L1 3\/3 +\(knows\)$/);
    tap('confirm'); // W.MAG
    expect(scene.phase).toBe('spells');
    expect(wmag.getSpellsAtLevel(1)).toContain('harm');
    expect(party.gold).toBe(2900);
    expect(scene.message).toBe('W.MAG learned HARM!');
  });

  it('a disabled (full) member cannot be chosen', () => {
    const { scene, tap, party, rmag } = open();
    tap('down');
    tap('down');
    tap('down'); // RUSE
    tap('confirm');
    expect(scene.menuItems[1]).toEqual({ label: expect.stringMatching(/^R\.MAG +L1 3\/3 +\(full\)$/), enabled: false });
    tap('down'); // R.MAG (full)
    tap('confirm');
    expect(scene.phase).toBe('character');
    expect(rmag.getSpellsAtLevel(1)).not.toContain('ruse');
    expect(party.gold).toBe(3000);
    tap('cancel');
    expect(scene.phase).toBe('spells');
  });

  it('the spell list sits where the item shop puts its list beside the panel', async () => {
    const { scene } = open();
    const { ShopScene } = await import('../../src/scenes/ShopScene.js');
    const input = tapInput();
    const shopParty = new PartyManager();
    shopParty.add(new Character({ name: 'A', classData: ClassRegistry.getClass('warrior')! }));
    const shop = new ShopScene({ input, inventory: new Inventory(), party: shopParty, events: { emit: vi.fn() },
      scenes: { pop: vi.fn() } } as unknown as Game, 'cornelia_weapon');
    shop.enter();
    input.tap('confirm', () => shop.update(1)); // Buy: the comparison panel opens
    expect(scene.listRect).toEqual(shop.itemWindowRect);
  });
});
