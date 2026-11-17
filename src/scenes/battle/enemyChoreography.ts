/**
 * Monster battle timing (docs/ENEMY_ANIM_PLAN.md 3.2): pure frame tables, no PixiJS. Every number the play test may
 * tune lives here. `t` is in 60 fps frames; dx > 0 is toward the party, dy < 0 is up; offsets are screen px at scale
 * factor 1 (EnemyPoseController scales and rounds them once).
 */
import type { StatusPosture } from '../../types/fxData.js';
import { riseEnd, riseTime, type KneelFrame } from './kneelChoreography.js';

/** Approved keyframes in monsters-ai.json (bosses add `cast`; pass F's bosses add `attack_raise`). */
export type MonsterKeyframe = 'idle' | 'attack' | 'hurt' | 'cast' | 'attack_raise';
export type MonsterFrame = MonsterKeyframe | 'idle_b' | 'atk_wind1' | 'atk_wind2' | 'atk_mid' | 'atk_follow'
  | 'atk_recover' | 'hurt_in1' | 'hurt_in2' | 'cast_gather' | 'cast_rise' | 'cast_release'
  | 'daze' | 'daze_b' | 'atk_raise_in' | 'atk_raise_b' | 'atk_swing' | 'atk_swing2' | KneelFrame;

export const MONSTER_FRAMES: readonly MonsterFrame[] = ['idle', 'idle_b', 'atk_wind1', 'atk_wind2', 'atk_mid', 'attack',
  'atk_follow', 'atk_recover', 'hurt_in1', 'hurt_in2', 'hurt', 'daze', 'daze_b', 'kneel_in1', 'kneel_in2', 'kneel', 'kneel_b'];
export const BOSS_FRAMES: readonly MonsterFrame[] = [...MONSTER_FRAMES, 'cast_gather', 'cast_rise', 'cast', 'cast_release',
  'attack_raise', 'atk_raise_in', 'atk_raise_b', 'atk_swing', 'atk_swing2'];
/** Frames a sheet may lack (the heavy raise without an `attack_raise` key; the pass K kneel until K4, docs/KNEEL_PLAN.md
 *  3): the per-sheet key check skips them. Every sheet has its own daze / daze_b cells. */
export const LATE_FRAMES: ReadonlySet<MonsterFrame> = new Set<MonsterFrame>(['attack_raise', 'atk_raise_in', 'atk_raise_b',
  'atk_swing', 'atk_swing2', 'kneel_in1', 'kneel_in2', 'kneel', 'kneel_b']);

/** The keyframe each frame is cut from in the end (where FRAME_FALLBACK finally lands on an old atlas). */
export const FRAME_SOURCE: Record<MonsterFrame, MonsterKeyframe> = {
  idle: 'idle', attack: 'attack', hurt: 'hurt', cast: 'cast', idle_b: 'idle', atk_wind1: 'idle', atk_wind2: 'idle',
  atk_mid: 'attack', atk_follow: 'attack', atk_recover: 'idle', hurt_in1: 'idle', hurt_in2: 'hurt', cast_gather: 'idle',
  cast_rise: 'cast', cast_release: 'cast', daze: 'idle', daze_b: 'idle', attack_raise: 'idle', atk_raise_in: 'idle',
  atk_raise_b: 'idle', atk_swing: 'attack', atk_swing2: 'attack', kneel_in1: 'idle', kneel_in2: 'idle', kneel: 'idle',
  kneel_b: 'idle',
};

/** What an atlas without a frame shows instead, resolved step by step until a key exists (a keyframe maps to itself,
 *  except a boss-less `cast`, which shows `attack`). */
export const FRAME_FALLBACK: Record<MonsterFrame, MonsterFrame> = {
  ...FRAME_SOURCE, cast: 'attack', daze: 'hurt_in1', daze_b: 'daze', atk_raise_in: 'atk_wind1',
  attack_raise: 'atk_wind2', atk_raise_b: 'atk_wind2', atk_swing: 'atk_mid', atk_swing2: 'atk_mid',
  // D-K7: an unopted sheet shows today's daze look on the kneel timing
  kneel: 'daze', kneel_b: 'daze_b', kneel_in2: 'daze', kneel_in1: 'idle',
};

