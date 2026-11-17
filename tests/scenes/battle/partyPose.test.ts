/** Pass K (docs/KNEEL_PLAN.md D-K2 rows 1-8 and (a)-(d), D-K3, D-K17): the hero pose table and PartyKneel. */
import { describe, it, expect } from 'vitest';
import { HURT_FRAMES, PartyKneel, actingKneel, hpLosses, kneelCommand, partyPoseOf, type PoseFacts, type PoseInput } from '../../../src/scenes/battle/partyPose.js';
import type { BattlePose } from '../../../src/rendering/CharacterAtlas.js';
import type { StatusPosture } from '../../../src/types/fxData.js';

const base: PoseInput = { hp: 100, maxHp: 100, posture: 'none', victory: false, override: null, overrideAge: 0, rising: false,
  hurt: false, kneel: null, idle: 'idle_b' };
const pose = (o: Partial<PoseInput>) => partyPoseOf({ ...base, ...o });

/** A PartyKneel driven one frame at a time for member 0 (facts may change per frame). */
function rig(start: Partial<PoseFacts> = {}) {
  const k = new PartyKneel();
  const facts: PoseFacts = { hp: 100, maxHp: 100, posture: 'none', victory: false, ...start };
  let override: BattlePose | null = null;
  k.start(true);
  const show = () => k.pose(0, facts, 'ready', override);
  show();
  const step = (n = 1): BattlePose[] => Array.from({ length: n }, () => { k.tick(1); return show(); });
  return { k, facts, show, step, setOverride: (p: BattlePose | null) => { override = p; return show(); } };
}

