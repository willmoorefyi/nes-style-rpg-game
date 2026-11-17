/**
 * C6-4 (docs/CHAOS_FIX_PLAN.md 5.5, D-C7-12): a damage number on a colossus target (the black F3 / F4 disc) gets a
 * light 3 px outline (0xf8f8f8) and the brighter crit red (0xff6a6a); a number on an atlas enemy keeps the dark
 * outline (0x101018) and the crit 0xff4444.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { OutlinedText } from '../../../src/ui/NESFont.js';
import { colossusAt } from '../../../src/scenes/battle/colossus/colossusProxy.js';
import { FLOAT_COLORS, FLOAT_CRIT_ON_DARK, FLOAT_OUTLINE, FLOAT_OUTLINE_LIGHT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { colossusBattle, installFixtureArt } from '../../helpers/colossusFixture.js';
import { floatsIn } from '../../helpers/battleLayers.js';
import { testEnemy } from '../../helpers/testUtils.js';

let uninstall: () => void = () => {};
beforeEach(async () => { uninstall = await installFixtureArt(); });
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

const fillOf = (t: { style: { fill: unknown } }): number => {
  const f = t.style.fill as number | { color?: number };
  return typeof f === 'number' ? f : (f as { color: number }).color;
};
const outlineOf = (n: OutlinedText): number[] => [...new Set(n.shadows.map(fillOf))];
const widthOf = (n: OutlinedText): number => Math.max(...n.shadows.map((s) => Math.abs(s.x)));

describe('colossus damage numbers (C6-4)', () => {
  it('the constants: a light outline and a brighter crit for the dark disc', () => {
    expect(FLOAT_OUTLINE_LIGHT).toBe(0xf8f8f8);
    expect(FLOAT_CRIT_ON_DARK).toBe(0xff6a6a);
  });

  it('a hit and a crit on a colossus: outline 0xf8f8f8 at 3 px, the crit drawn 0xff6a6a', () => {
    const s = colossusBattle();
    expect(colossusAt(s.display.enemySprites[0])).not.toBeNull();
    s.ctrl.spawnFloatingTextsFromEvents([
      { targetId: 'enemy_0', damage: 123, isHeal: false, isCrit: false },
      { targetId: 'enemy_0', damage: 653, isHeal: false, isCrit: true },
    ]);
    const [hit, crit] = floatsIn(s.main);
    expect(outlineOf(hit)).toEqual([0xf8f8f8]);
    expect(outlineOf(crit)).toEqual([0xf8f8f8]);
    expect(widthOf(hit)).toBe(3);
    expect(fillOf(hit.main)).toBe(FLOAT_COLORS.hit);
    expect(fillOf(crit.main)).toBe(0xff6a6a);
  });

  it('an atlas enemy keeps the dark outline and the 0xff4444 crit', () => {
    const s = colossusBattle([testEnemy({ id: 'goblin', name: 'Goblin' })]);
    expect(colossusAt(s.display.enemySprites[0])).toBeNull();
    s.ctrl.spawnFloatingTextsFromEvents([{ targetId: 'enemy_0', damage: 42, isHeal: false, isCrit: true }]);
    const [crit] = floatsIn(s.main);
    expect(outlineOf(crit)).toEqual([FLOAT_OUTLINE]);
    expect(widthOf(crit)).toBe(3);
    expect(fillOf(crit.main)).toBe(0xff4444);
  });

  it('a party number keeps the dark outline', () => {
    const s = colossusBattle();
    s.ctrl.spawnFloatingTextsFromEvents([{ targetId: 'party_0', damage: 40, isHeal: false, isCrit: false }]);
    const [num] = floatsIn(s.main);
    expect(outlineOf(num)).toEqual([FLOAT_OUTLINE]);
  });
});
