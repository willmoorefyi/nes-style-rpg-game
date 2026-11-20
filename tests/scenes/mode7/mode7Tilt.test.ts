import { describe, expect, it } from 'vitest';
import { TILT_FRAMES, TiltMachine } from '../../../src/scenes/exploration/mode7/mode7Tilt.js';

/**
 * M7-2: the flight view's states (docs/MODE7_PLAN.md 4.3, 9), with M7-2's instant switch (`TILT_FRAMES` 0). Each case
 * asserts the exact sequence of states entered. The tilt's frames and `tiltParams` are M7-4's; one case runs the
 * machine with 42 frames to pin the timing it will use.
 */
describe('M7-2: TiltMachine (instant switch)', () => {
  it('M7-2 switches instantly', () => {
    expect(TILT_FRAMES).toBe(0);
  });

  it('a take-off while ready: off -> tiltIn -> flying at once; a landing: flying -> tiltOut -> off; never busy', () => {
    const m = new TiltMachine();
    m.start('takeoff', true, true);
    expect(m.state).toBe('flying');
    expect(m.busy).toBe(false);
    expect(m.drawn).toBe(true);
    m.land();
    expect(m.state).toBe('off');
    expect(m.history).toEqual(['off', 'tiltIn', 'flying', 'tiltOut', 'off']);
  });

  it('a take-off while not ready waits in loading (takeoff, not busy), then tilts in on the first idle frame', () => {
    const m = new TiltMachine();
    m.start('takeoff', false, true);
    expect(m.state).toBe('loading');
    expect(m.reason).toBe('takeoff');
    expect(m.busy).toBe(false);
    expect(m.drawn).toBe(false);
    m.tick(1, false, true);
    m.tick(1, true, false);           // ready mid-step: no tilt yet
    expect(m.state).toBe('loading');
    m.tick(1, true, true);            // the first idle frame
    expect(m.state).toBe('flying');
    expect(m.history).toEqual(['off', 'loading', 'tiltIn', 'flying']);
  });

  it('a load or retry in flight while not ready: loading (restore), then flying at once, even mid-step, no tiltIn', () => {
    const m = new TiltMachine();
    m.start('restore', false, true);
    expect(m.reason).toBe('restore');
    m.tick(1, true, false);
    expect(m.state).toBe('flying');
    expect(m.reason).toBeNull();
    expect(m.history).toEqual(['off', 'loading', 'flying']);
  });

  it('a load or retry while ready goes straight to flying', () => {
    const m = new TiltMachine();
    m.start('restore', true, false);
    expect(m.history).toEqual(['off', 'flying']);
  });

  it('a landing in loading goes to off; a map change goes to off with no tilt', () => {
    const a = new TiltMachine();
    a.start('takeoff', false);
    a.land();
    expect(a.history).toEqual(['off', 'loading', 'off']);
    const b = new TiltMachine();
    b.start('restore', true);
    b.end();
    expect(b.history).toEqual(['off', 'flying', 'off']);
    b.end();
    expect(b.history).toEqual(['off', 'flying', 'off']);
  });

  it('a take-off with the hero mid-step while ready waits for the idle frame (no tilt over a moving hero)', () => {
    const m = new TiltMachine();
    m.start('takeoff', true, false);
    expect(m.state).toBe('loading');
    m.tick(1, true, true);
    expect(m.history).toEqual(['off', 'loading', 'tiltIn', 'flying']);
  });

  it('with 42 frames (M7-4) a tilt is exactly 42 frames of dt 1 and 21 of dt 2, busy only while tilting', () => {
    for (const dt of [1, 2]) {
      const m = new TiltMachine(42);
      m.start('takeoff', true, true);
      let n = 0;
      while (m.state === 'tiltIn') { expect(m.busy).toBe(true); m.tick(dt, true, true); n++; }
      expect(n).toBe(42 / dt);
      expect(m.state).toBe('flying');
      expect(m.busy).toBe(false);
      m.land();
      n = 0;
      while (m.state === 'tiltOut') { m.tick(dt, true, true); n++; }
      expect(n).toBe(42 / dt);
      expect(m.history).toEqual(['off', 'tiltIn', 'flying', 'tiltOut', 'off']);
    }
  });
});