describe('partyPoseOf: the D-K2 hero rows (first match wins)', () => {
  it('row 1: hp <= 0 shows down, whatever else holds', () => {
    expect(pose({ hp: 0, posture: 'daze', victory: true, override: 'attack', kneel: 'kneel' })).toBe('down');
  });

  it('row 2: stone and still show ready (the kneel is not shown)', () => {
    for (const p of ['stone', 'still'] as StatusPosture[]) expect(pose({ posture: p, kneel: 'kneel', hurt: true })).toBe('ready');
  });

  it('row 3: a disabled kneel (daze) shows the track, before victory, the override and the hurt flash', () => {
    expect(pose({ posture: 'daze', kneel: 'kneel_b', victory: true, override: 'attack', hurt: true })).toBe('kneel_b');
  });

  it('row 4: victory, after an acting kneeler has stood up (the track playing out shows first)', () => {
    expect(pose({ victory: true, kneel: 'kneel_in2' })).toBe('kneel_in2');
    expect(pose({ victory: true })).toBe('victory');
  });

  it('row 5: the override; a rising kneeler shows kneel_in2 3, kneel_in1 3, then the override pose', () => {
    expect([0, 2, 3, 5, 6].map((overrideAge) => pose({ override: 'atk_wind1', rising: true, overrideAge }))).toEqual(
      ['kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'atk_wind1']);
    expect(pose({ override: 'atk_wind1', overrideAge: 0 })).toBe('atk_wind1');
  });

  it('rows 6 to 8: hurt on a standing hero, the acting kneel, else the breathing idle', () => {
    expect(pose({ hurt: true })).toBe('hurt');
    expect(pose({ kneel: 'kneel', hurt: true })).toBe('kneel');      // a kneeler never shows hurt
    expect(pose({})).toBe('idle_b');
  });

  it('D-K1: acting kneels are poison or weak HP (<= 25 %), and nothing stronger', () => {
    expect(actingKneel({ hp: 25, maxHp: 100, posture: 'none' })).toBe(true);
    expect(actingKneel({ hp: 26, maxHp: 100, posture: 'none' })).toBe(false);
    expect(actingKneel({ hp: 90, maxHp: 100, posture: 'kneel' })).toBe(true);
    expect(actingKneel({ hp: 10, maxHp: 100, posture: 'daze' })).toBe(false);      // disabled, not acting
    expect(actingKneel({ hp: 10, maxHp: 100, posture: 'still' })).toBe(false);     // frozen plus weak holds ready
  });

  it('kneelCommand: KO and stone cut; an override cuts an acting kneel but not a daze', () => {
    const f = { hp: 100, maxHp: 100, posture: 'kneel' as StatusPosture, victory: false, override: false, hurt: false, kneeling: true };
    const ctx = { first: false, wasDown: false };
    expect(kneelCommand({ ...f, hp: 0 }, ctx)).toEqual({ on: false, hold: true });
    expect(kneelCommand({ ...f, posture: 'stone' }, ctx)).toEqual({ on: false, hold: true });
    expect(kneelCommand({ ...f, override: true }, ctx)).toEqual({ on: false, hold: true });
    expect(kneelCommand({ ...f, posture: 'daze', override: true }, ctx)).toEqual({ on: true, hold: false });
    expect(kneelCommand(f, ctx)).toEqual({ on: true, hold: false });
  });
});

describe('PartyKneel (rows a-d, D-K3, D-K17)', () => {
  it('row (a): a battle start or retry with a weak or poisoned hero is in the hold at once (no in)', () => {
    for (const start of [{ hp: 20 }, { posture: 'kneel' as StatusPosture }, { posture: 'daze' as StatusPosture }]) {
      const r = rig(start);
      expect(r.show()).toMatch(/^kneel(_b)?$/);
      expect(r.step(30).every((p) => p === 'kneel' || p === 'kneel_b')).toBe(true);
    }
  });

  it('row (a): the status visuals arrive late; the first frame they are known snaps the kneel (start() is true once)', () => {
    const k = new PartyKneel();
    const f: PoseFacts = { hp: 100, maxHp: 100, posture: 'none', victory: false };
    expect(k.start(false)).toBe(false);
    k.pose(0, f, 'ready', null);                         // no visuals yet: no posture
    f.posture = 'kneel';
    expect(k.start(true)).toBe(true);
    expect(k.pose(0, f, 'ready', null)).toMatch(/^kneel(_b)?$/);
    expect(k.start(true)).toBe(false);
  });

  it('row (b): the command input changes nothing (no override): the hero stays kneeling', () => {
    const r = rig({ hp: 20 });
    expect(r.step(5).every((p) => p.startsWith('kneel'))).toBe(true);
  });

  it('D-K3: an acting kneeler rises in the first 6 override frames; isRising is latched at the override start', () => {
    const r = rig({ hp: 20 });
    expect(r.k.isRising(0)).toBe(true);                  // before the override: it would rise
    const first = r.setOverride('atk_wind1');
    expect([first, ...r.step(6)]).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1', 'atk_wind1']);
    r.facts.hp = 100;                                    // healed mid-action: the latch holds
    expect(r.k.isRising(0)).toBe(true);
    r.setOverride(null);
    expect(r.show()).toBe('ready');
  });

  it('a standing hero does not rise; a sleeper never acts (no rise), and stays kneeling', () => {
    const r = rig();
    expect(r.k.isRising(0)).toBe(false);
    expect(r.setOverride('atk_wind1')).toBe('atk_wind1');
    const z = rig({ posture: 'daze' });
    expect(z.k.isRising(0)).toBe(false);
  });

  it('D-K3 / D-K17: when the override clears and the trigger still holds, in starts on that frame', () => {
    const r = rig({ posture: 'kneel' });
    r.setOverride('cast');
    r.step(40);
    expect(r.setOverride(null)).toBe('kneel_in1');
    const next = r.step(8);
    expect(next.slice(0, 7)).toEqual(['kneel_in1', 'kneel_in1', 'kneel_in1', 'kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in2']);
    expect(next[7]).toMatch(/^kneel(_b)?$/);
  });

  it('row (c): a revive from down into weak HP goes to the hold directly (no ready frame, no in)', () => {
    const r = rig({ hp: 0 });
    expect(r.show()).toBe('down');
    r.facts.hp = 20;
    expect(r.show()).toMatch(/^kneel(_b)?$/);
  });

  it('row (c): a revive above the trigger plays the stand-up from down (kneel_in2 3, kneel_in1 3), then ready', () => {
    const r = rig({ hp: 0 });
    r.step(3);
    r.facts.hp = 80;
    expect([r.show(), ...r.step(6)]).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1', 'ready']);
  });

  it('row (d): a hit that makes a standing hero weak: the 24-frame hurt flash first, in on the frame it ends', () => {
    const r = rig();
    r.k.hit(0);
    r.facts.hp = 20;
    const seen = [r.show(), ...r.step(HURT_FRAMES)];
    expect(seen.slice(0, HURT_FRAMES)).toEqual(Array(HURT_FRAMES).fill('hurt'));
    expect(seen[HURT_FRAMES]).toBe('kneel_in1');
  });

  it('row (d): a hit on a kneeler only shakes it, +-2 px for 12 frames (no hurt, in not restarted)', () => {
    const r = rig({ hp: 20 });
    r.k.hit(0);
    const dx: number[] = [];
    for (let t = 0; t < 14; t++) { r.step(); dx.push(r.k.shakeDx(0)); }
    expect(dx.filter((d) => d !== 0)).toHaveLength(12);
    expect(dx.every((d) => Math.abs(d) === 2 || d === 0)).toBe(true);
    expect(r.show()).toMatch(/^kneel(_b)?$/);
  });

  it('D-K17: a hit during the override (the poison line) is a shake, never the hurt pose', () => {
    const r = rig({ posture: 'kneel' });
    r.setOverride('cast');
    r.step(10);
    r.k.hit(0);
    expect(r.step(12).every((p) => p === 'cast')).toBe(true);
    expect(r.k.shakeDx(0)).not.toBe(0);
  });

  it('victory: weak or poisoned heroes stand up in 6 frames, then victory; a sleeper keeps kneeling', () => {
    for (const start of [{ hp: 20 }, { posture: 'kneel' as StatusPosture }]) {
      const r = rig(start);
      r.facts.victory = true;
      expect([r.show(), ...r.step(6)]).toEqual(['kneel_in2', 'kneel_in2', 'kneel_in2', 'kneel_in1', 'kneel_in1', 'kneel_in1', 'victory']);
    }
    const z = rig({ posture: 'daze' });
    z.facts.victory = true;
    expect(z.step(10).every((p) => p === 'kneel' || p === 'kneel_b')).toBe(true);
  });

  it('a heal across 25 % mid-in reverses from the frame on screen; stone cuts the kneel at once', () => {
    const r = rig();
    r.facts.hp = 20;
    r.show();
    r.step(2);
    r.facts.hp = 80;
    expect(r.show()).toBe('kneel_in1');
    expect(r.step(3)[2]).toBe('ready');
    const s = rig({ hp: 20 });
    s.facts.posture = 'stone';
    expect(s.show()).toBe('ready');
    s.facts.posture = 'none';
    expect(s.show()).toBe('kneel_in1');                  // stone gone: in again (nothing was held)
  });

  it('hpLosses: who lost HP and still stands', () => {
    expect(hpLosses([{ hp: 10 }, { hp: 10 }, { hp: 5 }], [{ hp: 8 }, { hp: 10 }, { hp: 0 }])).toEqual([0]);
  });
});
