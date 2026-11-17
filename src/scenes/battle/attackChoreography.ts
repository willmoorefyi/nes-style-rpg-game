import type { BattlePose } from '../../rendering/CharacterAtlas.js';
import { riseEnd, riseTime } from './kneelChoreography.js';

/**
 * Party melee attack choreography: where the attacker is and which battle pose it shows at each frame of the
 * advance (wind-up, run in, strike) and of the return. Offsets are in screen px; dx < 0 moves toward the enemies.
 * Pure data, no rendering, so it can be tested and swapped (`?attack=<style>` in dev builds).
 */
export interface AttackFrame { dx: number; dy: number; pose: BattlePose }

export type AttackStyle = 'lunge' | 'dash' | 'leap' | 'classic';
export const ATTACK_STYLES: readonly AttackStyle[] = ['lunge', 'dash', 'leap', 'classic'];
export const DEFAULT_ATTACK_STYLE: AttackStyle = 'lunge';

/** How far (px) the attacker ends up in front of its place in line: clamped to [MIN, MAX] (BA-9). */
export const MIN_ATTACK_REACH = 150;
export const MAX_ATTACK_REACH = 900;
/** The attacker's sprite box ends this far inside the target's box, so the figures (inset in their cells) touch. */
export const REACH_OVERLAP = 24;

/** U3: the most (px) a melee attacker rises or drops to meet its target's row (party feet 425-740, enemy feet from 360). */
export const MAX_ATTACK_RISE = 400;

/** U3: the full offset of the contact frame: `dx` toward the enemies (as `attackReach`, positive), `dy` down to the target's feet row. */
export interface AttackReach { dx: number; dy: number }

/** U3: the vertical move that brings an attacker whose feet are at `actorFeetY` to a target whose feet are at `targetFeetY`. */
export function attackRise(actorFeetY: number, targetFeetY: number): number {
  const d = targetFeetY - actorFeetY;
  return Number.isFinite(d) ? Math.max(-MAX_ATTACK_RISE, Math.min(MAX_ATTACK_RISE, d)) : 0;
}

/** BA-9: the reach that brings an attacker at `homeX` (its sprite's left edge) to a target whose right edge is `targetRight`. */
export function attackReach(homeX: number, targetRight: number): number {
  const d = homeX - targetRight + REACH_OVERLAP;
  return Math.max(MIN_ATTACK_REACH, Math.min(MAX_ATTACK_REACH, Number.isFinite(d) ? d : MIN_ATTACK_REACH));
}

const easeIn = (p: number) => p * p;
const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
const hop = (p: number, h: number) => -h * Math.sin(Math.PI * clamp01(p));

interface Segment { frames: number; at: (p: number) => AttackFrame }

/** The advance of each style for a reach of `D` px; every style ends at dx = -D. */
const segments = (D: number): Record<AttackStyle, Segment[]> => ({
  // draw the weapon back and coil, spring in low, then a short burst forward in the strike pose
  lunge: [
    { frames: 9, at: p => ({ dx: 12 * easeOut(p), dy: hop(p, 3), pose: p < 0.45 ? 'atk_wind1' : 'atk_wind2' }) },
    { frames: 9, at: p => ({ dx: 12 - (12 + D - 36) * easeIn(p), dy: hop(p, 14), pose: p < 0.55 ? 'atk_wind2' : 'atk_mid' }) },
    { frames: 6, at: p => ({ dx: -(D - 36) - 36 * easeOut(p), dy: 0, pose: p < 0.34 ? 'atk_mid' : 'attack' }) },
  ],
  // no wind-up: sprint straight in coiled and thrust on arrival
  dash: [
    { frames: 10, at: p => ({ dx: -(D - 30) * easeIn(p), dy: hop(p * 2, 5), pose: p < 0.6 ? 'atk_wind2' : 'atk_mid' }) },
    { frames: 5, at: p => ({ dx: -(D - 30) - 30 * easeOut(p), dy: 0, pose: 'attack' }) },
  ],
  // crouch, jump in with the weapon raised overhead, and come down striking
  leap: [
    { frames: 6, at: p => ({ dx: 6 * p, dy: 8 * Math.sin(Math.PI / 2 * p), pose: 'atk_wind2' }) },
    { frames: 16, at: p => ({ dx: 6 - (6 + D) * easeInOut(p), dy: 8 * (1 - p) + hop(p, 56), pose: p < 0.8 ? 'victory' : 'atk_mid' }) },
    { frames: 6, at: p => ({ dx: -D - 10 * Math.sin(Math.PI * p), dy: 0, pose: 'attack' }) },
  ],
  // the original: strike pose at once, straight slide
  classic: [
    { frames: 15, at: p => ({ dx: -D * p, dy: 0, pose: 'attack' }) },
  ],
});

/** Frame counts do not depend on the reach. */
export function advanceFrames(style: AttackStyle): number {
  return segments(MIN_ATTACK_REACH)[style].reduce((n, s) => n + s.frames, 0);
}

