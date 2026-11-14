/**
 * Pure timing for monster battle poses (no PixiJS): a cursor per enemy over the tables in enemyChoreography.ts
 * (docs/ENEMY_ANIM_PLAN.md 3.2, 6.2).
 *
 * attack: wind-up, lunge (contact at ATTACK_CONTACT: attackOutDone), follow-through, recover; 31 frames.
 * hurt:   in-phase, held recoil with shake, return; a re-hit in the in-phase lets it finish (a full hold follows), in
 *         the hold restarts the hold, in the return jumps back to hurt_in2; never interrupts an attack or a cast.
 * cast:   boss gather / rise / hold / release; a monster without a cast frame plays its attack frames, no lunge.
 * dying:  the hurt in-phase (eased from the current offset, e.g. mid-lunge), then `hurt` held while the sprite fades.
 * idle:   breathing idle / idle_b, out of phase per enemy; frozen (sleep, stun, stone) enemies hold idle.
 */
import {
  ATTACK_CONTACT, ATTACK_FRAMES, CAST_FRAMES, DEFAULT_LUNGE_PX, HURT_FRAMES, HURT_HOLD_END, HURT_HOLD_START,
  HURT_REHIT_AT, PLAIN_CAST_FRAMES, attackAt, castAt, castOut, dyingAt, hurtAt, idleFrame,
  type FrameAt, type MonsterFrame, type MonsterKeyframe,
} from './enemyChoreography.js';

/** Approved keyframe names (atlas keys). */
export type MonsterPose = MonsterKeyframe;
export { ATTACK_FRAMES, CAST_FRAMES, HURT_FRAMES, PLAIN_CAST_FRAMES };
/** The action resolves once the lunge reaches contact. */
export const ATTACK_OUT = ATTACK_CONTACT;
/** A boss spell resolves at the start of its held cast pose. */
export const CAST_OUT = castOut(true);
export const LUNGE_PX = DEFAULT_LUNGE_PX;

type Mode = 'idle' | 'attack' | 'cast' | 'hurt' | 'dying';
/** D6: still = sleep / stun (no breathing, still recoils); stone = no pose change at all. */
export type Freeze = 'none' | 'still' | 'stone';

export interface EnemyAnimConfig {
  hasCast: boolean;
  lungePx: number;
  scaleFactor: number;
  breath: boolean;
}

interface EnemyState extends EnemyAnimConfig {
  mode: Mode;
  t: number;
  freeze: Freeze;
  /** Unscaled offset when the lethal hit landed (dying eases from it). */
  from: { dx: number; dy: number };
}

export interface PoseState {
  pose: MonsterFrame;
  dx: number;
  dy: number;
}

const DEFAULTS: EnemyAnimConfig = { hasCast: false, lungePx: DEFAULT_LUNGE_PX, scaleFactor: 1, breath: true };

export class EnemyPoseController {
  private states: EnemyState[];
  private clock = 0;

  constructor(count: number) {
    this.states = Array.from({ length: count }, () => ({ ...DEFAULTS, mode: 'idle' as Mode, t: 0, freeze: 'none' as Freeze,
      from: { dx: 0, dy: 0 } }));
  }

  /** Per-enemy art facts (from the atlas) and layout scale. */
  configure(i: number, cfg: Partial<EnemyAnimConfig>): void {
    const s = this.states[i];
    if (s) Object.assign(s, cfg);
  }

  setFreeze(i: number, freeze: Freeze): void {
    const s = this.states[i];
    if (!s) return;
    s.freeze = freeze;
    if (freeze === 'stone' && s.mode === 'hurt') { s.mode = 'idle'; s.t = 0; }
  }

  /** Back to idle at t = 0 everywhere (the dev step preview replays from here). */
  reset(): void {
    this.clock = 0;
    for (const s of this.states) { s.mode = 'idle'; s.t = 0; s.from = { dx: 0, dy: 0 }; }
  }

  playAttack(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying') return;
    s.mode = 'attack';
    s.t = 0;
  }

  /** Spell stance. Like an attack, a hit never interrupts it. */
  playCast(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying') return;
    s.mode = 'cast';
    s.t = 0;
  }

  playHurt(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying' || s.mode === 'attack' || s.mode === 'cast' || s.freeze === 'stone') return;
    if (s.mode !== 'hurt') { s.mode = 'hurt'; s.t = 0; return; }
    if (s.t < HURT_HOLD_START) return;                  // in-phase: finishes, then a full hold
    s.t = s.t < HURT_HOLD_END ? HURT_HOLD_START : HURT_REHIT_AT;
  }

  /** Lethal hit (unconditional, so it may land mid-lunge): ease into the held hurt pose while the sprite fades. */
  freezeDying(i: number): void {
    const s = this.states[i];
    if (!s) return;
    if (s.mode !== 'dying') {
      const cur = this.raw(s);
      s.from = { dx: cur.dx, dy: cur.dy };
    }
    s.mode = 'dying';
    s.t = 0;
  }

  /** The lunge has reached the party side (or the spell its hold): the action can resolve now. */
  attackOutDone(i: number): boolean {
    const s = this.states[i];
    if (!s) return true;
    if (s.mode === 'attack') return s.t >= ATTACK_OUT;
    if (s.mode === 'cast') return s.t >= castOut(s.hasCast);
    return true;
  }

  /** An attack or spell is still playing (the action should not complete yet). */
  isAttacking(i: number): boolean {
    const mode = this.states[i]?.mode;
    return mode === 'attack' || mode === 'cast';
  }

  /** In the attack (lunge) sequence: drawn above the other enemies (D5). */
  isLunging(i: number): boolean {
    return this.states[i]?.mode === 'attack';
  }

  update(dt: number): void {
    this.clock += dt;
    for (const s of this.states) {
      if (s.mode === 'idle') continue;
      s.t += dt;
      if (s.mode === 'dying') continue;
      const end = s.mode === 'attack' ? ATTACK_FRAMES : s.mode === 'cast' ? (s.hasCast ? CAST_FRAMES : PLAIN_CAST_FRAMES) : HURT_FRAMES;
      if (s.t >= end) {
        s.mode = 'idle';
        s.t = 0;
      }
    }
  }

  /** Frame name and unscaled offset of enemy i right now. */
  private raw(s: EnemyState): FrameAt {
    switch (s.mode) {
      case 'attack': return attackAt(s.t, s.lungePx);
      case 'cast': return castAt(s.t, s.hasCast);
      case 'hurt': return hurtAt(s.t);
      case 'dying': return dyingAt(s.t, s.from);
      default: return { frame: idleFrame(this.clock, this.states.indexOf(s), s.breath, s.freeze !== 'none'), dx: 0, dy: 0 };
    }
  }

  /** The frame to show and the integer screen offset (scaled by the layout factor, rounded once). */
  state(i: number): PoseState {
    const s = this.states[i];
    if (!s) return { pose: 'idle', dx: 0, dy: 0 };
    const r = this.raw(s);
    return { pose: r.frame, dx: Math.round(r.dx * s.scaleFactor) || 0, dy: Math.round(r.dy * s.scaleFactor) || 0 };
  }

  /** Current mode and time of enemy i (dev preview label). */
  debug(i: number): { mode: Mode; t: number } {
    const s = this.states[i];
    return s ? { mode: s.mode, t: s.t } : { mode: 'idle', t: 0 };
  }
}
