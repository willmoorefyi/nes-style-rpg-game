/**
 * C6-11 (docs/CHAOS_FIX_PLAN.md 5.10, D-C7-16): inside one `ActionNumbers.spawn` call (one action's damage events), a
 * later number whose box meets an earlier one moves sideways by its width + 8 px (x+, or x- past the screen edge), so
 * the slam's numbers on two adjacent heroes, a FIR2 / HEAL on the whole party and an all-enemy spell never overlap.
 * A single number keeps its place (the R28 floatingNumberPlacement pins).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { DamageEvent } from '../../../src/battle/BattleStateMachine.js';
import { FLOAT_FONT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { colossusBattle, colossusEnemy, installFixtureArt } from '../../helpers/colossusFixture.js';
import { floatsIn } from '../../helpers/battleLayers.js';
import { testEnemy } from '../../helpers/testUtils.js';

let uninstall: () => void = () => {};
beforeEach(async () => { uninstall = await installFixtureArt(); });
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

interface Box { x0: number; y0: number; x1: number; y1: number }
const ev = (targetId: string, damage: number, isHeal = false): DamageEvent => ({ targetId, damage, isHeal, isCrit: false });

function boxes(main: Parameters<typeof floatsIn>[0]): Box[] {
  return floatsIn(main).map((t) => ({ x0: t.x, y0: t.y, x1: t.x + t.text.length * FLOAT_FONT * 0.6, y1: t.y + FLOAT_FONT }));
}
const meets = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
function overlaps(bs: Box[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (meets(bs[i], bs[j])) out.push(`${i}x${j} ${JSON.stringify([bs[i], bs[j]])}`);
  return out;
}

describe('one spawn call: no two numbers overlap (C6-11)', () => {
  it('the slam on KNGT and NINJ (the two front heroes, 20 px apart as measured in C6 slam_004): 324 and 165 do not meet', () => {
    const s = colossusBattle([colossusEnemy()], 4);
    const [kngt, ninj] = s.display.partySprites;
    ninj.position.set(kngt.x + 45, kngt.y + 20);
    s.ctrl.spawnFloatingTextsFromEvents([ev('party_0', 324), ev('party_1', 165)]);
    const bs = boxes(s.main);
    expect(bs).toHaveLength(2);
    expect(overlaps(bs)).toEqual([]);
  });

  it('a FIR2 on the whole party (4 numbers) and a HEAL on the party: no boxes meet, all on screen', () => {
    for (const heal of [false, true]) {
      const s = colossusBattle([colossusEnemy()], 4);
      s.ctrl.spawnFloatingTextsFromEvents([0, 1, 2, 3].map((i) => ev(`party_${i}`, 999 - i * 111, heal)));
      const bs = boxes(s.main);
      expect(bs).toHaveLength(4);
      expect(overlaps(bs), `heal ${heal}`).toEqual([]);
      for (const b of bs) { expect(b.x0).toBeGreaterThanOrEqual(0); expect(b.x1).toBeLessThanOrEqual(1920); }
    }
  });

  it('two hits on one target in one action stand side by side', () => {
    const s = colossusBattle([colossusEnemy()], 2);
    s.ctrl.spawnFloatingTextsFromEvents([ev('enemy_0', 555), ev('enemy_0', 432)]);
    const [a, b] = boxes(s.main);
    expect(overlaps([a, b])).toEqual([]);
    expect(b.x0 - a.x0).toBe(Math.round(3 * FLOAT_FONT * 0.6 + 8));
  });

  it('a number past the right edge moves left instead', () => {
    const s = colossusBattle([colossusEnemy()], 2);
    const hero = s.display.partySprites[0];
    hero.x = 1920 - 60;
    s.ctrl.spawnFloatingTextsFromEvents([ev('party_0', 555), ev('party_0', 432)]);
    const [a, b] = boxes(s.main);
    expect(overlaps([a, b])).toEqual([]);
    expect(b.x0).toBeLessThan(a.x0);
  });

  it('separate spawn calls are not moved (only one action\'s numbers are separated)', () => {
    const s = colossusBattle([testEnemy({ id: 'goblin', name: 'Goblin' })], 2);
    s.ctrl.spawnFloatingTextsFromEvents([ev('enemy_0', 12)]);
    s.ctrl.spawnFloatingTextsFromEvents([ev('enemy_0', 34)]);
    const [a, b] = boxes(s.main);
    expect(a.x0).toBe(b.x0);
  });
});
