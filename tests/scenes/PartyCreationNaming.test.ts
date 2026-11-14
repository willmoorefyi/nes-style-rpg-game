import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PartyCreationScene } from '../../src/scenes/PartyCreationScene.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { Character } from '../../src/entities/Character.js';
import type { Game } from '../../src/core/Game.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';
import { CutsceneRegistry } from '../../src/systems/CutsceneRegistry.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { playOpening, backdropSprite, OPENING_CUTSCENE } from '../../src/scenes/partyCreation/OpeningSequence.js';
import { STAGE_COVERED_TOP } from '../../src/rendering/BattleBackground.js';
import { Texture, TextureSource } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

beforeAll(loadRealRegistries);
// Begin Adventure starts the opening fade; it never needs to finish here
vi.stubGlobal('requestAnimationFrame', () => 0);

type Key = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

function setup() {
  const input = tapInput();
  const added: Character[] = [];
  const game = {
    input,
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    scenes: { switchTo: vi.fn() },
    resetState: vi.fn(),
    gameFlags: new GameFlags(),
    party: { add: (c: Character) => { added.push(c); return true; }, addGold: vi.fn(), get all() { return added; } },
  };
  const scene = new PartyCreationScene(game as unknown as Game);
  scene.enter();
  const press = (...keys: Key[]) => { for (const k of keys) input.tap(k, () => scene.update(1)); };
  return { scene, press, added, game };
}

// class menu: Warrior is first; on the name grid the cursor starts on End
const pickWarriorDefault = (press: (...k: Key[]) => void) => press('confirm', 'confirm');

describe('NG-3: party creation names', () => {
  it('two Warriors get unique default names (FGHTR, FGHTR2)', () => {
    const { press, added } = setup();
    for (let i = 0; i < 4; i++) pickWarriorDefault(press);
    press('confirm'); // Begin Adventure
    expect(added.map((c) => c.name)).toEqual(['FGHTR', 'FGHTR2', 'FGHTR3', 'FGHTR4']);
  });

  it('a name typed on the grid is the character\'s name, and shows in the slots and the summary', () => {
    const { scene, press, added } = setup();
    press('confirm');                          // Warrior
    press('down', 'left', 'left', 'confirm');  // End is over '3', so down wraps to 'D'; 'B' replaces the default
    press('up', 'right');                      // wraps to Back (under 'B'), then End
    press('confirm');
    expect(visibleLabels(scene.container)).toContain('1:B WAR');
    for (let i = 0; i < 3; i++) pickWarriorDefault(press);
    expect(visibleLabels(scene.container).some((l) => l.startsWith('B  Warrior'))).toBe(true);
    press('confirm');
    expect(added.map((c) => c.name)).toEqual(['B', 'FGHTR', 'FGHTR2', 'FGHTR3']);
  });

  it('every Back path drops the name with its class', () => {
    const { scene, press, added } = setup();
    for (let i = 0; i < 4; i++) pickWarriorDefault(press);
    press('cancel');                 // confirm screen -> back to slot 4's class
    expect(visibleLabels(scene.container)).toContain('4:----');
    press('cancel');                 // class select -> drop slot 3 too
    expect(visibleLabels(scene.container)).toContain('3:----');
    press('confirm');                // Warrior again
    press('cancel', 'cancel', 'cancel', 'cancel', 'cancel', 'cancel', 'cancel'); // empty the name, then leave the grid
    expect(visibleLabels(scene.container).some((l) => l.startsWith('Choose class for slot 3'))).toBe(true);
    pickWarriorDefault(press);
    pickWarriorDefault(press);
    press('confirm');
    expect(added.map((c) => c.name)).toEqual(['FGHTR', 'FGHTR2', 'FGHTR3', 'FGHTR4']);
  });
});

