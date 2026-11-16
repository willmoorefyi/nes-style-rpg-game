/**
 * Colossus timelines (docs/CHAOS_FORMS_PLAN.md 4.3; rev 4: 18.3): frame tables for the painted forms, like
 * enemyChoreography.ts. Pure (no PixiJS). The canvas moves sub-pixel (the breathing, the slam, the sink, screen px);
 * only the hurt shake is whole screen px. A colossus never lunges, so |dx| <= 12 on every frame. Alphas are the layer's
 * rest alpha (colossus.json, default 1) times its pulse.
 *
 *   idle  144 loop  breathing: the canvas dy 0 -> -4 -> 0 px (cosine); glow pulse 1 <-> 0.85 (288 frames), corona
 *                   1 <-> 0.8 (96 frames); moons orbit 1 art px / 4 frames; clouds drift 1 art px / 20 frames
 *   slam   44       the dip dy -12 px (12, the wind-up), hold (8), slam to +8 (4; contact at 24: the shake, the hit and
 *                   a glow flare), back to rest (20); limbs (a layered form) raise / slam / recoil
 *   beam   40       glow and corona flare to their rest alpha (10), release at 10 (the beam from the core), hold, ease back
 *   cast   40       the flare, moons orbit x2, release at 20
 *   hurt   20       a white flash on the normal layers 2 on / 2 off x2 (the view's additive copy) and a +-3 px shake
 *   roar   60       interlude only: every layer +-1 art px jitter, glow and corona at rest alpha, shake at 0 and 30
 *   dying 150       flare and the core's white (30), sink 2 px / frame while every layer fades (90), white fade (30)
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
/** The breathing's amplitude (screen px the canvas rises at the top of a breath; the pan limits' envelope, B4). */
export const BREATH_PX = 4;
/** The slam's dip (up) and its slam (down) past rest, screen px. */
export const SLAM_DIP_PX = 12;
export const SLAM_DROP_PX = 8;
/** Glow and corona pulse floors (18.3), as a fraction of the rest alpha. */
export const GLOW_PULSE_MIN = 0.85;
export const CORONA_PULSE_MIN = 0.8;

export type ColossusCue = 'contact' | 'release' | 'shake';
const CUES: Partial<Record<ColossusTimeline, [number, ColossusCue][]>> = {
  slam: [[SLAM_CONTACT, 'contact'], [SLAM_CONTACT, 'shake']],
  beam: [[BEAM_RELEASE, 'release']],
  cast: [[CAST_RELEASE, 'release']],
  roar: [[0, 'shake'], [30, 'shake']],
};

/** What a timeline needs to know about a layer. */
export interface LayerInfo { name: string; kind: ColossusLayerKind; frames: readonly string[]; orbit?: number; alpha?: number }

export interface LayerPose {
  /** The frame to show (a layer without it shows `base`). */
  frame: string;
  /** Art px offset from the frame's place. */
  dx: number;
  dy: number;
  /** The layer's alpha (its rest alpha times its pulse or fade). */
  alpha: number;
  /** Show the white flash (the hurt, the core at the dying). */
  white: boolean;
  /** A moon in the back half of its orbit draws behind the body. */
  behind: boolean;
}

export interface ColossusPoseFrame {
  /** Canvas shake, whole screen px (hurt). */
  dx: number;
  dy: number;
  /** The canvas's own motion, screen px, sub-pixel: the breathing plus the slam's dip and drop. */
  bob: number;
  /** Screen px the whole canvas has sunk (dying). */
  sink: number;
  /** The white fade over the battle (dying), 0..1. */
  overlay: number;
  layers: LayerPose[];
}

const clamp01 = (a: number): number => Math.min(1, Math.max(0, a));
/** A cosine pulse: 1 at clock 0, `min` at half the period. */
const pulse = (c: number, period: number, min: number): number => min + (1 - min) * (0.5 + 0.5 * Math.cos((2 * Math.PI * c) / period));

/** The breathing at clock c: 0 at rest, -BREATH_PX at the top of the 144-frame loop. */
export const breathAt = (c: number): number => -BREATH_PX * (0.5 - 0.5 * Math.cos((2 * Math.PI * c) / TIMELINE_FRAMES.idle));

/** The slam's canvas motion at frame t (screen px; negative is up). */
export function slamAt(t: number): number {
  if (t < 12) return (-SLAM_DIP_PX * (t + 1)) / 12;
  if (t < 20) return -SLAM_DIP_PX;
  if (t < SLAM_CONTACT) return -SLAM_DIP_PX + ((SLAM_DIP_PX + SLAM_DROP_PX) * (t - 19)) / 4;
  return t < TIMELINE_FRAMES.slam ? SLAM_DROP_PX * (1 - (t - SLAM_CONTACT + 1) / 20) : 0;
}

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
  const rest = info.alpha ?? 1;
  const pose: LayerPose = { frame: 'base', dx: 0, dy: 0, alpha: rest, white: false, behind: false };
  if (info.kind === 'glow') pose.alpha = rest * pulse(c, 2 * TIMELINE_FRAMES.idle, GLOW_PULSE_MIN);
  if (info.kind === 'corona') pose.alpha = rest * pulse(c, 96, CORONA_PULSE_MIN);
  if (info.kind === 'cloud') pose.dx = tri(Math.floor(c / 20), 4);
  if (info.kind === 'moon') {
    const r = info.orbit ?? 4;
    const step = Math.floor((c * moonSpeed) / 4) + k * r;
    [pose.dx, pose.dy] = orbitPoint(step, r);
    pose.behind = pose.dy < 0;
  }
  return pose;
}

