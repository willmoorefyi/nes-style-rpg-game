/**
 * C6-8 (docs/CHAOS_FIX_PLAN.md 5.8): on a colossus the yellow target label gets a dark plate (0x101018, alpha 0.75,
 * 3 px padding) behind it, so it reads on F4's yellow-white open core; the plate goes with the label. An atlas enemy's
 * label has no plate.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Graphics } from 'pixi.js';
import { BattleFieldTargeting } from '../../../src/scenes/battle/BattleFieldTargeting.js';
import { LABEL_PLATE } from '../../../src/scenes/battle/colossus/colossusCursor.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import { glyphWidth } from '../../../src/scenes/battle/battleMessageUtils.js';
import { PANEL_FONT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { colossusBattle, installFixtureArt } from '../../helpers/colossusFixture.js';
import { descendants } from '../../helpers/battleLayers.js';
import { testEnemy } from '../../helpers/testUtils.js';

let uninstall: () => void = () => {};
beforeEach(async () => { uninstall = await installFixtureArt(); });
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

function target(enemies?: Parameters<typeof colossusBattle>[0]) {
  const s = colossusBattle(enemies);
  const t = new BattleFieldTargeting(s.layers.hud, s.battle, s.display, s.input as unknown as InputManager);
  expect(t.enterFieldTargeting(false, false, () => {}, () => {})).toBe(true);
  t.updateTargetVisuals();
  const plates = () => descendants(s.layers.hud, (c): c is Graphics => c instanceof Graphics && c.label === 'colossus.labelPlate');
  return { s, t, plates };
}

describe('the colossus target label plate (C6-8)', () => {
  it('the plate: 0x101018 at 0.75 with 3 px padding', () => {
    expect(LABEL_PLATE).toEqual({ color: 0x101018, alpha: 0.75, pad: 3 });
  });

  it('a colossus label has one dark plate behind it that frames it with 3 px (its glyph-width box)', () => {
    const { t, plates } = target();
    const label = t.targetLabel!;
    const [plate] = plates();
    expect(plate).toBeDefined();
    expect(plate.parent).toBe(label.parent);
    expect(plate.parent!.getChildIndex(plate)).toBeLessThan(label.parent!.getChildIndex(label));
    const b = plate.getBounds();
    expect(b.x).toBe(label.x - 3);
    expect(b.y).toBe(label.y - 3);
    expect(b.width).toBe(Math.ceil(label.text.length * glyphWidth(PANEL_FONT)) + 6);
    expect(b.height).toBe(PANEL_FONT + 6);
  });

  it('the plate goes with the label', () => {
    const { t, plates } = target();
    expect(plates()).toHaveLength(1);
    t.clearTargetArrow();
    expect(plates()).toHaveLength(0);
  });

  it('an atlas enemy label has no plate', () => {
    const { t, plates } = target([testEnemy({ id: 'goblin', name: 'Goblin' })]);
    expect(t.targetLabel).not.toBeNull();
    expect(plates()).toHaveLength(0);
  });
});
