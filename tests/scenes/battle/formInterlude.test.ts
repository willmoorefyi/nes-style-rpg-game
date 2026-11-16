/**
 * The interlude timeline (docs/CHAOS_FORMS_PLAN.md 2.3, R18, A1, A2): steps run in order, a `with: previous` step
 * starts with the one before it (the total is the longest branch), message steps count 90 frames (speed 3) and are the
 * only steps confirm advances, and the registry drops a bad script with console.error.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { InterludeClock, compileInterlude, interludeProblems, panProblems, type InterludeStep } from '../../../src/scenes/battle/formInterlude.js';
import { InterludeRegistry } from '../../../src/data/InterludeRegistry.js';
import { fixtureIndex, HORIZON } from '../../helpers/colossusFixture.js';

afterEach(() => { vi.restoreAllMocks(); });

/** chaos_i2 as section 3.3 writes it (A1 re-timing). */
const I2: InterludeStep[] = [
  { type: 'message', text: 'The rings shatter!' },
  { type: 'pose', name: 'roar' },
  { type: 'dissolve', frames: 45, style: 'sink' },
  { type: 'fade', alpha: 0.6, frames: 20 },
  { type: 'shake', times: 3 },
  { type: 'swap' },
  { type: 'rise', frames: 120, from_dy: 300 },
  { type: 'shake', times: 2, with: 'previous' },
  { type: 'pan', from: [0, -60], frames: 120, ease: 'out' },
  { type: 'flash', color: '#ffffff', frames: 8, alpha: 1 },
  { type: 'message', text: 'Chaos, the Last Horizon, fills the sky!' },
];

describe('compileInterlude', () => {
  it('chaos_i2 totals 577 frames (A1) with the swap at 239 and the shake starting with the rise', () => {
    const c = compileInterlude(I2);
    expect(c.total).toBe(577);
    const at = (i: number): number => c.events.find((e) => e.index === i)!.frame;
    expect(at(5)).toBe(90 + 60 + 45 + 20 + 24);
    expect(at(7)).toBe(at(6));
    expect(at(8)).toBe(at(6) + 120);
    expect(at(10)).toBe(577 - 90);
  });

  it('a with: previous step longer than its partner sets the branch length', () => {
    const c = compileInterlude([{ type: 'wait', frames: 10 }, { type: 'shake', times: 3, with: 'previous' }, { type: 'wait', frames: 5 }]);
    expect(c.total).toBe(24 + 5);
    expect(c.events.map((e) => e.frame)).toEqual([0, 0, 24]);
  });
});

describe('InterludeClock', () => {
  it('starts each step on its frame and ends after the total', () => {
    const clock = new InterludeClock(I2);
    const starts: [number, number][] = [];
    let f = 0;
    while (!clock.done && f < 1000) {
      for (const i of clock.update(1, false).started) starts.push([i, f]);
      f++;
    }
    expect(f).toBe(577);
    expect(starts.find(([i]) => i === 5)![1]).toBe(239);
  });

  it('confirm cuts a message short and nothing else', () => {
    const steps: InterludeStep[] = [{ type: 'message', text: 'a' }, { type: 'wait', frames: 30 }, { type: 'message', text: 'b' }];
    const clock = new InterludeClock(steps);
    clock.update(1, false);
    expect(clock.update(1, true).started).toEqual([1]);    // the line ends; the wait starts
    for (let f = 0; f < 10; f++) expect(clock.update(1, true).started).toEqual([]);   // confirm does not cut the wait
    let f = 11;
    while (!clock.update(1, false).started.includes(2)) f++;
    expect(f).toBe(30);
    clock.update(1, true);
    expect(clock.done).toBe(true);
  });

  it('progress of a running step is its frame over its length (rise, pan)', () => {
    const clock = new InterludeClock([{ type: 'rise', frames: 10, from_dy: 20 }]);
    clock.update(1, false);
    clock.update(1, false);
    expect(clock.active()).toEqual([{ index: 0, t: 2, frames: 10 }]);
  });
});

describe('validation', () => {
  it('caps: 480 frames, 600 for chaos_i2 (D-O15); the A2 pan start rule; one swap; rise only after it', () => {
    expect(interludeProblems('chaos_i2', I2)).toEqual([]);
    expect(interludeProblems('chaos_i1', I2).join()).toMatch(/577 frames > 480/);
    expect(interludeProblems('x', [{ type: 'swap' }, { type: 'pan', from: [10, -60], frames: 10, ease: 'out' }]).join()).toMatch(/dx <= 0/);
    expect(interludeProblems('x', [{ type: 'swap' }, { type: 'pan', from: [0, -80], frames: 10, ease: 'out' }]).join()).toMatch(/dy in \[-70, 0\]/);
    expect(interludeProblems('x', [{ type: 'rise', frames: 10, from_dy: 10 }, { type: 'swap' }]).join()).toMatch(/rise before the swap/);
    expect(interludeProblems('x', [{ type: 'swap' }, { type: 'swap' }]).join()).toMatch(/more than one swap/);
    expect(interludeProblems('x', [{ type: 'flash', color: '#fff', frames: 4, alpha: 1.5 }]).join()).toMatch(/alpha/);
  });

  it('pan offsets stay inside the json-derived limits of the form they reveal (R13)', () => {
    const f = fixtureIndex().forms[HORIZON];
    expect(panProblems(I2, f)).toEqual([]);
    expect(panProblems([{ type: 'pan', from: [0, -200], frames: 10, ease: 'out' }], f).join()).toMatch(/outside/);
  });

  it('the registry drops an unknown step type or a bad value with console.error and keeps the rest', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reg = InterludeRegistry.from({ interludes: [
      { id: 'chaos_i2', steps: I2 },
      { id: 'bad_type', steps: [{ type: 'dance' }] },
      { id: 'bad_value', steps: [{ type: 'wait', frames: -1 }] },
    ] });
    expect(reg.get('chaos_i2')).toHaveLength(11);
    expect(reg.get('bad_type')).toBeNull();
    expect(reg.get('bad_value')).toBeNull();
    expect(err).toHaveBeenCalledTimes(2);
  });
});
