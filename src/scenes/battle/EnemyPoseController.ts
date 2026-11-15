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
  DYING_IN, HURT_REHIT_AT, PLAIN_CAST_FRAMES, attackAt, castAt, castOut, dyingAt, hurtAt, idleFrame,
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
  /** The sheet has its own `attack_raise` keyframe (the heavy attack, pass F item 7). */
  hasRaise: boolean;
  lungePx: number;
  scaleFactor: number;
  breath: boolean;
}

/** Animation cues: `hold` when an attack's held telegraph starts, `contact` on its contact frame. */
export type PoseCue = 'hold' | 'contact';

interface EnemyState extends EnemyAnimConfig {
  mode: Mode;
  t: number;
  freeze: Freeze;
  /** Unscaled offset when the lethal hit landed (dying eases from it). */
  from: { dx: number; dy: number };
  /** Where in the dying in-phase it began (E13). */
  start: number;
  /** The current attack's contact frame, held-telegraph start (null: none) and length, set when it starts. */
  contactAt: number;
  holdAt: number | null;
  totalFrames: number;
  /** Absolute screen px the current attack travels (unscaled; 0 = in place). */
  travel: { dx: number; dy: number };
}

/** The frame to show and the screen offset: `dx` / `dy` are the lunge, recoil and shake (scaled by the layout factor,
 *  rounded once); `travelDx` / `travelDy` are the attack's travel in absolute screen px (unscaled), omitted while 0. */
export interface PoseState {
  pose: MonsterFrame;
  dx: number;
  dy: number;
  travelDx?: number;
  travelDy?: number;
}

const DEFAULTS: EnemyAnimConfig = { hasCast: false, hasRaise: false, lungePx: DEFAULT_LUNGE_PX, scaleFactor: 1, breath: true };

export class EnemyPoseController {
  private states: EnemyState[];
  private clock = 0;
  /** Raised from `update` when an attack reaches its held telegraph (`hold`) or its contact frame (`contact`). */
  onCue: ((i: number, cue: PoseCue) => void) | undefined;

  constructor(count: number) {
    this.states = Array.from({ length: count }, () => ({ ...DEFAULTS, mode: 'idle' as Mode, t: 0, freeze: 'none' as Freeze,
      from: { dx: 0, dy: 0 }, start: 0, contactAt: ATTACK_OUT, holdAt: null, totalFrames: ATTACK_FRAMES,
      travel: { dx: 0, dy: 0 } }));
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

  /** Start the attack. F0 plays the in-place table (travel 0); its contact and length are stored per enemy. */
  playAttack(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying') return;
    s.mode = 'attack';
    s.t = 0;
    s.contactAt = ATTACK_OUT;
    s.holdAt = null;
    s.totalFrames = ATTACK_FRAMES;
    s.travel = { dx: 0, dy: 0 };
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

  /** Lethal hit (unconditional, so it may land mid-lunge): ease into the held hurt pose while the sprite fades.
   *  E13: it starts from the pose on screen (never an earlier in-phase pose); E17: a second call is a no-op. */
  freezeDying(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying') return;
    const cur = this.raw(s);
    s.from = { dx: cur.dx, dy: cur.dy };
    s.start = cur.frame === 'hurt' ? DYING_IN : cur.frame === 'hurt_in2' ? HURT_REHIT_AT : 0;
    s.mode = 'dying';
    s.t = s.start;
  }

  /** The lunge has reached the party side (or the spell its hold): the action can resolve now. */
  attackOutDone(i: number): boolean {
    const s = this.states[i];
    if (!s) return true;
    if (s.mode === 'attack') return s.t >= s.contactAt;
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
    this.states.forEach((s, i) => {
      if (s.mode === 'idle') return;
      const before = s.t;
      s.t += dt;
      if (s.mode === 'dying') return;
      if (s.mode === 'attack') {
        const crossed = (at: number | null) => at !== null && before < at && s.t >= at;
        if (crossed(s.holdAt)) this.onCue?.(i, 'hold');
        if (crossed(s.contactAt)) this.onCue?.(i, 'contact');
      }
      const end = s.mode === 'attack' ? s.totalFrames : s.mode === 'cast' ? (s.hasCast ? CAST_FRAMES : PLAIN_CAST_FRAMES) : HURT_FRAMES;
      if (s.t >= end) {
        s.mode = 'idle';
        s.t = 0;
      }
    });
  }

  /** Frame name and unscaled offset of enemy i right now. */
  private raw(s: EnemyState): FrameAt {
    switch (s.mode) {
      case 'attack': return attackAt(s.t, s.lungePx);
      case 'cast': return castAt(s.t, s.hasCast);
      case 'hurt': return hurtAt(s.t);
      case 'dying': return dyingAt(s.t, s.from, s.start);
      default: return { frame: idleFrame(this.clock, this.states.indexOf(s), s.breath, s.freeze !== 'none'), dx: 0, dy: 0 };
    }
  }

  /** The frame to show and the integer screen offset: the lunge part scaled by the layout factor and rounded once, the
   *  travel part (absolute px, only while an attack travels) as is. */
  state(i: number): PoseState {
    const s = this.states[i];
    if (!s) return { pose: 'idle', dx: 0, dy: 0 };
    const r = this.raw(s);
    const st: PoseState = { pose: r.frame, dx: Math.round(r.dx * s.scaleFactor) || 0, dy: Math.round(r.dy * s.scaleFactor) || 0 };
    const travel = s.mode === 'attack' ? s.travel : { dx: 0, dy: 0 };
    if (travel.dx || travel.dy) { st.travelDx = Math.round(travel.dx); st.travelDy = Math.round(travel.dy); }
    return st;
  }

  /** The current attack's contact frame and length (per enemy: a travelling attack is longer). */
  attackTiming(i: number): { contactAt: number; totalFrames: number } {
    const s = this.states[i];
    return s ? { contactAt: s.contactAt, totalFrames: s.totalFrames } : { contactAt: ATTACK_OUT, totalFrames: ATTACK_FRAMES };
  }

  /** Current mode and time of enemy i (dev preview label). */
  debug(i: number): { mode: Mode; t: number } {
    const s = this.states[i];
    return s ? { mode: s.mode, t: s.t } : { mode: 'idle', t: 0 };
  }
}
