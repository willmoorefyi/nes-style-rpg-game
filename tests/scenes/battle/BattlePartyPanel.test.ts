/**
 * B10 (docs/FIX_PLAN_PENINSULA.md R2): while a party target is chosen, only the target row has the cursor (yellow,
 * blinking); the acting member's row keeps a blue name tint, so the two never look alike.
 */
import { describe, it, expect } from 'vitest';
import { BattlePartyPanel, HP_ROLL_FRAMES } from '../../../src/scenes/battle/BattlePartyPanel.js';
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

describe('6b: the HP number and bar roll to the new value (pass F item 6)', () => {
  it('after 30 damage the HP text reads intermediate values for 20 frames and the final value after (old: at once)', () => {
    const members = party();
    expect(members[0].maxHp).toBe(50);
    const panel = new BattlePartyPanel(members);
    expect(panel.rows[0].hp.text).toBe('50/50');
    members[0].currentHp = 20;
    panel.refresh();
    const seen: number[] = [];
    for (let f = 0; f < HP_ROLL_FRAMES - 1; f++) {
      expect(panel.rows[0].hp.text).not.toBe('20/50');
      panel.update(1);
      seen.push(parseInt(panel.rows[0].hp.text, 10));
    }
    expect(seen.every((hp) => hp > 20 && hp < 50)).toBe(true);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1]);   // damage counts down
    panel.update(1);
    expect(panel.rows[0].hp.text).toBe('20/50');
    panel.update(10);
    expect(panel.rows[0].hp.text).toBe('20/50');
  });

  it('a heal counts up; a new change mid-roll starts from the number on screen', () => {
    const members = party();
    const panel = new BattlePartyPanel(members);
    members[1].currentHp = 10;
    panel.refresh();
    panel.update(HP_ROLL_FRAMES / 2);
    expect(panel.shownHp(1)).toBe(30);
    members[1].currentHp = 50;
    panel.refresh();
    expect(panel.shownHp(1)).toBe(30);
    panel.update(1);
    expect(panel.shownHp(1)).toBeGreaterThan(30);
    panel.update(HP_ROLL_FRAMES);
    expect(panel.rows[1].hp.text).toBe('50/50');
  });

  it('a refresh without an HP change does not start a roll', () => {
    const members = party();
    const panel = new BattlePartyPanel(members);
    const before = panel.rows[2].hp.text;
    panel.refresh();
    expect(panel.rows[2].hp.text).toBe(before);
  });
});
