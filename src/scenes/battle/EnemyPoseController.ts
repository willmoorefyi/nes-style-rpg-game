/**
 * Pure timing for monster battle poses (no PixiJS): a cursor per enemy over the tables in enemyChoreography.ts
 * (docs/ENEMY_ANIM_PLAN.md 3.2, 6.2).
 *
 * attack: wind-up, lunge (contact at ATTACK_CONTACT: attackOutDone), follow-through, recover; 31 frames in place. With
 *         a travel (pass F item 3) it runs to the target and back (contact 14 + N); a heavy one (item 7) raises, holds
 *         and slams (contact N + 29). Contact and length are stored per enemy.
 * hurt:   in-phase, held recoil with shake, return; a re-hit in the in-phase lets it finish (a full hold follows), in
 *         the hold restarts the hold, in the return jumps back to hurt_in2; never interrupts an attack or a cast.
 * cast:   boss gather / rise / hold / release; a monster without a cast frame plays its attack frames, no lunge.
 * dying:  the hurt in-phase (eased from the current offset), then `hurt` held while it fades; a kneeler keeps its kneel.
 * idle:   breathing idle / idle_b (out of phase per enemy); stone holds idle, no recoil. Pass K (docs/KNEEL_PLAN.md):
 *         `daze` / `kneel` kneel (a hit shakes, an acting kneeler rises to act, D-K3); fear (`trembles`) adds +-1 px.
 */
import {
  ATTACK_CONTACT, ATTACK_FRAMES, CAST_FRAMES, DEFAULT_LUNGE_PX, HURT_FRAMES, HURT_HOLD_END, HURT_HOLD_START,
  DYING_IN, HURT_REHIT_AT, PLAIN_CAST_FRAMES, castAt, castOut, dyingAt, hurtAt, idleFrame, trembleDx,
  type FrameAt, type Posture, type MonsterKeyframe,
} from './enemyChoreography.js';
import { HEAVY_HOLD_FRAMES, attackTable, travelAttackAt, type AttackKind } from './enemyAttackTables.js';
import { ENEMY_SHAKE, KNEEL_OUT_FRAMES, KneelTrack, isKneelFrame, kneelShake, riseFrame } from './kneelChoreography.js';
import { DEFAULTS, ZERO, type AttackPlan, type EnemyAnimConfig, type EnemyState, type Mode, type PoseCue,
  type PoseState } from './enemyPoseTypes.js';

/** Approved keyframe names (atlas keys). */
export type MonsterPose = MonsterKeyframe;
export { ATTACK_FRAMES, CAST_FRAMES, HURT_FRAMES, PLAIN_CAST_FRAMES };
/** The action resolves once the lunge reaches contact. */
export const ATTACK_OUT = ATTACK_CONTACT;
/** A boss spell resolves at the start of its held cast pose. */
export const CAST_OUT = castOut(true);
export const LUNGE_PX = DEFAULT_LUNGE_PX;
export type { Posture };
export type { AttackPlan, EnemyAnimConfig, PoseCue, PoseState } from './enemyPoseTypes.js';

const kneels = (p: Posture): boolean => p === 'daze' || p === 'kneel';

export class EnemyPoseController {
  private states: EnemyState[];
  private clock = 0;
  /** Raised from `update` when an attack reaches its held telegraph (`hold`) or its contact frame (`contact`). */
  onCue: ((i: number, cue: PoseCue) => void) | undefined;

  constructor(count: number) {
    this.states = Array.from({ length: count }, (_, i) => ({ ...DEFAULTS, mode: 'idle' as Mode, t: 0, posture: 'none' as Posture,
      trembles: false, track: new KneelTrack(i), rising: false, shake: null, from: ZERO, start: 0, dyingFrame: null, dyingSink: 0,
      contactAt: ATTACK_OUT, holdAt: null, totalFrames: ATTACK_FRAMES, travel: ZERO, kind: 'inplace' as AttackKind, held: ZERO }));
  }

  /** Per-enemy art facts (from the atlas) and layout scale. */
  configure(i: number, cfg: Partial<EnemyAnimConfig>): void { const s = this.states[i]; if (s) Object.assign(s, cfg); }

  /** The status posture and fear's tremble (the presented snapshot, every frame). `daze` / `kneel` kneel once no action
   *  or recoil plays; stone cuts a running recoil and the kneel at once. */
  setPosture(i: number, posture: Posture, trembles = posture === 'tremble'): void {
    const s = this.states[i];
    if (!s) return;
    s.posture = posture;
    s.trembles = trembles;
    if (posture === 'stone') {
      if (s.mode === 'hurt') Object.assign(s, { mode: 'idle', t: 0 });
      s.track.set(false, this.clock, { hold: true });
      s.shake = null;
    }
    this.syncKneel(s);
  }