/** The first frame along the fallback chain from `name` that `has` an atlas key; null when none does. */
export function resolveFrame(name: MonsterFrame, has: (f: MonsterFrame) => boolean): MonsterFrame | null {
  const seen = new Set<MonsterFrame>();
  for (let f = name; !seen.has(f); f = FRAME_FALLBACK[f]) {
    if (has(f)) return f;
    seen.add(f);
  }
  return null;
}

export type Ease = 'linear' | 'in' | 'out';
/** One run of a frame: `len` frames moving the offset from `from` to `to`; `shake` adds ±shake every 2 frames. */
interface Seg { frame: MonsterFrame; len: number; from: number; to: number; ease?: Ease; shake?: number }

/** Attack, dx in fractions of the lunge L. Contact (the action resolves) on the first `attack` frame. */
const ATTACK: Seg[] = [
  { frame: 'atk_wind1', len: 5, from: 0, to: -1 / 6, ease: 'out' },
  { frame: 'atk_wind2', len: 6, from: -1 / 6, to: -1 / 4 },
  { frame: 'atk_mid', len: 3, from: -1 / 4, to: 0.75, ease: 'in' },
  { frame: 'attack', len: 2, from: 0.75, to: 1 },
  { frame: 'attack', len: 6, from: 1, to: 1 },
  { frame: 'atk_follow', len: 4, from: 1, to: 0.58 },
  { frame: 'atk_recover', len: 5, from: 0.58, to: 0 },
];
/** Hurt, dx in px: in-phase (4), hold with shake (10), return (6). */
const HURT: Seg[] = [
  { frame: 'hurt_in1', len: 2, from: 0, to: -3 },
  { frame: 'hurt_in2', len: 2, from: -3, to: -6 },
  { frame: 'hurt', len: 10, from: -6, to: -6, shake: 3 },
  { frame: 'hurt_in2', len: 3, from: -6, to: -3 },
  { frame: 'hurt_in1', len: 3, from: -3, to: 0 },
];
/** Boss cast, dy in px: 0 throughout (E15: the feet stay on the plain; the in-betweens carry the motion with their feet
 *  pinned). The spell resolves at the start of the hold. */
const BOSS_CAST: Seg[] = [
  { frame: 'cast_gather', len: 6, from: 0, to: 0 },
  { frame: 'cast_rise', len: 4, from: 0, to: 0 },
  { frame: 'cast', len: 10, from: 0, to: 0 },
  { frame: 'cast_release', len: 4, from: 0, to: 0 },
  { frame: 'cast_rise', len: 3, from: 0, to: 0 },
  { frame: 'cast_gather', len: 3, from: 0, to: 0 },
];
/** D4: a non-boss cast plays its attack frames in place (no lunge; E15: no lift either). */
const PLAIN_CAST: Seg[] = [
  { frame: 'atk_wind1', len: 5, from: 0, to: 0 },
  { frame: 'atk_wind2', len: 6, from: 0, to: 0 },
  { frame: 'attack', len: 10, from: 0, to: 0 },
  { frame: 'atk_follow', len: 4, from: 0, to: 0 },
  { frame: 'atk_recover', len: 5, from: 0, to: 0 },
];

const total = (segs: Seg[]): number => segs.reduce((n, s) => n + s.len, 0);
const startOf = (segs: Seg[], frame: MonsterFrame): number => {
  let t = 0;
  for (const s of segs) { if (s.frame === frame) return t; t += s.len; }
  return t;
};

export const ATTACK_FRAMES = total(ATTACK);
/** Contact frame: the first `attack` frame (the action resolves here). */
export const ATTACK_CONTACT = startOf(ATTACK, 'attack');
export const HURT_FRAMES = total(HURT);
/** End of the in-phase / start of the hold, and the end of the hold (the return starts). */
export const HURT_HOLD_START = startOf(HURT, 'hurt');
export const HURT_HOLD_END = HURT_HOLD_START + HURT[2].len;
/** Where a re-hit during the return jumps to: the second in-phase pose. */
export const HURT_REHIT_AT = startOf(HURT, 'hurt_in2');
export const CAST_FRAMES = total(BOSS_CAST);
export const PLAIN_CAST_FRAMES = total(PLAIN_CAST);
export const castOut = (hasCast: boolean): number => (hasCast ? startOf(BOSS_CAST, 'cast') : startOf(PLAIN_CAST, 'attack'));
export const DYING_IN = HURT_HOLD_START;
export const DYING_DX = -6;
export const DEFAULT_LUNGE_PX = 24;
export const IDLE_PERIOD = 72;

