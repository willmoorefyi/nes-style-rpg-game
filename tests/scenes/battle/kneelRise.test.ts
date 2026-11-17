/**
 * Pass K D-K3 option 1 (docs/KNEEL_PLAN.md): the `rise` option of every motion table. With it, frame names, the cues
 * and holdFrame run on raw t (identical to the run without it); the offsets hold their frame-0 value for t < 6, every
 * frame from E on is identical, and the contact frame index is unchanged.
 */
import { describe, it, expect } from 'vitest';
import { ATTACK_STYLES, CAST_FRAMES, CAST_STEP_FRAMES, advanceAt, advanceFrames, castAt, type AttackStyle } from '../../../src/scenes/battle/attackChoreography.js';
import { attackTable, travelAttackAt, type AttackKind } from '../../../src/scenes/battle/enemyAttackTables.js';
import { ATTACK_RISE_END, attackAt, castAt as enemyCastAt } from '../../../src/scenes/battle/enemyChoreography.js';
import { EnemyPoseController } from '../../../src/scenes/battle/EnemyPoseController.js';

const HERO_E: Record<AttackStyle, number> = { lunge: 18, dash: 15, leap: 22, classic: 15 };
const REACH = { dx: 420, dy: -60 };

describe('D-K3: the hero advance and cast with `rise`', () => {
  it.each(ATTACK_STYLES)('%s: poses on raw t, offsets held for t < 6, identical from E (the measured E table)', (style) => {
    const E = HERO_E[style];
    expect(E).toBeLessThanOrEqual(advanceFrames(style));               // E <= contact (the advance's last frame)
    expect(E - 6).toBeGreaterThanOrEqual(6);
    const at0 = advanceAt(style, 0, REACH);
    for (let t = 0; t <= advanceFrames(style); t++) {
      const plain = advanceAt(style, t, REACH);
      const risen = advanceAt(style, t, REACH, { rise: true });
      expect(risen.pose, `${style} t ${t}`).toBe(plain.pose);
      if (t < 6) expect({ dx: risen.dx, dy: risen.dy }, `${style} t ${t}`).toEqual({ dx: at0.dx, dy: at0.dy });
      if (t >= E) expect(risen, `${style} t ${t}`).toEqual(plain);
    }
    expect(advanceAt(style, advanceFrames(style), REACH, { rise: true })).toEqual(advanceAt(style, advanceFrames(style), REACH));
  });

  it('castAt: the 36 px step holds for 6 frames, is compressed into [6, 14), the effect at 24 unchanged', () => {
    expect(CAST_STEP_FRAMES).toBe(14);
    for (let t = 0; t <= CAST_FRAMES; t++) {
      const plain = castAt(t);
      const risen = castAt(t, { rise: true });
      expect(risen.pose).toBe(plain.pose);
      if (t < 6) expect(risen.dx).toBe(castAt(0).dx);
      if (t >= CAST_STEP_FRAMES) expect(risen).toEqual(plain);
    }
  });
});

describe('D-K3: the enemy tables with `rise`', () => {
  const run = (kind: AttackKind, travel: number, E: number, hasRaise = false) => {
    const o = { lunge: 30, travel, hop: 10, hasRaise };
    const { contactAt, total } = attackTable(kind, travel);
    expect(E).toBeLessThanOrEqual(contactAt);
    const at0 = travelAttackAt(kind, 0, o);
    for (let t = 0; t <= total; t++) {
      const plain = travelAttackAt(kind, t, o);
      const risen = travelAttackAt(kind, t, { ...o, rise: true });
      expect(risen.frame, `${kind} ${travel} t ${t}`).toBe(plain.frame);
      if (t < 6) expect({ dx: risen.dx, dy: risen.dy, k: risen.k }).toEqual({ dx: at0.dx, dy: at0.dy, k: at0.k });
      if (t >= E) expect(risen, `${kind} ${travel} t ${t}`).toEqual(plain);
    }
  };

  it('in place: E 14 = contact 14', () => {
    expect(ATTACK_RISE_END).toBe(14);
    run('inplace', 0, 14);
    expect(attackAt(10, 24, { rise: true }).frame).toBe(attackAt(10, 24).frame);
  });

  it('melee: E = wind + N (11 + N), contact 14 + N', () => {
    for (const travel of [60, 600, 1200]) run('melee', travel, 11 + attackTable('melee', travel).n);
  });

  it('heavy N >= 10: E = N, or N + the raise-in when N < 12; contact N + 29', () => {
    for (const travel of [60, 300, 1200]) {
      const { n } = attackTable('heavy', travel);
      run('heavy', travel, n >= 12 ? n : n + 6, true);
    }
  });

  it('heavy n = 0 (Chaos F1 as a titan, phases 6 / 18 / 3 / 2): E 24, contact 29; the hold cue and holdFrame keep their frames', () => {
    expect(attackTable('heavy', 0)).toMatchObject({ n: 0, contactAt: 29, holdAt: 6 });
    run('heavy', 0, 24, true);
    const plain = new EnemyPoseController(1);
    const risen = new EnemyPoseController(1);
    plain.configure(0, { heavy: true });
    risen.configure(0, { heavy: true });
    risen.setPosture(0, 'kneel');
    risen.snapKneel();
    const cues = (c: EnemyPoseController) => { const out: string[] = []; c.onCue = (_i, cue) => out.push(cue); return out; };
    const [a, b] = [cues(plain), cues(risen)];
    plain.playAttack(0);
    risen.playAttack(0);
    for (let t = 0; t < 70; t++) {
      expect(risen.holdFrame(0), `t ${t}`).toBe(plain.holdFrame(0));
      plain.update(1);
      risen.setPosture(0, 'kneel');
      risen.update(1);
    }
    expect(b).toEqual(a);
    expect(a).toEqual(['hold', 'contact']);
  });

  it('the boss and plain casts have no motion: nothing to remap', () => {
    for (const hasCast of [true, false]) for (let t = 0; t < 30; t++) expect(enemyCastAt(t, hasCast).dy).toBe(0);
  });
});
