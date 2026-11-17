/**
 * C6-5 (docs/CHAOS_FIX_PLAN.md 4.2, 5.6, D-C7-7 / D-C7-13): the slam reads. `slamAt(t, limits)` dips 48 and drops 40
 * px past rest, each clamped per form by the border rule (bottom >= 786, top <= 114, less the breathing's 4 px):
 * F3 (rest y -60) dips 48 / drops 40 = 88 px peak to peak, F4 (rest y -285) dips 5 / drops 40 = 45 px. Peak to peak
 * is measured on `slamAt` alone; the border rules hold on every slam frame with the breathing, at margin 0. A second
 * screen shake comes 6 frames after contact, and the line reads "Chaos slams down!".
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  SLAM_CONTACT, TIMELINE_FRAMES, cuesBetween, poseAt, slamAt, slamLimitsFor,
} from '../../../src/scenes/battle/colossus/colossusChoreography.js';
import { borderProblems, readColossusIndex, type ColossusFormSpec } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { formatAnnouncement } from '../../../src/scenes/battle/battleMessageUtils.js';
import { colossusBattle, colossusEnemy, installFixtureArt } from '../../helpers/colossusFixture.js';

const index = readColossusIndex(JSON.parse(readFileSync('assets/sprites/colossus.json', 'utf8')));
const F3 = index.forms.chaos_horizon;
const F4 = index.forms.chaos_horizon_core;

const offsets = (f: ColossusFormSpec): number[] => {
  const l = slamLimitsFor(f);
  return Array.from({ length: TIMELINE_FRAMES.slam }, (_, t) => slamAt(t, l));
};
const peakToPeak = (f: ColossusFormSpec): number => { const o = offsets(f); return Math.max(...o) - Math.min(...o); };

describe('the slam motion (C6-5)', () => {
  it('the forms are where the plan measured them: F3 rest y -60, F4 rest y -285', () => {
    expect(F3.place[1]).toBe(-60);
    expect(F4.place[1]).toBe(-285);
  });

  it('F3 dips 48 and drops 40: 88 px peak to peak (bound 40)', () => {
    expect(slamLimitsFor(F3)).toEqual({ dip: 48, drop: 40 });
    const o = offsets(F3);
    expect(Math.min(...o)).toBe(-48);
    expect(Math.max(...o)).toBe(40);
    expect(peakToPeak(F3)).toBe(88);
    expect(peakToPeak(F3)).toBeGreaterThanOrEqual(40);
  });

  it('F4 dips 5 (its bottom 795 keeps >= 786 with the breathing) and drops 40: 45 px peak to peak (bound 40)', () => {
    expect(slamLimitsFor(F4)).toEqual({ dip: 5, drop: 40 });
    expect(peakToPeak(F4)).toBe(45);
    expect(peakToPeak(F4)).toBeGreaterThanOrEqual(40);
  });

  it('the slam is at rest before the dip and after the recovery; the drop peaks at contact', () => {
    const l = slamLimitsFor(F3);
    expect(slamAt(TIMELINE_FRAMES.slam, l)).toBe(0);
    expect(slamAt(SLAM_CONTACT - 1, l)).toBe(l.drop);
  });

  it('every border rule holds on every slam frame with the breathing (margin 0), for F3 and F4', () => {
    for (const f of [F3, F4]) {
      const l = slamLimitsFor(f);
      for (let t = 0; t < TIMELINE_FRAMES.slam; t++) {
        for (let k = 0; k < TIMELINE_FRAMES.idle; k += 6) {
          const bob = poseAt('slam', t, t + k, [], l).bob;
          expect(borderProblems(f, { x: 0, y: bob }), `${f.place[1]} t ${t} clock ${t + k}`).toEqual([]);
          expect(borderProblems(f, { x: 0, y: bob }, 6, ['bottom']), `${f.place[1]} t ${t} bottom >= 786`).toEqual([]);
        }
      }
    }
  });

  it('a second shake comes 6 frames after contact', () => {
    expect(cuesBetween('slam', 0, TIMELINE_FRAMES.slam)).toEqual(['contact', 'shake', 'shake']);
    expect(cuesBetween('slam', SLAM_CONTACT + 6, SLAM_CONTACT + 7)).toEqual(['shake']);
  });

  it('the announcement names the slam: "Chaos slams down!"', () => {
    expect(formatAnnouncement({ actorName: 'Chaos', actionType: 'slam', targetName: 'KNGT' })).toBe('Chaos slams down!');
  });
});

describe('the slam in a battle (the controller takes its form limits)', () => {
  let uninstall: () => void = () => {};
  beforeEach(async () => { uninstall = await installFixtureArt(); });
  afterEach(() => { uninstall(); vi.restoreAllMocks(); });

  it('a colossus slam moves the canvas 48 px up and 40 px down, and both shakes start the screen shake', () => {
    const s = colossusBattle([colossusEnemy()]);
    const ctl = s.display.colossus.controller(0)!;
    const view = s.display.colossus.view(0)!;
    expect(ctl.slamLimits).toEqual(slamLimitsFor(view.form));
    const shake = vi.spyOn(s.layers.shake, 'start');
    ctl.attack();
    const ys: number[] = [];
    for (let t = 0; t < TIMELINE_FRAMES.slam; t++) { ys.push(ctl.frame().bob); ctl.update(1); }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(80);
    expect(shake).toHaveBeenCalledTimes(2);
  });
});
