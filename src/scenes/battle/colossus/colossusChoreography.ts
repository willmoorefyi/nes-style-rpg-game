/**
 * Colossus timelines (docs/CHAOS_FORMS_PLAN.md 4.3): frame tables for the layered puppet, like enemyChoreography.ts.
 * Pure (no PixiJS). Layers move in whole art px; the canvas shakes in whole screen px. A colossus never lunges: the
 * only canvas motion is the hurt shake (+-3) and the screen shake, so |dx| <= 12 on every frame.
 *
 *   idle  144 loop  body bob 0 / -1 art px (half period 72); core alpha 0.75 -> 1 -> 0.75 in 4 steps; moons orbit
 *                   1 art px / 4 frames; corona 4-step pulse (96, out of step); clouds drift 1 art px / 20 frames
 *   slam   44       limb / hand raise (12) -> hold (8) -> slam (4) -> contact 24 (shake + the hit) -> recoil (8) -> back (12)
 *   beam   40       glow flares to 1 (10), release at 10 (the beam from the core), hold, fade
 *   cast   40       glow flare, moons orbit x2, release at 20
 *   hurt   20       per-layer white flash 2 on / 2 off x2 and a +-3 screen px shake, no recoil travel
 *   roar   60       interlude only: every layer +-1 art px jitter, glow 1, shake at 0 and 30
 *   dying 150       core white-out (30), sink 2 art px / frame (90), white fade to 1 (30)
 */
import type { ColossusLayerKind, XY } from './colossusIndex.js';

export type ColossusTimeline = 'idle' | 'slam' | 'beam' | 'cast' | 'hurt' | 'roar' | 'dying';
export const TIMELINE_FRAMES: Readonly<Record<ColossusTimeline, number>> = {
  idle: 144, slam: 44, beam: 40, cast: 40, hurt: 20, roar: 60, dying: 150,
};
export const SLAM_CONTACT = 24;
export const BEAM_RELEASE = 10;
export const CAST_RELEASE = 20;
export const DYING_SINK_START = 30;
export const DYING_SINK_FRAMES = 90;
export const DYING_SINK_PX = 2;
export const HURT_SHAKE: readonly number[] = [3, 3, -3, -3, 2, 2, -2, -2, 1, 1, -1, -1];

export type ColossusCue = 'contact' | 'release' | 'shake';
const CUES: Partial<Record<ColossusTimeline, [number, ColossusCue][]>> = {
  slam: [[SLAM_CONTACT, 'contact'], [SLAM_CONTACT, 'shake']],
  beam: [[BEAM_RELEASE, 'release']],
  cast: [[CAST_RELEASE, 'release']],
  roar: [[0, 'shake'], [30, 'shake']],
};

/** What a timeline needs to know about a layer. */
export interface LayerInfo { name: string; kind: ColossusLayerKind; frames: readonly string[]; orbit?: number }

export interface LayerPose {
  /** The frame to show (a layer without it shows `base`). */
  frame: string;
  /** Art px offset from the frame's place. */
  dx: number;
  dy: number;
  alpha: number;
  /** Show the white silhouette (the hurt flash, the core white-out). */
  white: boolean;
  /** A moon in the back half of its orbit draws behind the body. */
  behind: boolean;
}

export interface ColossusPoseFrame {
  /** Canvas shake, screen px (hurt). */
  dx: number;
  dy: number;
  /** Art px: the breathing bob of everything but the overhang (the hand stays on the rim). */
  bob: number;
  /** Art px the whole canvas has sunk (dying). */
  sink: number;
  /** The white fade over the battle (dying), stepped alpha. */
  overlay: number;
  layers: LayerPose[];
}

const step4 = (a: number): number => Math.round(Math.min(1, Math.max(0, a)) * 4) / 4;
const CORE_STEPS = [0.75, 0.8125, 0.875, 1, 1, 0.875, 0.8125, 0.75];
const CORONA_STEPS = [0.75, 0.875, 1, 0.875];

/** A point on a diamond orbit of radius r (4r whole-px steps), at step k. */
export function orbitPoint(k: number, r: number): XY {
  const n = 4 * r;
  const s = ((k % n) + n) % n;
  const side = Math.floor(s / r);
  const u = s % r;
  const pts: XY[] = [[r - u, u], [-u, r - u], [-r + u, -u], [u, -r + u]];
  return pts[side];
}

/** Triangle wave in whole steps between -a and +a. */
const tri = (k: number, a: number): number => {
  const p = 4 * a;
  const s = ((k % p) + p) % p;
  return s < 2 * a ? s - a : 3 * a - s;
};