  /** The kneel follows the posture while idle; the stand-up starts whenever the trigger ends. */
  private syncKneel(s: EnemyState): void {
    const want = kneels(s.posture);
    if (s.mode !== 'dying' && (s.mode === 'idle' || !want)) s.track.set(want, this.clock);
  }

  /** Row (a): every idle kneeler goes straight into its hold (the battle start, once the status visuals are known). */
  snapKneel(): void {
    for (const s of this.states) if (s.mode === 'idle' && kneels(s.posture)) s.track.set(true, this.clock, { hold: true });
  }

  /** Back to idle at t = 0 everywhere (the dev step preview replays from here); a kneeler is in its hold. */
  reset(): void {
    this.clock = 0;
    for (const s of this.states) {
      Object.assign(s, { mode: 'idle', t: 0, from: ZERO, held: ZERO, rising: false, shake: null, dyingFrame: null });
      s.track.set(s.track.on, 0, { hold: true });
    }
  }

  /** An attack or spell starts: a kneeler rises in its first 6 frames (D-K3: the kneel is cut, the rise shows). */
  private begin(s: EnemyState, mode: 'attack' | 'cast'): void {
    s.rising = s.mode === 'idle' && s.track.frame(this.clock) !== null;
    s.track.set(false, this.clock, { hold: true });
    Object.assign(s, { shake: null, mode, t: 0 });
  }

