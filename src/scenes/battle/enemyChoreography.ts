/**
 * Monster battle timing (docs/ENEMY_ANIM_PLAN.md 3.2): pure frame tables, no PixiJS. Every number the play test may
 * tune lives here. `t` is in 60 fps frames; dx > 0 is toward the party, dy < 0 is up; offsets are screen px at scale
 * factor 1 (EnemyPoseController scales and rounds them once).
 */

/** Approved keyframes in monsters-ai.json (bosses add `cast`). */
export type MonsterKeyframe = 'idle' | 'attack' | 'hurt' | 'cast';
export type MonsterFrame = MonsterKeyframe | 'idle_b' | 'atk_wind1' | 'atk_wind2' | 'atk_mid' | 'atk_follow'
  | 'atk_recover' | 'hurt_in1' | 'hurt_in2' | 'cast_gather' | 'cast_rise' | 'cast_release';

export const MONSTER_FRAMES: readonly MonsterFrame[] = ['idle', 'idle_b', 'atk_wind1', 'atk_wind2', 'atk_mid', 'attack',
  'atk_follow', 'atk_recover', 'hurt_in1', 'hurt_in2', 'hurt'];
export const BOSS_FRAMES: readonly MonsterFrame[] = [...MONSTER_FRAMES, 'cast_gather', 'cast_rise', 'cast', 'cast_release'];

/** The keyframe each frame is cut from: what an atlas without the frame (no rig, old atlas) shows instead. */
export const FRAME_SOURCE: Record<MonsterFrame, MonsterKeyframe> = {
  idle: 'idle', attack: 'attack', hurt: 'hurt', cast: 'cast', idle_b: 'idle', atk_wind1: 'idle', atk_wind2: 'idle',
  atk_mid: 'attack', atk_follow: 'attack', atk_recover: 'idle', hurt_in1: 'idle', hurt_in2: 'hurt', cast_gather: 'idle',
  cast_rise: 'cast', cast_release: 'cast',
};

type Ease = 'linear' | 'in' | 'out';
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
/** Boss cast, dy in px; the spell resolves at the start of the hold. */
const BOSS_CAST: Seg[] = [
  { frame: 'cast_gather', len: 6, from: 0, to: -2 },
  { frame: 'cast_rise', len: 4, from: -2, to: -6 },
  { frame: 'cast', len: 10, from: -6, to: -6 },
  { frame: 'cast_release', len: 4, from: -6, to: -6 },
  { frame: 'cast_rise', len: 3, from: -6, to: -2 },
  { frame: 'cast_gather', len: 3, from: -2, to: 0 },
];
/** D4: a non-boss cast plays its attack frames without the lunge (dy only). */
const PLAIN_CAST: Seg[] = [
  { frame: 'atk_wind1', len: 5, from: 0, to: 0 },
  { frame: 'atk_wind2', len: 6, from: 0, to: -6 },
  { frame: 'attack', len: 10, from: -6, to: -6 },
  { frame: 'atk_follow', len: 4, from: -6, to: -3 },
  { frame: 'atk_recover', len: 5, from: -3, to: 0 },
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

function ease(x: number, e: Ease = 'linear'): number {
  return e === 'in' ? x * x : e === 'out' ? 1 - (1 - x) * (1 - x) : x;
}

function sample(segs: Seg[], t: number): { frame: MonsterFrame; v: number } {
  let start = 0;
  for (const s of segs) {
    if (t < start + s.len) {
      const local = Math.max(0, t - start);
      const shake = s.shake ? (Math.floor(local / 2) % 2 === 0 ? s.shake : -s.shake) : 0;
      return { frame: s.frame, v: s.from + (s.to - s.from) * ease(local / s.len, s.ease) + shake };
    }
    start += s.len;
  }
  const last = segs[segs.length - 1];
  return { frame: last.frame, v: last.to };
}

export function attackAt(t: number, lunge: number): FrameAt {
  const s = sample(ATTACK, t);
  return { frame: s.frame, dx: s.v * lunge, dy: 0 };
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
 *  `hurt` held with no shake while the sprite fades. */
export function dyingAt(t: number, from: { dx: number; dy: number }): FrameAt {
  if (t >= DYING_IN) return { frame: 'hurt', dx: DYING_DX, dy: 0 };
  const k = t / DYING_IN;
  return { frame: hurtAt(t).frame, dx: from.dx + (DYING_DX - from.dx) * k, dy: from.dy * (1 - k) };
}

/** Breathing idle (idle / idle_b every half period, out of phase per enemy); frozen or breathless enemies hold idle. */
export function idleFrame(clock: number, index: number, breath: boolean, frozen: boolean): MonsterFrame {
  if (frozen || !breath) return 'idle';
  return Math.floor((clock + index * 17) / (IDLE_PERIOD / 2)) % 2 === 0 ? 'idle' : 'idle_b';
}

/** D2: the per-sheet lunge from the atlas; 24 px for an old atlas without it. */
export function lungePx(meta: { lungePx?: number } | null | undefined): number {
  return meta?.lungePx ?? DEFAULT_LUNGE_PX;
}
