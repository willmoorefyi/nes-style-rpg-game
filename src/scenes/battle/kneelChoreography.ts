/**
 * The kneel state (docs/KNEEL_PLAN.md 3, D-K2, D-K3): pure frame tables and the per-actor KneelTrack, no PixiJS.
 * `t` and `clock` are 60 fps frames.
 *   in      kneel_in1 4, kneel_in2 4, then the hold (KNEEL_IN_FRAMES 8)
 *   hold    kneel / kneel_b alternating every KNEEL_PERIOD 48, offset index * 17
 *   out     kneel_in2 3, kneel_in1 3 (KNEEL_OUT_FRAMES 6): the stand-up, the rise to act and the victory rise
 *   reversal a flip mid-transition continues from the frame on screen (time mirrored)
 * A hit on a kneeler is a shake (hero +-2 px for 12 frames, enemy +-3 px for 14), never a hurt pose.
 */

export const KNEEL_FRAMES = ['kneel_in1', 'kneel_in2', 'kneel', 'kneel_b'] as const;
export type KneelFrame = typeof KNEEL_FRAMES[number];

export const KNEEL_IN_FRAMES = 8;
export const KNEEL_OUT_FRAMES = 6;
export const KNEEL_PERIOD = 48;
/** The per-actor phase offset of the hold (as the breathing idle). */
export const KNEEL_PHASE = 17;
export const HERO_SHAKE = { px: 2, frames: 12 } as const;
export const ENEMY_SHAKE = { px: 3, frames: 14 } as const;

export const isKneelFrame = (f: string): f is KneelFrame => (KNEEL_FRAMES as readonly string[]).includes(f);

/** D-K1: a hero is weak at 25 % HP or less (and still standing). */
export function isWeak(hp: number, maxHp: number): boolean {
  return hp > 0 && hp * 4 <= maxHp;
}

/** D-K3: the frame shown `age` frames into an acting kneeler's action (kneel_in2 3, kneel_in1 3), or null after it. */
export function riseFrame(age: number): KneelFrame | null {
  return age < 0 ? null : age < KNEEL_OUT_FRAMES / 2 ? 'kneel_in2' : age < KNEEL_OUT_FRAMES ? 'kneel_in1' : null;
}

/**
 * D-K3 option 1: the time a rising actor's motion is sampled at. The motion holds its frame-0 value for t < 6, is
 * compressed into [6, end) (t' = (t - 6) x end / (end - 6)) and is unchanged from `end` on. `end` is the first segment
 * boundary at or after frame 12 (it must be <= the contact frame). Only offsets use it: frame names and cues run on t.
 */
export function riseTime(t: number, end: number): number {
  if (t < KNEEL_OUT_FRAMES) return 0;
  return t < end ? ((t - KNEEL_OUT_FRAMES) * end) / (end - KNEEL_OUT_FRAMES) : t;
}

/** The first boundary at or after frame 12 of segments of these lengths (the D-K3 motion window E). */
export function riseEnd(lengths: readonly number[]): number {
  let at = 0;
  for (const n of lengths) { at += n; if (at >= 12) return at; }
  return at;
}

/** The +-px shake `local` frames into a hit (away first, then back, every 2 frames); 0 once it is over. */
export function kneelShake(local: number, shake: { px: number; frames: number }): number {
  if (local < 0 || local >= shake.frames) return 0;
  return Math.floor(local / 2) % 2 === 0 ? -shake.px : shake.px;
}

type Phase = 'off' | 'in' | 'hold' | 'out';

/** One actor's kneel: `set` it on or off at a clock, read the frame (null: standing) at any later clock. */
export class KneelTrack {
  private phase: Phase = 'off';
  private start = 0;

  constructor(private readonly index = 0) {}

  /** Kneel (on) or stand (off) from `clock`. `hold: true` snaps: on goes straight into the hold (battle start, retry,
   *  a revive into a trigger), off cuts the kneel at once (stone, KO, an action's rise). A repeat is a no-op. */
  set(on: boolean, clock: number, opts: { hold?: boolean } = {}): void {
    this.settle(clock);
    if (opts.hold) {
      if (this.phase !== (on ? 'hold' : 'off')) { this.phase = on ? 'hold' : 'off'; this.start = clock; }
      return;
    }
    const e = clock - this.start;
    if (on && (this.phase === 'off' || this.phase === 'out')) {
      this.start = clock - (this.phase === 'out' ? (1 - e / KNEEL_OUT_FRAMES) * KNEEL_IN_FRAMES : 0);
      this.phase = 'in';
    } else if (!on && (this.phase === 'in' || this.phase === 'hold')) {
      this.start = clock - (this.phase === 'in' ? (1 - e / KNEEL_IN_FRAMES) * KNEEL_OUT_FRAMES : 0);
      this.phase = 'out';
    }
  }

  /** It is kneeling or going down (the trigger holds). */
  get on(): boolean { return this.phase === 'in' || this.phase === 'hold'; }

  /** The kneel frame at `clock`, or null when standing. */
  frame(clock: number): KneelFrame | null {
    this.settle(clock);
    const e = clock - this.start;
    switch (this.phase) {
      case 'in': return e < KNEEL_IN_FRAMES / 2 ? 'kneel_in1' : 'kneel_in2';
      case 'out': return e < KNEEL_OUT_FRAMES / 2 ? 'kneel_in2' : 'kneel_in1';
      case 'hold': return Math.floor((clock + this.index * KNEEL_PHASE) / KNEEL_PERIOD) % 2 === 0 ? 'kneel' : 'kneel_b';
      default: return null;
    }
  }

  /** How far down it is, 0 (standing) to 1 (the hold): eased out over `in`, eased in over `out` (the floaters' sink). */
  amount(clock: number): number {
    this.settle(clock);
    const e = clock - this.start;
    if (this.phase === 'in') { const p = e / KNEEL_IN_FRAMES; return 1 - (1 - p) * (1 - p); }
    if (this.phase === 'out') { const p = e / KNEEL_OUT_FRAMES; return 1 - p * p; }
    return this.phase === 'hold' ? 1 : 0;
  }

  /** Frames into the current phase (the dev pose label). */
  local(clock: number): number {
    this.settle(clock);
    return this.phase === 'off' ? 0 : clock - this.start;
  }

  /** in becomes the hold and out becomes off once their frames have passed. */
  private settle(clock: number): void {
    if (this.phase === 'in' && clock - this.start >= KNEEL_IN_FRAMES) { this.start += KNEEL_IN_FRAMES; this.phase = 'hold'; }
    if (this.phase === 'out' && clock - this.start >= KNEEL_OUT_FRAMES) { this.start += KNEEL_OUT_FRAMES; this.phase = 'off'; }
  }
}
