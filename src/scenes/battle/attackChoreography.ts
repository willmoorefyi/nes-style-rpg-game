import type { BattlePose } from '../../rendering/CharacterAtlas.js';

/**
 * Party melee attack choreography: where the attacker is and which battle pose it shows at each frame of the
 * advance (wind-up, run in, strike) and of the return. Offsets are in screen px; dx < 0 moves toward the enemies.
 * Pure data, no rendering, so it can be tested and swapped (`?attack=<style>` in dev builds).
 */
export interface AttackFrame { dx: number; dy: number; pose: BattlePose }

export type AttackStyle = 'lunge' | 'dash' | 'leap' | 'classic';
export const ATTACK_STYLES: readonly AttackStyle[] = ['lunge', 'dash', 'leap', 'classic'];
export const DEFAULT_ATTACK_STYLE: AttackStyle = 'lunge';

/** How far (px) the attacker ends up in front of its place in line. */
export const ATTACK_REACH = 150;

const easeIn = (p: number) => p * p;
const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
const hop = (p: number, h: number) => -h * Math.sin(Math.PI * clamp01(p));

interface Segment { frames: number; at: (p: number) => AttackFrame }

const D = ATTACK_REACH;
const SEGMENTS: Record<AttackStyle, Segment[]> = {
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
    { frames: 15, at: p => ({ dx: -120 * p, dy: 0, pose: 'attack' }) },
  ],
};

export function advanceFrames(style: AttackStyle): number {
  return SEGMENTS[style].reduce((n, s) => n + s.frames, 0);
}

/** Pose and offset `t` frames into the advance (clamped to its last frame: the moment of contact). */
export function advanceAt(style: AttackStyle, t: number): AttackFrame {
  let start = 0;
  const segs = SEGMENTS[style];
  for (const seg of segs) {
    if (t < start + seg.frames) return seg.at(clamp01((t - start) / seg.frames));
    start += seg.frames;
  }
  return segs[segs.length - 1].at(1);
}

export const RETURN_FRAMES = 16;

/** The way back to the line: a hop backwards from `from` (the advance's last offset), easing out. */
export function returnAt(from: AttackFrame, t: number, style: AttackStyle): AttackFrame {
  const p = clamp01(t / RETURN_FRAMES);
  if (style === 'classic') return { dx: from.dx * (1 - p), dy: 0, pose: 'attack' };
  return { dx: from.dx * (1 - easeOut(p)), dy: hop(p, 12), pose: p < 0.3 ? 'atk_follow' : 'ready' };
}

/** Spells and items: a short step forward while gathering and raising the casting hand, then the cast is held. */
export const CAST_FRAMES = 24;
const CAST_STEP = 36;

export function castAt(t: number): AttackFrame {
  const p = clamp01(t / CAST_FRAMES);
  const pose = t < 7 ? 'cast_gather' : t < 14 ? 'cast_rise' : 'cast';
  return { dx: -CAST_STEP * easeOut(clamp01(t / 14)), dy: 0, pose: p >= 1 ? 'cast' : pose };
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
