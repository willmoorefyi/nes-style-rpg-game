/**
 * EF-E (docs/ENEMY_FEEDBACK_PLAN.md): the Orrery's orbs travel along its gold rings. The orbit maths (colossusOrbits.ts:
 * the offset from the painted spot and the far / near half at a clock), the pose controller's orbit clock (it holds
 * while an interlude poses the form), the halo following its orb and pulsing like the glow, and the view's draw order
 * (ring_back < far orbs < body < near orbs < glow) on the contract form's orbit layers and on the real Orrery entry.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Container } from 'pixi.js';
import { ColossusView } from '../../../src/scenes/battle/colossus/ColossusView.js';
import { ColossusPoseController } from '../../../src/scenes/battle/colossus/ColossusPoseController.js';
import { GLOW_PULSE_MIN, TIMELINE_FRAMES, poseAt } from '../../../src/scenes/battle/colossus/colossusChoreography.js';
import { readColossusIndex, type ColossusFormSpec } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { ORBIT_FPS, orbitAngle, orbitOf, pathPose, ringPoint, type OrbitPath } from '../../../src/scenes/battle/colossus/colossusOrbits.js';
import { CONTRACT, contractRaw } from '../../helpers/colossusFixture.js';

const contract = (): ColossusFormSpec => structuredClone((contractRaw() as { forms: Record<string, ColossusFormSpec> }).forms[CONTRACT]);
const real = (): ColossusFormSpec => readColossusIndex(JSON.parse(readFileSync('assets/sprites/colossus.json', 'utf8'))).forms.chaos_orrery;
const noTextures = { texture: () => null };
/** Frames in one period of an orbit. */
const periodFrames = (p: OrbitPath): number => (p.orbit.periodMs * ORBIT_FPS) / 1000;

describe('orbit maths (colossusOrbits.ts)', () => {
  const path = (): OrbitPath => orbitOf(contract(), 'orb_a')!;

  it('an orb starts on its painted spot and follows its ellipse, back home after one period', () => {
    const p = path();
    expect(pathPose(p, 0)).toMatchObject({ dx: 0, dy: 0 });
    const n = periodFrames(p);
    const home = pathPose(p, n);
    expect(Math.abs(home.dx) + Math.abs(home.dy)).toBeLessThan(1e-6);
    for (const k of [0.1, 0.25, 0.5, 0.8]) {
      const t = orbitAngle(p.ring, p.orbit, k * n);
      expect(t).toBeCloseTo(p.orbit.phase0 + p.ring.dir * 2 * Math.PI * k, 9);
      const at = ringPoint(p.ring, t);
      const p0 = ringPoint(p.ring, p.orbit.phase0);
      expect(pathPose(p, k * n)).toMatchObject({ dx: at.x - p0.x, dy: at.y - p0.y });
    }
  });

  it('behind (far half) exactly where sin t <= 0, switching at the ends of the major axis', () => {
    const p = path();
    const n = periodFrames(p);
    let switches = 0;
    let last = pathPose(p, 0).behind;
    for (let c = 0; c <= n; c += 1) {
      const pose = pathPose(p, c);
      expect(pose.behind).toBe(!(Math.sin(orbitAngle(p.ring, p.orbit, c)) > 0));
      if (pose.behind !== last) {
        switches += 1;
        const end = ringPoint(p.ring, Math.round(orbitAngle(p.ring, p.orbit, c) / Math.PI) * Math.PI);
        const now = ringPoint(p.ring, orbitAngle(p.ring, p.orbit, c));
        expect(Math.hypot(now.x - end.x, now.y - end.y)).toBeLessThan(10);   // at a ring's end, over the sky
      }
      last = pose.behind;
    }
    expect(switches).toBe(2);
  });

  it('a halo (<orb>_glow) moves on its orb\'s orbit; other layers have none', () => {
    const f = contract();
    expect(orbitOf(f, 'orb_a_glow')).toEqual(orbitOf(f, 'orb_a'));
    expect(orbitOf(f, 'body')).toBeNull();
  });
});

