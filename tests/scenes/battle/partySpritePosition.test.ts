import { describe, it, expect } from 'vitest';
import { partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';

describe('partySpritePosition', () => {
  it('keeps the legacy layout unchanged for legacy art (138 px tall cells)', () => {
    const legacy = { ai: false, footRow: null, scale: 3 };
    expect([0, 1, 2, 3].map((i) => partySpritePosition(i, legacy, 138))).toEqual([
      { x: 1420, y: 335 - 138 + 5 },
      { x: 1445, y: 455 - 138 + 5 },
      { x: 1470, y: 575 - 138 + 5 },
      { x: 1495, y: 695 - 138 + 5 },
    ]);
  });

  it('places AI art by its foot row: 160 px cells inside the battle field, clear of the status boxes', () => {
    const ai = { ai: true, footRow: 76, scale: 2 };
    const pos = [0, 1, 2, 3].map((i) => partySpritePosition(i, ai, 160));
    expect(pos.map((p) => p.y)).toEqual([136, 286, 436, 586]);
    for (const p of pos) {
      expect(p.y).toBeGreaterThanOrEqual(120);
      expect(p.y + 160).toBeLessThanOrEqual(780);
      expect(p.x + 160).toBeLessThan(1700);
    }
  });
});