export interface FrameAt { frame: MonsterFrame; dx: number; dy: number }

export function ease(x: number, e: Ease = 'linear'): number {
  return e === 'in' ? x * x : e === 'out' ? 1 - (1 - x) * (1 - x) : x;
}

function sample(segs: Seg[], t: number): { frame: MonsterFrame; v: number } {
  let start = 0;
  for (const s of segs) {
    if (t < start + s.len) {
      const local = Math.max(0, t - start);
      // E14: the first shake frame recoils further (away from the party), then back toward it
      const shake = s.shake ? (Math.floor(local / 2) % 2 === 0 ? -s.shake : s.shake) : 0;
      return { frame: s.frame, v: s.from + (s.to - s.from) * ease(local / s.len, s.ease) + shake };
    }
    start += s.len;
  }
  const last = segs[segs.length - 1];
  return { frame: last.frame, v: last.to };
}

/** D-K3: the in-place attack's motion window (14, its contact). */
export const ATTACK_RISE_END = riseEnd(ATTACK.map((s) => s.len));

/** `rise`: a kneeler rising to act (motion held, then compressed; frame names on raw t). */
export function attackAt(t: number, lunge: number, opts: { rise?: boolean } = {}): FrameAt {
  const s = sample(ATTACK, t);
  const v = opts.rise ? sample(ATTACK, riseTime(t, ATTACK_RISE_END)).v : s.v;
  return { frame: s.frame, dx: v * lunge, dy: 0 };
}

export function hurtAt(t: number): FrameAt {
  const s = sample(HURT, t);
  return { frame: s.frame, dx: s.v, dy: 0 };
}

export function castAt(t: number, hasCast: boolean): FrameAt {
  const s = sample(hasCast ? BOSS_CAST : PLAIN_CAST, t);
  return { frame: s.frame, dx: 0, dy: s.v };
}

/** Lethal hit: the hurt in-phase, easing from wherever the enemy was (mid-lunge, mid-cast) to the dying offset, then
 *  `hurt` held with no shake while the sprite fades. E13: `start` is where the in-phase begins (the pose on screen when
 *  the hit landed: `hurt` → DYING_IN, `hurt_in2` → HURT_REHIT_AT, else 0), so a dying enemy never steps back a pose. */
export function dyingAt(t: number, from: { dx: number; dy: number }, start = 0): FrameAt {
  if (t >= DYING_IN) return { frame: 'hurt', dx: DYING_DX, dy: 0 };
  const k = Math.max(0, (t - start) / (DYING_IN - start));
  return { frame: hurtAt(t).frame, dx: from.dx + (DYING_DX - from.dx) * k, dy: from.dy * (1 - k) };
}

/** Fear's tremble, ±1 screen px by the clock: [0, 1, 0, -1] every 4 frames. A pure function of the clock, added on
 *  top of the position each frame and never accumulated, so it averages 0 and is 0 when fear ends. */
export const TREMBLE_STEPS = [0, 1, 0, -1] as const;
export const trembleDx = (clock: number): number => TREMBLE_STEPS[Math.floor(clock / 4) % 4];

/** What a status does to the idle (status-visuals.yaml `posture`): `daze` (sleep, stun) and `kneel` (poison) kneel
 *  (the KneelTrack, kneelChoreography.ts), `stone` and `still` hold idle (no breathing), `tremble` (fear) breathes as
 *  normal (the tremble is an additive offset, statusRules.trembles). */
export type Posture = StatusPosture;

/** The standing idle frame: stone and still enemies (and sheets without breathing) hold idle; the rest breathe (idle /
 *  idle_b every half period, out of phase per enemy). A kneeler shows its KneelTrack frame instead. */
export function idleFrame(clock: number, index: number, breath: boolean, posture: Posture = 'none'): MonsterFrame {
  if (posture === 'stone' || posture === 'still' || !breath) return 'idle';
  return Math.floor((clock + index * 17) / (IDLE_PERIOD / 2)) % 2 === 0 ? 'idle' : 'idle_b';
}

/** D2: the per-sheet lunge from the atlas; 24 px for an old atlas without it. */
export function lungePx(meta: { lungePx?: number } | null | undefined): number {
  return meta?.lungePx ?? DEFAULT_LUNGE_PX;
}