/** The ambient pose of layer `info` (index k among the moons) at clock c. */
function ambient(info: LayerInfo, c: number, k: number, moonSpeed: number): LayerPose {
  const pose: LayerPose = { frame: 'base', dx: 0, dy: 0, alpha: 1, white: false, behind: false };
  if (info.kind === 'core') pose.alpha = CORE_STEPS[Math.floor(c / 18) % CORE_STEPS.length];
  if (info.kind === 'corona') pose.alpha = CORONA_STEPS[Math.floor(c / 24) % CORONA_STEPS.length];
  if (info.kind === 'glow') pose.alpha = 0.5;
  if (info.kind === 'cloud') pose.dx = tri(Math.floor(c / 20), 4);
  if (info.kind === 'moon') {
    const r = info.orbit ?? 4;
    const step = Math.floor((c * moonSpeed) / 4) + k * r;
    [pose.dx, pose.dy] = orbitPoint(step, r);
    pose.behind = pose.dy < 0;
  }
  return pose;
}

/** The limb frame of the slam (an arm, or the gripping hand's lift / slam). */
function slamFrame(info: LayerInfo, t: number): string {
  const limb = info.kind === 'limb';
  const up = limb ? 'raise' : 'lift';
  const want = t < 20 ? up : t < SLAM_CONTACT ? 'slam' : t < 32 ? (limb ? 'recoil' : 'slam') : t < 38 ? up : 'base';
  return info.frames.includes(want) ? want : 'base';
}

/** The glow's flare: up in 4 steps, held, then back down to the idle 0.5. */
function flare(t: number, up: number, down: number, total: number): number {
  if (t < up) return step4(0.5 + (0.5 * (t + 1)) / up);
  if (t < down) return 1;
  return step4(1 - (0.5 * (t - down + 1)) / (total - down));
}

/** The pose of every layer and the canvas at frame t of `timeline` (ambient clock `clock`). */
export function poseAt(timeline: ColossusTimeline, t: number, clock: number, layers: readonly LayerInfo[]): ColossusPoseFrame {
  const f = Math.max(0, Math.floor(t));
  const c = Math.floor(clock);
  const moonSpeed = timeline === 'cast' ? 2 : 1;
  let moon = 0;
  const out: ColossusPoseFrame = { dx: 0, dy: 0, bob: Math.floor(c / 72) % 2 === 0 ? 0 : -1, sink: 0, overlay: 0, layers: [] };
  for (const info of layers) {
    const p = ambient(info, c, info.kind === 'moon' ? moon++ : 0, moonSpeed);
    if (timeline === 'slam' && (info.kind === 'overhang' || info.name === 'arm_r' || info.name === 'gauntlet_r'
      || (info.kind === 'limb' && !layers.some((l) => l.name === 'arm_r' || l.name === 'gauntlet_r' || l.kind === 'overhang')))) {
      p.frame = slamFrame(info, f);
    }
    if (info.kind === 'glow' && timeline === 'beam') p.alpha = flare(f, BEAM_RELEASE, 30, 40);
    if (info.kind === 'glow' && timeline === 'cast') p.alpha = flare(f, 8, 32, 40);
    if (info.kind === 'core' && (timeline === 'beam' || timeline === 'dying')) p.alpha = 1;
    if (timeline === 'hurt') p.white = f < 8 && f % 4 < 2;
    if (timeline === 'roar') {
      p.dx += Math.floor(f / 2) % 2 === 0 ? 1 : -1;
      p.dy += Math.floor(f / 4) % 2 === 0 ? 0 : 1;
      if (info.kind === 'glow') p.alpha = 1;
    }
    if (timeline === 'dying' && info.kind === 'core') p.white = true;
    out.layers.push(p);
  }
  if (timeline === 'hurt') out.dx = HURT_SHAKE[f] ?? 0;
  if (timeline === 'dying') {
    out.sink = DYING_SINK_PX * Math.min(DYING_SINK_FRAMES, Math.max(0, f - DYING_SINK_START));
    const fade = DYING_SINK_START + DYING_SINK_FRAMES;
    out.overlay = f < fade ? 0 : step4((f - fade + 1) / (TIMELINE_FRAMES.dying - fade));
  }
  return out;
}

/** The cues whose frame lies in [from, to) of `timeline`. */
export function cuesBetween(timeline: ColossusTimeline, from: number, to: number): ColossusCue[] {
  return (CUES[timeline] ?? []).filter(([at]) => at >= from && at < to).map(([, cue]) => cue);
}

/** The rise (art px below rest) at frame t of a `frames`-long rise from `fromDy`, in 2 art px steps, 0 at the end. */
export function riseAt(t: number, frames: number, fromDy: number): number {
  if (t >= frames || frames <= 0) return 0;
  const u = Math.max(0, t) / frames;
  return Math.max(0, fromDy - 2 * Math.floor((u * fromDy) / 2));
}

export type PanEase = 'linear' | 'out';
/** The pan offset (art px from rest) at frame t: from `from` to (0, 0), whole art px. */
export function panAt(t: number, frames: number, from: XY, ease: PanEase = 'linear'): { x: number; y: number } {
  const u = frames <= 0 ? 1 : Math.min(1, Math.max(0, t) / frames);
  const k = ease === 'out' ? 1 - (1 - u) * (1 - u) : u;
  return { x: Math.round(from[0] * (1 - k)) || 0, y: Math.round(from[1] * (1 - k)) || 0 };
}