describe('the pose controller\'s orbit clock', () => {
  const ctl = (): { c: ColossusPoseController; v: ColossusView } => {
    const v = new ColossusView(CONTRACT, contract(), noTextures);
    return { v, c: new ColossusPoseController(v.layerInfo) };
  };
  const orb = (c: ColossusPoseController, v: ColossusView, name = 'orb_a') => c.frame().layers[v.layerInfo.findIndex((l) => l.name === name)];

  it('orbs move with the clock in idle and during a battle attack; the halo moves with its orb', () => {
    const { c, v } = ctl();
    c.update(30);
    expect(c.orbitFrames).toBe(30);
    const want = pathPose(orbitOf(contract(), 'orb_a')!, 30);
    expect(orb(c, v)).toMatchObject({ dx: want.dx, dy: want.dy, behind: want.behind });
    expect(orb(c, v, 'orb_a_glow')).toMatchObject({ dx: want.dx, dy: want.dy });
    c.attack();
    c.update(10);
    expect(c.orbitFrames).toBe(40);
  });

  it('an interlude pose holds the orbs until the pose has played out, then they go on', () => {
    const { c } = ctl();
    c.update(12);
    c.pose('cast');
    c.update(TIMELINE_FRAMES.cast - 1);
    expect(c.orbitFrames).toBe(12);
    c.update(2);                                   // the cast ends inside this update: idle again
    expect(c.timeline).toBe('idle');
    c.update(5);
    expect(c.orbitFrames).toBe(17);
    c.reset();
    expect(c.orbitFrames).toBe(0);
  });

  it('an orb halo pulses and flares like the glow', () => {
    const layers = new ColossusView(CONTRACT, contract(), noTextures).layerInfo;
    const i = layers.findIndex((l) => l.name === 'orb_a_glow');
    const g = layers.findIndex((l) => l.name === 'glow');
    const half = poseAt('idle', 0, TIMELINE_FRAMES.idle, layers);
    expect(half.layers[i].alpha).toBeCloseTo(GLOW_PULSE_MIN, 6);
    expect(half.layers[i].alpha).toBeCloseTo(half.layers[g].alpha, 9);
    expect(poseAt('beam', 12, TIMELINE_FRAMES.idle, layers).layers[i].alpha).toBe(1);
  });
});

describe('the view\'s draw order (ring_back < far orbs < body < near orbs < glow)', () => {
  /** The draw rank of a layer node: its depth-first position among the art's descendants. */
  function rank(v: ColossusView, name: string): number {
    const target = v.layerNode(name)!;
    let i = 0;
    let found = -1;
    const walk = (c: Container): void => { for (const k of c.children) { if (k === target) found = i; i += 1; walk(k); } };
    walk(v.art);
    return found;
  }

  it('on the contract form: ring_back first, the orb over the body while near, under it while far', () => {
    const f = contract();
    const v = new ColossusView(CONTRACT, f, noTextures);
    const c = new ColossusPoseController(v.layerInfo);
    const p = orbitOf(f, 'orb_a')!;
    const seen = new Set<boolean>();
    for (let k = 0; k < periodFrames(p); k += 7) {
      c.update(k === 0 ? 0 : 7);
      v.apply(c.frame());
      const behind = pathPose(p, c.orbitFrames).behind;
      seen.add(behind);
      expect(v.isBehind('orb_a')).toBe(behind);
      expect(v.isBehind('orb_a_glow')).toBe(behind);
      expect(rank(v, 'ring_back')).toBeLessThan(rank(v, 'orb_a'));
      if (behind) expect(rank(v, 'orb_a')).toBeLessThan(rank(v, 'body'));
      else expect(rank(v, 'body')).toBeLessThan(rank(v, 'orb_a'));          // near: its yaml slot, after the body
      expect(rank(v, 'orb_a')).toBeLessThan(rank(v, 'orb_a_glow'));
      const pose = pathPose(p, c.orbitFrames);
      expect(v.layerNode('orb_a')!.x).toBeCloseTo(pose.dx, 9);
      expect(v.layerNode('orb_a')!.y).toBeCloseTo(pose.dy, 9);
    }
    expect([...seen].sort()).toEqual([false, true]);
  });

  it('the real Orrery: four orbs on two rings turning opposite ways, periods 6-10 s; white starts far, the rest near', () => {
    const f = real();
    expect(Object.keys(f.rings!).sort()).toEqual(['A', 'B']);
    expect(f.rings!.A.dir).toBe(-f.rings!.B.dir);
    const orbs = f.layers.filter((l) => l.kind === 'orb').map((l) => l.name);
    expect(orbs.sort()).toEqual(['orb_cyan', 'orb_orange', 'orb_teal', 'orb_white']);
    for (const o of orbs) {
      expect(f.orbits![o].periodMs).toBeGreaterThanOrEqual(6000);
      expect(f.orbits![o].periodMs).toBeLessThanOrEqual(10000);
      expect(f.layers.find((l) => l.name === `${o}_glow`)).toMatchObject({ kind: 'orb_glow', blend: 'add' });
    }
    const v = new ColossusView('chaos_orrery', f, noTextures);
    v.apply(new ColossusPoseController(v.layerInfo).frame());
    expect(orbs.filter((o) => v.isBehind(o))).toEqual(['orb_white']);
    expect(rank(v, 'ring_back')).toBeLessThan(rank(v, 'orb_white'));
    expect(rank(v, 'orb_white')).toBeLessThan(rank(v, 'body'));
    for (const o of ['orb_cyan', 'orb_orange', 'orb_teal']) {
      expect(rank(v, 'body')).toBeLessThan(rank(v, o));
      expect(rank(v, o)).toBeLessThan(rank(v, 'glow'));
    }
  });
});
