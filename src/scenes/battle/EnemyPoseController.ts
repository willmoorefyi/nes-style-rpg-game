/**
 * Pure timing for monster battle poses (no PixiJS): which pose each enemy shows and how far it is offset.
 *
 * attack: lunge LUNGE_PX toward the party over OUT frames, hold HOLD frames, return over BACK frames, then idle.
 * hurt:   SHAKE_FRAMES of a ±SHAKE_PX shake, then idle; a new hit restarts it; never interrupts an attack.
 * cast:   CAST_FRAMES in the cast pose, rising CAST_RISE px over CAST_EDGE frames, held, then back down; no lunge.
 * dying:  frozen on the hurt pose with no offset (the battle scene fades the sprite out).
 */
export type MonsterPose = 'idle' | 'attack' | 'cast' | 'hurt';

export const LUNGE_PX = 24;
export const ATTACK_OUT = 6;
export const ATTACK_HOLD = 8;
export const ATTACK_BACK = 6;
export const ATTACK_FRAMES = ATTACK_OUT + ATTACK_HOLD + ATTACK_BACK;
export const SHAKE_PX = 4;
export const SHAKE_FRAMES = 18;
export const CAST_FRAMES = 24;
export const CAST_EDGE = 6;
export const CAST_RISE = 6;
/** The spell resolves once the caster has risen and started holding the pose. */
export const CAST_OUT = 8;

type Mode = 'idle' | 'attack' | 'cast' | 'hurt' | 'dying';

interface EnemyState {
  mode: Mode;
  t: number;
}

export interface PoseState {
  pose: MonsterPose;
  dx: number;
  dy: number;
}

export class EnemyPoseController {
  private states: EnemyState[];

  constructor(count: number) {
    this.states = Array.from({ length: count }, () => ({ mode: 'idle' as Mode, t: 0 }));
  }

  playAttack(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying') return;
    s.mode = 'attack';
    s.t = 0;
  }

  /** Spell stance: rise, hold, settle. Like an attack, a hit never interrupts it. */
  playCast(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying') return;
    s.mode = 'cast';
    s.t = 0;
  }

  playHurt(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying' || s.mode === 'attack' || s.mode === 'cast') return;
    s.mode = 'hurt';
    s.t = 0;
  }

  /** Lethal hit: hold the hurt pose (no shake) while the sprite fades out. */
  freezeDying(i: number): void {
    const s = this.states[i];
    if (!s) return;
    s.mode = 'dying';
    s.t = 0;
  }

  /** The lunge has reached the party side: the action can resolve now. */
  attackOutDone(i: number): boolean {
    const s = this.states[i];
    if (!s) return true;
    if (s.mode === 'attack') return s.t >= ATTACK_OUT;
    if (s.mode === 'cast') return s.t >= CAST_OUT;
    return true;
  }

  /** An attack or spell is still playing (the action should not complete yet). */
  isAttacking(i: number): boolean {
    const mode = this.states[i]?.mode;
    return mode === 'attack' || mode === 'cast';
  }

  update(dt: number): void {
    for (const s of this.states) {
      if (s.mode === 'idle' || s.mode === 'dying') continue;
      s.t += dt;
      const end = s.mode === 'attack' ? ATTACK_FRAMES : s.mode === 'cast' ? CAST_FRAMES : SHAKE_FRAMES;
      if (s.t >= end) {
        s.mode = 'idle';
        s.t = 0;
      }
    }
  }

  state(i: number): PoseState {
    const s = this.states[i];
    if (!s) return { pose: 'idle', dx: 0, dy: 0 };
    switch (s.mode) {
      case 'attack': {
        let dx: number;
        if (s.t < ATTACK_OUT) dx = (LUNGE_PX * s.t) / ATTACK_OUT;
        else if (s.t < ATTACK_OUT + ATTACK_HOLD) dx = LUNGE_PX;
        else dx = (LUNGE_PX * (ATTACK_FRAMES - s.t)) / ATTACK_BACK;
        return { pose: 'attack', dx: Math.round(Math.max(0, dx)), dy: 0 };
      }
      case 'cast': {
        let rise: number;
        if (s.t < CAST_EDGE) rise = (CAST_RISE * s.t) / CAST_EDGE;
        else if (s.t < CAST_FRAMES - CAST_EDGE) rise = CAST_RISE;
        else rise = (CAST_RISE * (CAST_FRAMES - s.t)) / CAST_EDGE;
        return { pose: 'cast', dx: 0, dy: -Math.round(Math.max(0, rise)) };
      }
      case 'hurt':
        return { pose: 'hurt', dx: Math.floor(s.t / 2) % 2 === 0 ? SHAKE_PX : -SHAKE_PX, dy: 0 };
      case 'dying':
        return { pose: 'hurt', dx: 0, dy: 0 };
      default:
        return { pose: 'idle', dx: 0, dy: 0 };
    }
  }
}
