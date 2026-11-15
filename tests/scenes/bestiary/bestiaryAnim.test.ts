/**
 * Fh test 3 (docs/BESTIARY_PLAN.md 4): the loop driver with the real EnemyPoseController (no PixiJS).
 */
import { describe, it, expect } from 'vitest';
import { EnemyPoseController } from '../../../src/scenes/battle/EnemyPoseController.js';
import { BestiaryLoop, steps, type LoopCaps } from '../../../src/scenes/bestiary/bestiaryAnim.js';

const CFG = { order: ['attack', 'hurt', 'cast', 'daze'] as const, firstBreak: 30, idleBreak: 60, dazeHold: 144 };
const GOBLIN: LoopCaps = { hasCast: false, hasDaze: false, hasSpells: false };
const GARLAND: LoopCaps = { hasCast: true, hasDaze: true, hasSpells: false };

/** A loop over a real pose controller; `frame()` is one bestiary frame (driver, then poses), returning the step. */
function rig(caps: LoopCaps, cfg: { heavy?: boolean; hasCast?: boolean } = {}) {
  const poses = new EnemyPoseController(1);
  poses.configure(0, { lungePx: 24, hasCast: cfg.hasCast ?? caps.hasCast, heavy: cfg.heavy ?? false });
  const dazed: boolean[] = [];
  let isDazed = false;
  const loop = new BestiaryLoop(poses, { attack: () => poses.playAttack(0, { travel: 0, rise: 0 }),
    setDazed: (on) => { isDazed = on; } }, CFG);
  const frame = (dt = 1): string => {
    loop.update(dt);
    poses.update(dt);
    dazed.push(isDazed);
    return loop.current;
  };
  /** Run until the step changes; returns [new step, frames spent in the old one]. */
  const runUntilChange = (limit = 2000): [string, number] => {
    const from = loop.current;
    for (let n = 1; n <= limit; n++) if (frame() !== from) return [loop.current, n];
    throw new Error(`stuck in ${from}`);
  };
  /** A new entry is shown on a frame (the scene shows it, then updates the preview): that frame is the break's first. */
  const show = (c: LoopCaps): void => { loop.start(c); frame(); };
  show(caps);
  return { poses, loop, frame, runUntilChange, dazed, show };
}

describe('bestiary loop', () => {
  it('goblin: first break 30, attack for its totalFrames, 60 idle, hurt, 60 idle, attack (two cycles)', () => {
    const r = rig(GOBLIN);
    expect(r.runUntilChange()).toEqual(['attack', 30]);
    const total = r.poses.attackTiming(0).totalFrames;
    for (let cycle = 0; cycle < 2; cycle++) {
      expect(r.runUntilChange()).toEqual(['break', total]);
      expect(r.runUntilChange()).toEqual(['hurt', 60]);
      const [, hurt] = r.runUntilChange();
      expect(hurt).toBeGreaterThan(0);
      expect(r.loop.current).toBe('break');
      expect(r.runUntilChange()).toEqual(['attack', 60]);
    }
  });

  it('garland caps: attack, hurt, cast, daze (144 frames dazed), attack', () => {
    const r = rig(GARLAND, { heavy: true });
    const seen: string[] = [];
    let dazeFrames = 0;
    while (seen.filter((s) => s === 'attack').length < 2) {
      const [step, n] = r.runUntilChange();
      if (step !== 'break') seen.push(step);
      if (step === 'break' && seen[seen.length - 1] === 'daze') dazeFrames = n;
    }
    expect(seen).toEqual(['attack', 'hurt', 'cast', 'daze', 'attack']);
    expect(dazeFrames).toBe(144);
    expect(r.dazed.filter(Boolean)).toHaveLength(144);
  });

  it('a goblin with no real daze frames has no daze step; cast needs a cast frame or spells', () => {
    expect(steps(CFG.order, GOBLIN)).toEqual(['attack', 'hurt']);
    expect(steps(CFG.order, { ...GOBLIN, hasSpells: true })).toEqual(['attack', 'hurt', 'cast']);
    expect(steps(CFG.order, GARLAND)).toEqual(['attack', 'hurt', 'cast', 'daze']);
  });

  it('Z in a break starts the next step on the same frame; during an attack it waits for idle and never cuts it', () => {
    const r = rig(GOBLIN);
    r.frame();
    r.loop.skip();
    expect(r.loop.current).toBe('attack');
    const total = r.poses.attackTiming(0).totalFrames;
    r.frame();
    r.loop.skip();
    let n = 1;
    while (r.frame() === 'attack') n++;
    expect(n).toBe(total);
    expect(r.loop.current).toBe('hurt');
  });

  it('Shift: no step starts in 300 frames; Shift again resumes', () => {
    const r = rig(GOBLIN);
    r.loop.togglePause();
    for (let i = 0; i < 300; i++) expect(r.frame()).toBe('break');
    r.loop.togglePause();
    expect(r.frame()).toBe('attack');
  });

  it('a new entry restarts with the 30-frame first break', () => {
    const r = rig(GOBLIN);
    for (let i = 0; i < 100; i++) r.frame();
    r.show(GOBLIN);
    expect(r.loop.current).toBe('break');
    expect(r.runUntilChange()).toEqual(['attack', 30]);
  });

  it('a dt of 0 (step mode) never advances a break', () => {
    const r = rig(GOBLIN);
    for (let i = 0; i < 500; i++) expect(r.frame(0)).toBe('break');
  });
});
