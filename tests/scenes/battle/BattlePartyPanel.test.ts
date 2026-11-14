/**
 * B10 (docs/FIX_PLAN_PENINSULA.md R2): while a party target is chosen, only the target row has the cursor (yellow,
 * blinking); the acting member's row keeps a blue name tint, so the two never look alike.
 */
import { describe, it, expect } from 'vitest';
import { BattlePartyPanel } from '../../../src/scenes/battle/BattlePartyPanel.js';
import { Character } from '../../../src/entities/Character.js';
import { testClass } from '../../helpers/testUtils.js';

const party = () => ['FGHTR', 'THIEF', 'W.MAG', 'B.MAG'].map(name => new Character({ name, classData: testClass('warrior') }));

describe('BattlePartyPanel targeting (B10)', () => {
  it('setActive(0); setTarget(2) puts a cursor on row 2 only (old: rows 0 and 2)', () => {
    const panel = new BattlePartyPanel(party());
    panel.setActive(0);
    panel.setTarget(2);
    expect(panel.rows.map(r => r.cursor.visible)).toEqual([false, false, true, false]);
    expect(panel.rows[2].cursor.tint).toBe(0xffff00);
    expect(panel.rows[0].name.tint).toBe(0x88ccff);
    expect(panel.rows[2].name.tint).not.toBe(panel.rows[0].name.tint);
  });

  it('the target cursor blinks, and ending the target choice gives the cursor back to the active row', () => {
    const panel = new BattlePartyPanel(party());
    panel.setActive(1);
    panel.setTarget(3);
    panel.blinkTarget(false);
    expect(panel.rows[3].cursor.visible).toBe(false);
    panel.blinkTarget(true);
    expect(panel.rows[3].cursor.visible).toBe(true);
    panel.setTarget(-1);
    expect(panel.rows.map(r => r.cursor.visible)).toEqual([false, true, false, false]);
    expect(panel.rows[1].cursor.tint).toBe(0xffffff);
  });

  it('targeting the active member itself shows one cursor on that row', () => {
    const panel = new BattlePartyPanel(party());
    panel.setActive(2);
    panel.setTarget(2);
    expect(panel.rows.map(r => r.cursor.visible)).toEqual([false, false, true, false]);
  });
});
