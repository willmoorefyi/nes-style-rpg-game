import { describe, it, expect } from 'vitest';
import { partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';

describe('partySpritePosition', () => {
  it('places 2x art by its foot row: 160 px cells inside the battle field, clear of the status boxes', () => {
    const art = { footRow: 76, scale: 2 };
    const pos = [0, 1, 2, 3].map((i) => partySpritePosition(i, art));
    expect(pos.map((p) => p.y)).toEqual([271, 376, 481, 586]); // B13: feet at 425-740
    for (const p of pos) {
      expect(p.y).toBeGreaterThanOrEqual(120);
      expect(p.y + 160).toBeLessThanOrEqual(780);
      expect(p.x + 160).toBeLessThan(1700);
    }
  });
});
