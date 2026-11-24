/**
 * The orbits of a colossus form (EF-E, docs/ENEMY_FEEDBACK_PLAN.md): its `orb` layers travel along the form's gold
 * rings (`rings`, `orbits` in colossus.json, written by colossus_build.py from the layer yaml), each `orb_glow` halo
 * with its orb. Pure (no PixiJS): the reader's checks, the ring geometry, and an orb's offset and depth at a clock.
 */
import type { ColossusFormSpec } from './colossusIndex.js';

/** A ring (EF-E): an ellipse in art px, a point at parametric angle t is centre + R(tilt) (a cos t, b sin t) (screen y
 *  down); the near half, in front of the body, is sin t > 0; `dir` 1: t grows with the clock, -1: it falls. */
export interface ColossusRing { centre: [number, number]; axes: [number, number]; tilt: number; dir: 1 | -1 }
/** An orb's orbit: its ring, its phase at clock 0 (its painted spot) and the period of one turn (ms). */
export interface ColossusOrbit { ring: string; phase0: number; periodMs: number }

/** A layer that travels along an orbit: an orb or its halo. */
export const isOrbLayer = (l: { kind: string }): boolean => l.kind === 'orb' || l.kind === 'orb_glow';

/** Frames per second of the colossus clocks (ColossusPoseController counts frames of 1/60 s). */
export const ORBIT_FPS = 60;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;
const pair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(finite);

/** EF-E: rings well formed, every orb layer on an orbit of a known ring, every orb_glow layer named `<orb>_glow`. */
export function orbitProblems(f: ColossusFormSpec): string[] {
  const out: string[] = [];
  const rings = f.rings ?? {};
  const orbits = f.orbits ?? {};
  for (const [k, r] of Object.entries(rings)) {
    if (!r || !pair(r.centre) || !pair(r.axes) || !(r.axes[0] > 0 && r.axes[1] > 0) || !finite(r.tilt) || (r.dir !== 1 && r.dir !== -1)) {
      out.push(`ring ${k}: needs centre, axes > 0, tilt and dir 1 | -1`);
    }
  }
  const kinds = new Map((f.layers ?? []).map((l) => [l.name, l.kind]));
  for (const [name, o] of Object.entries(orbits)) {
    if (kinds.get(name) !== 'orb') out.push(`orbit ${name}: no orb layer of that name`);
    if (!o || !(o.ring in rings) || !finite(o.phase0) || !positive(o.periodMs)) out.push(`orbit ${name}: needs a known ring, phase0 and periodMs > 0`);
  }
  for (const [name, kind] of kinds) {
    if (kind === 'orb' && !(name in orbits)) out.push(`layer ${name}: an orb layer needs an orbit`);
    if (kind === 'orb_glow' && !(name.endsWith('_glow') && kinds.get(name.slice(0, -5)) === 'orb')) out.push(`layer ${name}: an orb_glow layer is named <orb>_glow`);
  }
  return out;
}

/** The ring and orbit an orb or orb_glow layer moves on (a glow follows its orb), or null. */
export function orbitOf(f: ColossusFormSpec, layer: string): OrbitPath | null {
  const o = f.orbits?.[layer] ?? (layer.endsWith('_glow') ? f.orbits?.[layer.slice(0, -5)] : undefined);
  const ring = o ? f.rings?.[o.ring] : undefined;
  return o && ring ? { ring, orbit: o } : null;
}

/** The point of a ring at parametric angle t (art px). */
export function ringPoint(r: ColossusRing, t: number): { x: number; y: number } {
  const c = Math.cos(r.tilt);
  const s = Math.sin(r.tilt);
  const u = r.axes[0] * Math.cos(t);
  const v = r.axes[1] * Math.sin(t);
  return { x: r.centre[0] + u * c - v * s, y: r.centre[1] + u * s + v * c };
}


/** An orbit with its ring (what a pose needs). */
export interface OrbitPath { ring: ColossusRing; orbit: ColossusOrbit }

/** An orb layer's pose at orbit clock `clock` (frames): its offset (art px) from its painted spot, and whether it is
 *  on the far half (sin t <= 0: drawn behind the body). */
export function pathPose(path: OrbitPath, clock: number): { dx: number; dy: number; behind: boolean } {
  const t = orbitAngle(path.ring, path.orbit, clock);
  const p = ringPoint(path.ring, t);
  const p0 = ringPoint(path.ring, path.orbit.phase0);
  return { dx: p.x - p0.x, dy: p.y - p0.y, behind: !(Math.sin(t) > 0) };
}

/** The parametric angle of an orbit at clock `clock` (frames): phase0 + dir x 2 pi x elapsed / period. */
export function orbitAngle(r: ColossusRing, o: ColossusOrbit, clock: number): number {
  return o.phase0 + r.dir * 2 * Math.PI * ((clock * 1000) / ORBIT_FPS / o.periodMs);
}
