/**
 * Pure timing for monster battle poses (no PixiJS): which pose each enemy shows and how far it is offset.
 *
 * attack: lunge LUNGE_PX toward the party over OUT frames, hold HOLD frames, return over BACK frames, then idle.
 * hurt:   SHAKE_FRAMES of a ±SHAKE_PX shake, then idle; a new hit restarts it; never interrupts an attack.
 * dying:  frozen on the hurt pose with no offset (the battle scene fades the sprite out).
 */
export type MonsterPose = 'idle' | 'attack' | 'hurt';

export const LUNGE_PX = 24;
export const ATTACK_OUT = 6;
export const ATTACK_HOLD = 8;
export const ATTACK_BACK = 6;
export const ATTACK_FRAMES = ATTACK_OUT + ATTACK_HOLD + ATTACK_BACK;
export const SHAKE_PX = 4;
export const SHAKE_FRAMES = 18;

type Mode = 'idle' | 'attack' | 'hurt' | 'dying';

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

  playHurt(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying' || s.mode === 'attack') return;
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
    return !s || s.mode !== 'attack' || s.t >= ATTACK_OUT;
  }

  isAttacking(i: number): boolean {
    return this.states[i]?.mode === 'attack';
  }

  update(dt: number): void {
    for (const s of this.states) {
      if (s.mode === 'idle' || s.mode === 'dying') continue;
      s.t += dt;
      const end = s.mode === 'attack' ? ATTACK_FRAMES : SHAKE_FRAMES;
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
      case 'hurt':
        return { pose: 'hurt', dx: Math.floor(s.t / 2) % 2 === 0 ? SHAKE_PX : -SHAKE_PX, dy: 0 };
      case 'dying':
        return { pose: 'hurt', dx: 0, dy: 0 };
      default:
        return { pose: 'idle', dx: 0, dy: 0 };
    }
  }
}
