import { describe, it, expect, vi } from 'vitest';
import { NameEntryGrid, normalizeName, uniqueDefaultName } from '../../src/ui/NameEntryGrid.js';
import type { InputManager } from '../../src/core/InputManager.js';
import { tapInput } from '../helpers/realData.js';

type Key = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

function grid(defaultName = 'FGHTR') {
  const onDone = vi.fn();
  const onExit = vi.fn();
  const g = new NameEntryGrid({ defaultName, onDone, onExit });
  const input = tapInput();
  const press = (...keys: Key[]) => { for (const k of keys) input.tap(k, () => g.update(input as unknown as InputManager)); };
  return { g, onDone, onExit, press };
}

/** Moves from the top-left cell to `ch` (13 columns), then confirms. */
function typeChar(press: (...k: Key[]) => void, ch: string): void {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.- ';
  const idx = letters.indexOf(ch);
  // the cursor starts on End (bottom row, 2nd cell); 'down' wraps to the top row, 'left' to its first cell
  press('down', 'left');
  for (let i = 0; i < Math.floor(idx / 13); i++) press('down');
  for (let i = 0; i < idx % 13; i++) press('right');
  press('confirm');
}

describe('NameEntryGrid', () => {
  it('starts on End with the default pre-filled, so confirm accepts it', () => {
    const { g, onDone, press } = grid();
    expect(g.cursorCell).toBe('End');
    expect(g.value).toBe('FGHTR');
    press('confirm');
    expect(onDone).toHaveBeenCalledWith('FGHTR');
  });

  it('writes a custom name: the first letter replaces the default', () => {
    const { g, onDone, press } = grid();
    for (const ch of 'Ada') {
      typeChar(press, ch);
      // back to End: bottom row, second cell
      while (g.cursorCell !== 'End') press(g.cursorCell === 'Back' ? 'right' : 'up');
    }
    expect(g.value).toBe('Ada');
    press('confirm');
    expect(onDone).toHaveBeenCalledWith('Ada');
  });

  it('caps names at 6 characters', () => {
    const { g, press } = grid('');
    press('down', 'left'); // top-left: 'A'
    for (let i = 0; i < 8; i++) press('confirm');
    expect(g.value).toBe('AAAAAA');
  });

  it('cancel deletes a letter, then leaves the grid once the name is empty', () => {
    const { g, onExit, press } = grid('AB');
    press('cancel');
    expect(g.value).toBe('A');
    press('cancel');
    expect(g.value).toBe('');
    expect(onExit).not.toHaveBeenCalled();
    press('cancel');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('an emptied name ends as the default', () => {
    const { onDone, press } = grid('MONK');
    press('cancel', 'cancel', 'cancel', 'cancel', 'confirm');
    expect(onDone).toHaveBeenCalledWith('MONK');
  });
});

describe('name rules', () => {
  it('trims, keeps [A-Za-z0-9 .-], caps at 6, and empty means the default', () => {
    expect(normalizeName('  Bob  ', 'X')).toBe('Bob');
    expect(normalizeName('A_b!c', 'X')).toBe('Abc');
    expect(normalizeName('Abcdefgh', 'X')).toBe('Abcdef');
    expect(normalizeName('   ', 'FGHTR')).toBe('FGHTR');
    expect(normalizeName('W.M-1 ', 'X')).toBe('W.M-1');
  });

  it('default names are unique: FGHTR, FGHTR2, FGHTR3', () => {
    expect(uniqueDefaultName('FGHTR', [])).toBe('FGHTR');
    expect(uniqueDefaultName('FGHTR', ['FGHTR'])).toBe('FGHTR2');
    expect(uniqueDefaultName('FGHTR', ['FGHTR', 'FGHTR2'])).toBe('FGHTR3');
    expect(uniqueDefaultName('W.MAG', ['W.MAG'])).toBe('W.MAG2');
  });
});
