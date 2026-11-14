import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PartyCreationScene } from '../../src/scenes/PartyCreationScene.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import type { Character } from '../../src/entities/Character.js';
import type { Game } from '../../src/core/Game.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

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
    press('down', 'left', 'right', 'confirm'); // 'B' replaces the default
    press('up');                               // wraps to End
    press('confirm');
    expect(visibleLabels(scene.container)).toContain('1:B');
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