/**
 * Pose and offset `t` frames into the advance (clamped to its last frame: the moment of contact, dx = -reach.dx).
 * U3: the attacker also moves `reach.dy` toward the target's row in step with its horizontal progress (its share of
 * the advance, 0 to 1), on top of the style's hop, so the contact frame lands at (-dx, dy). A number is a flat reach.
 */
export function advanceAt(style: AttackStyle, t: number, reach: number | AttackReach = MIN_ATTACK_REACH,
  opts: { rise?: boolean } = {}): AttackFrame {
  const f = reachedAt(style, t, reach);
  // D-K3: a kneeler rising to act holds its frame-0 offset for 6 frames, then the motion is compressed into [6, E)
  if (!opts.rise) return f;
  const end = riseEnd(segments(MIN_ATTACK_REACH)[style].map((s) => s.frames));
  return { ...reachedAt(style, riseTime(t, end), reach), pose: f.pose };
}

function reachedAt(style: AttackStyle, t: number, reach: number | AttackReach): AttackFrame {
  const { dx: D, dy: rise } = typeof reach === 'number' ? { dx: reach, dy: 0 } : reach;
  const f = baseAdvanceAt(style, t, D);
  return rise === 0 ? f : { ...f, dy: f.dy + rise * clamp01(-f.dx / D) };
}

function baseAdvanceAt(style: AttackStyle, t: number, D: number): AttackFrame {
  let start = 0;
  const segs = segments(D)[style];
  for (const seg of segs) {
    if (t < start + seg.frames) return seg.at(clamp01((t - start) / seg.frames));
    start += seg.frames;
  }
  return segs[segs.length - 1].at(1);
}

export const RETURN_FRAMES = 16;

/** The way back to the line: a hop backwards from `from` (the advance's last offset, both axes), easing out. */
export function returnAt(from: AttackFrame, t: number, style: AttackStyle): AttackFrame {
  const p = clamp01(t / RETURN_FRAMES);
  if (style === 'classic') return { dx: from.dx * (1 - p), dy: from.dy * (1 - p), pose: 'attack' };
  const back = 1 - easeOut(p);
  return { dx: from.dx * back, dy: from.dy * back + hop(p, 12), pose: p < 0.3 ? 'atk_follow' : 'ready' };
}

/** Spells and items: a short step forward while gathering and raising the casting hand, then the cast is held. */
export const CAST_FRAMES = 24;
const CAST_STEP = 36;

/** The cast step's last frame (the D-K3 rise window E; the effect starts at CAST_FRAMES). */
export const CAST_STEP_FRAMES = 14;

/** `rise` (D-K3): the step holds for 6 frames, then is compressed into [6, 14); poses on raw t. */
export function castAt(t: number, opts: { rise?: boolean } = {}): AttackFrame {
  const p = clamp01(t / CAST_FRAMES);
  const pose = t < 7 ? 'cast_gather' : t < CAST_STEP_FRAMES ? 'cast_rise' : 'cast';
  const m = opts.rise ? riseTime(t, CAST_STEP_FRAMES) : t;
  return { dx: -CAST_STEP * easeOut(clamp01(m / CAST_STEP_FRAMES)), dy: 0, pose: p >= 1 ? 'cast' : pose };
}

/** After the spell resolves: the release (palm flung open), then back into line. */
export function castReturnAt(from: AttackFrame, t: number): AttackFrame {
  const p = clamp01(t / RETURN_FRAMES);
  return { dx: from.dx * (1 - easeOut(clamp01((p - 0.25) / 0.75))), dy: 0, pose: p < 0.3 ? 'cast_release' : 'ready' };
}

/** Breathing idle: the in-between alternates with the ready stance, each member slightly out of phase. */
export const IDLE_PERIOD = 72;
export function idlePose(clock: number, member: number): 'ready' | 'idle_b' {
  return Math.floor((clock + member * 17) / (IDLE_PERIOD / 2)) % 2 === 0 ? 'ready' : 'idle_b';
}

export function parseAttackStyle(search: string): AttackStyle {
  return parseAttackOverride(search) ?? DEFAULT_ATTACK_STYLE;
}

/** `?attack=<style>` forces one style for every attack (dev testing); null when absent or unknown. */
export function parseAttackOverride(search: string): AttackStyle | null {
  const v = new URLSearchParams(search).get('attack');
  return (ATTACK_STYLES as readonly string[]).includes(v ?? '') ? (v as AttackStyle) : null;
}

/** Styles drawn at random for each party melee attack ('classic' is the old slide and is left out). */
export const RANDOM_ATTACK_STYLES: readonly AttackStyle[] = ['lunge', 'dash', 'leap'];

export function pickAttackStyle(rng: () => number = Math.random): AttackStyle {
  const i = Math.min(RANDOM_ATTACK_STYLES.length - 1, Math.floor(rng() * RANDOM_ATTACK_STYLES.length));
  return RANDOM_ATTACK_STYLES[i];
}