describe('N1: the class menu keeps its place, and the strip shows the classes', () => {
  it('cancelling the empty name grid returns to the class just picked (Black Mage, index 4)', () => {
    const { scene, press } = setup();
    press('down', 'down', 'down', 'down');
    expect(scene.classIndex).toBe(4);
    press('confirm');                                     // Black Mage
    press('cancel', 'cancel', 'cancel', 'cancel', 'cancel', 'cancel'); // B.MAG emptied, then leave the grid
    expect(scene.classIndex).toBe(4);
  });

  it('Back from the confirm screen opens slot 4 on the class it had', () => {
    const { scene, press } = setup();
    for (let i = 0; i < 3; i++) pickWarriorDefault(press);
    press('down', 'confirm', 'confirm');                  // slot 4: Thief
    press('cancel');                                      // confirm -> back to slot 4
    expect(scene.classIndex).toBe(1);
  });

  it('the strip shows each named member with its class abbreviation, and the slot being named with the name so far', () => {
    const { scene, press } = setup();
    pickWarriorDefault(press);
    expect(visibleLabels(scene.container)).toContain('1:FGHTR WAR');
    press('down', 'down', 'down', 'confirm');             // White Mage, now naming slot 2 (default W.MAG)
    expect(visibleLabels(scene.container)).toContain('2:W.MAG WHM');
    expect(visibleLabels(scene.container).some((l) => l.includes('?'))).toBe(false);
    expect(visibleLabels(scene.container)).toContain('3:----');
    press('cancel');                                      // one letter erased
    expect(visibleLabels(scene.container)).toContain('2:W.MA WHM');
    press('cancel', 'cancel', 'cancel', 'cancel');        // empty
    expect(visibleLabels(scene.container)).toContain('2:---- WHM');
  });

  it('every class in classes.yaml has a 3-letter upper-case abbreviation, all different', () => {
    const all = ClassRegistry.getAll();
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) expect(c.abbr, c.id).toMatch(/^[A-Z]{3}$/);
    expect(new Set(all.map((c) => c.abbr)).size).toBe(all.length);
  });
});

describe('N2: the opening backdrop covers the screen without the staged top band', () => {
  it('a 1920x1080 staged image starts at its row 120 (no flat band) and still covers 1920x1080', () => {
    const sprite = backdropSprite(new Texture({ source: new TextureSource({ width: 1920, height: 1080 }) }));
    const b = sprite.getBounds();
    expect(b.x).toBeLessThanOrEqual(0);
    expect(b.y + STAGE_COVERED_TOP * sprite.scale.y).toBeCloseTo(0, 0); // image row 120 at the screen's top
    expect(b.x + b.width).toBeGreaterThanOrEqual(1920);
    expect(b.y + b.height).toBeGreaterThanOrEqual(1080);
    expect(sprite.scale.x).toBe(sprite.scale.y);                         // not stretched
  });

  it('the cut matches the stager\'s uncovered band (stage_backgrounds.py FIELD_TOP)', () => {
    const py = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../assets-src/tools/stage_backgrounds.py'), 'utf8');
    expect(Number(/^FIELD_TOP = (\d+)/m.exec(py)?.[1])).toBe(STAGE_COVERED_TOP);
  });
});

describe('N2: the opening plays from cutscenes.yaml', () => {
  it('finishing the party plays the registry\'s opening', () => {
    const get = vi.spyOn(CutsceneRegistry, 'get');
    const { press } = setup();
    for (let i = 0; i < 4; i++) pickWarriorDefault(press);
    press('confirm');                                     // Begin Adventure
    expect(get).toHaveBeenCalledWith(OPENING_CUTSCENE);
    get.mockRestore();
  });

  it('backdrop steps reach the backdrop dep in order (dark_forest, grassland, null); dialog goes to showDialog', async () => {
    const calls: Array<string | null> = [];
    const dialogs: string[] = [];
    await playOpening({
      showDialog: async (t) => { dialogs.push(t); },
      fadeOut: async () => undefined,
      fadeIn: async () => undefined,
      backdrop: async (image) => { calls.push(image); },
      flags: new GameFlags(),
      party: [],
    }, [
      { type: 'backdrop', image: 'dark_forest' },
      { type: 'dialog', text: 'one' },
      { type: 'backdrop', image: 'grassland' },
      { type: 'dialog', text: 'two' },
      { type: 'backdrop', image: null },
    ]);
    expect(calls).toEqual(['dark_forest', 'grassland', null]);
    expect(dialogs).toEqual(['one', 'two']);
  });

  it('a missing opening logs an error and goes on', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const backdrop = vi.fn(async () => undefined);
    await playOpening({ showDialog: async () => undefined, fadeOut: async () => undefined, fadeIn: async () => undefined,
      backdrop, flags: new GameFlags(), party: [] }, undefined);
    expect(err).toHaveBeenCalled();
    expect(backdrop).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('no opening text is hardcoded in the scene or the sequence', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/scenes');
    for (const f of ['PartyCreationScene.ts', 'partyCreation/OpeningSequence.ts']) {
      const src = readFileSync(resolve(root, f), 'utf-8');
      expect(src, f).not.toMatch(/darkness|prophecy|Warriors of Light|type: 'dialog'/);
    }
  });
});
