import { describe, expect, it } from 'vitest';
import { FlightStats, SETTLE_FRAMES, p95 } from '../../../src/scenes/exploration/mode7/flightStats.js';

/** M7-3: the steady-flight p95 window (docs/MODE7_PLAN.md 9) leaves out the settle frames and the upload frames. */
describe('M7-3: FlightStats', () => {
  it('skips the first 60 drawn frames and every upload frame plus the one after it, reported as a max', () => {
    const s = new FlightStats();
    for (let i = 0; i < SETTLE_FRAMES; i++) s.push(true, false, 1, 10);
    expect(s.samples).toBe(0);
    for (let i = 0; i < 100; i++) s.push(true, i % 10 === 0, i % 10 === 0 ? 5 : 0.1, i % 10 === 1 ? 30 : 8);
    expect(s.samples).toBe(80);
    expect(s.heavyFrames).toBe(20);
    expect([s.heavyFrameMax, s.heavyUpdateMax]).toEqual([30, 5]);
    expect(s.summary()).toEqual({ frameP95: 8, updateP95: 0.1 });
    s.push(false, false, 9, 99);   // not drawn: not sampled
    expect(s.samples).toBe(80);
    s.reset();
    s.push(true, false, 9, 99);    // settling again
    expect(s.samples).toBe(80);
  });

  it('p95', () => {
    expect(p95([])).toBe(0);
    expect(p95(Array.from({ length: 100 }, (_, i) => i))).toBe(95);
  });
});
