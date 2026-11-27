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

  it('pass CL: an oversize hero is placed by its body box: in every slot its body lands on an 80 x 80 hero\'s cell', () => {
    const small = { footRow: 76, scale: 2 };
    const lance = { footRow: 140, scale: 2, body: { x: 72, y: 64 } };
    for (const i of [0, 1, 2, 3]) {
      const a = partySpritePosition(i, small), b = partySpritePosition(i, lance);
      expect({ x: b.x + 72 * 2, y: b.y + 64 * 2 }, `slot ${i}`).toEqual(a);
      expect(b.y + (140 + 1) * 2, `slot ${i} feet`).toBe(a.y + (76 + 1) * 2);
    }
  });
});
