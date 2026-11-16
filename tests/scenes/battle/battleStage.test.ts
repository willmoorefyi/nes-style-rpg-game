import { describe, it, expect } from 'vitest';
import { partySpritePosition, PARTY_FEET_Y } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { computeEnemyLayoutAi, STAGE_FEET, type EnemySizeClass } from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { STRIP_Y } from '../../../src/scenes/battle/BattleSceneTypes.js';

/** docs/ART_BATTLE_PLAN.md: every actor's feet on the battle plain (y 360-745, B13); tops below the message window (120). */
const FIELD_TOP = 120;
const BOX: Record<EnemySizeClass, number> = { small: 160, large: 256, huge: 384, boss: 400, titan: 600 };

describe('battle stage rules', () => {
  it('party feet stand on the plain and heads stay below the message window', () => {
    const art = { footRow: 76, scale: 2 };
    PARTY_FEET_Y.forEach((feet, i) => {
      expect(feet).toBeGreaterThanOrEqual(STAGE_FEET.min);
      expect(feet).toBeLessThanOrEqual(STAGE_FEET.max);
      expect(feet).toBeLessThanOrEqual(STRIP_Y - 35); // B13: the B.MAG's feet too (old: 770)
      const p = partySpritePosition(i, art);
      expect(p.y).toBeGreaterThanOrEqual(FIELD_TOP);
      expect(p.y + (art.footRow + 1) * art.scale).toBe(feet);
    });
  });

  it('enemy feet stand on the plain for every composition up to 9 enemies (at most one boss)', () => {
    for (let bosses = 0; bosses <= 1; bosses++) {
      for (let large = 0; large <= 9 - bosses; large++) {
        for (let small = 0; small <= 9 - bosses - large; small++) {
          const input = [
            ...Array.from({ length: bosses }, () => 'boss' as const),
            ...Array.from({ length: large }, () => 'large' as const),
            ...Array.from({ length: small }, () => 'small' as const),
          ].map((size) => ({ size, w: BOX[size], h: BOX[size] }));
          if (input.length === 0) continue;
          for (const b of computeEnemyLayoutAi(input)) {
            const at = `${bosses}b ${large}l ${small}s`;
            expect(b.feetY, at).toBeGreaterThanOrEqual(STAGE_FEET.min);
            expect(b.feetY, at).toBeLessThanOrEqual(STAGE_FEET.max);
            expect(b.feetY, at).toBeLessThanOrEqual(STRIP_Y - 35); // B13: ground under the lowest feet (old: 770)
            expect(b.feetY - b.h, at).toBeGreaterThanOrEqual(FIELD_TOP);
          }
        }
      }
    }
  });
});