  /** Start the attack: in place without a travel (ranged, no target), else melee (heavy for a heavy enemy) to the
   *  target and back. Its contact, telegraph start and length are stored per enemy. */
  playAttack(i: number, plan: AttackPlan = { travel: 0, rise: 0 }): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying') return;
    const travel = Math.max(0, plan.travel);
    s.kind = s.heavy ? 'heavy' : travel > 0 ? 'melee' : 'inplace';
    const table = attackTable(s.kind, travel);
    this.begin(s, 'attack');
    Object.assign(s, { contactAt: table.contactAt, holdAt: table.holdAt, totalFrames: table.total,
      travel: travel > 0 ? { dx: travel, dy: plan.rise } : ZERO, held: ZERO });
  }

  /** Spell stance. Like an attack, a hit never interrupts it. */
  playCast(i: number): void { const s = this.states[i]; if (s && s.mode !== 'dying') this.begin(s, 'cast'); }

  /** A hit: the recoil, or on a kneeler the +-3 px shake of its kneel frame (D-K2 enemy row 4; `in` is not restarted). */
  playHurt(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying' || s.mode === 'attack' || s.mode === 'cast' || s.posture === 'stone') return;
    if (s.mode === 'idle' && s.track.frame(this.clock) !== null) { s.shake = -1; return; }   // local 0 on the next frame
    if (s.mode !== 'hurt') { s.mode = 'hurt'; s.t = 0; return; }
    if (s.t < HURT_HOLD_START) return;                  // in-phase: finishes, then a full hold
    s.t = s.t < HURT_HOLD_END ? HURT_HOLD_START : HURT_REHIT_AT;
  }

  /** Lethal hit (unconditional, so it may land mid-lunge): ease into the held hurt pose while the sprite fades.
   *  E13: it starts from the pose on screen (never an earlier in-phase pose); E17: a second call is a no-op. A kneeler
   *  keeps its kneel frame (and its sink) instead of the hurt frames. */
  freezeDying(i: number): void {
    const s = this.states[i];
    if (!s || s.mode === 'dying') return;
    const cur = this.raw(s);
    s.dyingFrame = isKneelFrame(cur.frame) ? cur.frame : null;
    s.dyingSink = this.kneelAmount(i);
    s.from = { dx: cur.dx, dy: cur.dy };
    s.held = s.mode === 'attack' ? { dx: s.travel.dx * cur.k, dy: s.travel.dy * cur.k } : ZERO;
    s.start = cur.frame === 'hurt' ? DYING_IN : cur.frame === 'hurt_in2' ? HURT_REHIT_AT : 0;
    Object.assign(s, { mode: 'dying', t: s.start, shake: null });
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
  isLunging(i: number): boolean { return this.states[i]?.mode === 'attack'; }

  /** The attack playing (null: none): `melee` and `heavy` travel and draw above every actor (D5'); `heavy` shakes. */
  attackKind(i: number): AttackKind | null {
    const s = this.states[i];
    return s?.mode === 'attack' ? s.kind : null;
  }

  /** Frames into the heavy attack's held telegraph, or null outside it (the red pulse). */
  holdFrame(i: number): number | null {
    const s = this.states[i];
    if (s?.mode !== 'attack' || s.holdAt === null) return null;
    const local = s.t - s.holdAt;
    return local >= 0 && local < HEAVY_HOLD_FRAMES ? local : null;
  }

  /** Enemy i shows a kneel frame now (a hit shakes it). */
  kneeling(i: number): boolean { const s = this.states[i]; return !!s && s.mode === 'idle' && s.track.frame(this.clock) !== null; }

  /** How far down enemy i is, 0 to 1 (a floater's `kneelSink`, D-K9): the track, eased off over a rise, held dying. */
  kneelAmount(i: number): number {
    const s = this.states[i];
    if (!s) return 0;
    if (s.mode === 'dying') return s.dyingSink;
    if (s.mode === 'attack' || s.mode === 'cast') return s.rising && s.t < KNEEL_OUT_FRAMES ? 1 - (s.t / KNEEL_OUT_FRAMES) ** 2 : 0;
    return s.mode === 'idle' ? s.track.amount(this.clock) : 0;
  }

  update(dt: number): void {
    this.clock += dt;
    this.states.forEach((s, i) => {
      if (s.shake !== null) s.shake = s.shake + dt < ENEMY_SHAKE.frames ? s.shake + dt : null;
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
        Object.assign(s, { mode: 'idle', t: 0, rising: false });
        this.syncKneel(s);                              // D-K3: when the trigger still holds, `in` starts at once
      }
    });
  }

  /** Frame name and unscaled offset of enemy i right now (an acting kneeler's first 6 action frames are the rise). */
  private raw(s: EnemyState): FrameAt & { k: number } {
    const risen = (r: FrameAt & { k: number }) => ({ ...r, frame: (s.rising && riseFrame(s.t)) || r.frame });
    switch (s.mode) {
      case 'attack': return risen(travelAttackAt(s.kind, s.t, { lunge: s.lungePx, travel: s.travel.dx, hop: s.hopPx,
        hasRaise: s.hasRaise, rise: s.rising }));
      case 'cast': return risen({ ...castAt(s.t, s.hasCast), k: 0 });
      case 'hurt': return { ...hurtAt(s.t), k: 0 };
      case 'dying': { const d = dyingAt(s.t, s.from, s.start); return { ...d, frame: s.dyingFrame ?? d.frame, k: 0 }; }
      default: return { frame: s.track.frame(this.clock) ?? idleFrame(this.clock, this.states.indexOf(s), s.breath, s.posture, s.orbit),
        dx: 0, dy: 0, k: 0 };
    }
  }

  /** The frame to show and the integer screen offset: the lunge part scaled by the layout factor and rounded once, plus
   *  the tremble and a kneeler's shake (one sum); the travel part (absolute px, while an attack travels or a dying enemy
   *  is held away from home) as is. */
  state(i: number): PoseState {
    const s = this.states[i];
    if (!s) return { pose: 'idle', dx: 0, dy: 0 };
    const r = this.raw(s);
    const shiver = s.trembles && s.posture !== 'stone' && s.posture !== 'daze' && s.mode !== 'dying' ? trembleDx(this.clock) : 0;
    const shake = s.shake !== null ? kneelShake(s.shake, ENEMY_SHAKE) : 0;
    const st: PoseState = { pose: r.frame, dx: Math.round(r.dx * s.scaleFactor) + shiver + shake || 0,
      dy: Math.round(r.dy * s.scaleFactor) || 0 };
    const travel = s.mode === 'attack' ? { dx: s.travel.dx * r.k, dy: s.travel.dy * r.k } : s.mode === 'dying' ? s.held : ZERO;
    if (travel.dx || travel.dy) { st.travelDx = Math.round(travel.dx); st.travelDy = Math.round(travel.dy); }
    return st;
  }

  /** The current attack's contact frame and length (per enemy: a travelling attack is longer). */
  attackTiming(i: number): { contactAt: number; totalFrames: number } {
    const s = this.states[i];
    return s ? { contactAt: s.contactAt, totalFrames: s.totalFrames } : { contactAt: ATTACK_OUT, totalFrames: ATTACK_FRAMES };
  }

  /** Current mode and time of enemy i (dev preview label; an idle kneeler's time is its kneel phase's). */
  debug(i: number): { mode: Mode; t: number } {
    const s = this.states[i];
    if (!s) return { mode: 'idle', t: 0 };
    return { mode: s.mode, t: s.mode === 'idle' ? s.track.local(this.clock) : s.t };
  }
}