/** A layered form's limb frame during the slam (raise, slam, recoil). */
function slamFrame(info: LayerInfo, t: number): string {
  const want = t < 20 ? 'raise' : t < SLAM_CONTACT ? 'slam' : t < 32 ? 'recoil' : t < 38 ? 'raise' : 'base';
  return info.frames.includes(want) ? want : 'base';
}

/** How far a light layer (glow, corona) has flared from its pulse to its rest alpha: up over `up`, held, then eased back. */
function flare(t: number, up: number, down: number, total: number): number {
  if (t < up) return (t + 1) / up;
  if (t < down) return 1;
  return clamp01(1 - (t - down + 1) / (total - down));
}

/** The pose of every layer and the canvas at frame t of `timeline` (ambient clock `clock`). */
export function poseAt(timeline: ColossusTimeline, t: number, clock: number, layers: readonly LayerInfo[]): ColossusPoseFrame {
  const f = Math.max(0, Math.floor(t));
  const c = Math.floor(clock);
  const moonSpeed = timeline === 'cast' ? 2 : 1;
  const slamLimbs = layers.filter((l) => l.kind === 'limb');
  const slamming = slamLimbs.some((l) => /_r$/.test(l.name)) ? slamLimbs.filter((l) => /_r$/.test(l.name)) : slamLimbs;
  const lit = timeline === 'beam' ? flare(f, BEAM_RELEASE, 30, 40) : timeline === 'cast' ? flare(f, 8, 32, 40)
    : timeline === 'slam' ? (f >= SLAM_CONTACT && f < SLAM_CONTACT + 8 ? 1 : 0) : timeline === 'roar' || (timeline === 'dying' && f < DYING_SINK_START) ? 1 : 0;
  const fading = timeline === 'dying' ? clamp01(1 - (f - DYING_SINK_START) / DYING_SINK_FRAMES) : 1;
  let moon = 0;
  const out: ColossusPoseFrame = { dx: 0, dy: 0, bob: breathAt(c) + (timeline === 'slam' ? slamAt(f) : 0), sink: 0, overlay: 0, layers: [] };
  for (const info of layers) {
    const p = ambient(info, c, info.kind === 'moon' ? moon++ : 0, moonSpeed);
    const rest = info.alpha ?? 1;
    if (timeline === 'slam' && slamming.includes(info)) p.frame = slamFrame(info, f);
    if (info.kind === 'glow' || info.kind === 'corona') p.alpha += (rest - p.alpha) * lit;
    if (timeline === 'hurt') p.white = f < 8 && f % 4 < 2;
    if (timeline === 'roar') {
      p.dx += Math.floor(f / 2) % 2 === 0 ? 1 : -1;
      p.dy += Math.floor(f / 4) % 2 === 0 ? 0 : 1;
    }
    if (timeline === 'dying' && info.kind === 'core') p.white = true;
    p.alpha *= fading;
    out.layers.push(p);
  }
  if (timeline === 'hurt') out.dx = HURT_SHAKE[f] ?? 0;
  if (timeline === 'dying') {
    out.sink = DYING_SINK_PX * Math.min(DYING_SINK_FRAMES, Math.max(0, f - DYING_SINK_START));
    const fade = DYING_SINK_START + DYING_SINK_FRAMES;
    out.overlay = f < fade ? 0 : clamp01((f - fade + 1) / (TIMELINE_FRAMES.dying - fade));
  }
  return out;
}

/** The cues whose frame lies in [from, to) of `timeline`. */
export function cuesBetween(timeline: ColossusTimeline, from: number, to: number): ColossusCue[] {
  return (CUES[timeline] ?? []).filter(([at]) => at >= from && at < to).map(([, cue]) => cue);
}

/** The rise (screen px below its end) at frame t of a `frames`-long rise from `fromDy`, in 2 px steps, 0 at the end. */
export function riseAt(t: number, frames: number, fromDy: number): number {
  if (t >= frames || frames <= 0) return 0;
  const u = Math.max(0, t) / frames;
  return Math.max(0, fromDy - 2 * Math.floor((u * fromDy) / 2));
}

export type PanEase = 'linear' | 'out';
/** The pan offset (screen px from rest) at frame t: from `from` to (0, 0), whole px. */
export function panAt(t: number, frames: number, from: XY, ease: PanEase = 'linear'): { x: number; y: number } {
  const u = frames <= 0 ? 1 : Math.min(1, Math.max(0, t) / frames);
  const k = ease === 'out' ? 1 - (1 - u) * (1 - u) : u;
  return { x: Math.round(from[0] * (1 - k)) || 0, y: Math.round(from[1] * (1 - k)) || 0 };
}
