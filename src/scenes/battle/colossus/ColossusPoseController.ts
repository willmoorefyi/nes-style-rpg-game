/**
 * The cursor of one colossus over its timelines (docs/CHAOS_FORMS_PLAN.md 4.3), with the calls EnemyPoseController
 * offers (attack, cast, hurt, die, update), so the battle drives either through EnemyActorPoses. Pure (no PixiJS).
 * Like an atlas enemy, a hurt never interrupts an attack or a cast; dying holds its last frame.
 */
import {
  BEAM_RELEASE, CAST_RELEASE, SLAM_CONTACT, SLAM_LIMITS, TIMELINE_FRAMES, cuesBetween, poseAt,
  type ColossusCue, type ColossusPoseFrame, type ColossusTimeline, type LayerInfo, type SlamLimits,
} from './colossusChoreography.js';

export type ColossusCastKind = 'beam' | 'cast';
/** The poses an interlude can ask for (the `pose` step). */
export type ColossusPoseName = 'attack' | 'cast' | 'hurt' | 'roar';

const CONTACT: Partial<Record<ColossusTimeline, number>> = { slam: SLAM_CONTACT, beam: BEAM_RELEASE, cast: CAST_RELEASE };

export class ColossusPoseController {
  private tl: ColossusTimeline = 'idle';
  private t = 0;
  private clock = 0;
  /** Raised from `update` on a timeline's cue frames (the slam's contact and shake, a spell's release). */
  onCue: ((cue: ColossusCue) => void) | null = null;
  /** The drawn form's slam dip and drop (`slamLimitsFor`, set by ColossusSlots at the swap and at a re-base). */
  slamLimits: Readonly<SlamLimits> = SLAM_LIMITS;

  constructor(private readonly layers: readonly LayerInfo[]) {}

  get timeline(): ColossusTimeline { return this.tl; }
  get frameIndex(): number { return Math.floor(this.t); }

  /** An attack or spell (or the dying) is still playing. */
  get busy(): boolean {
    if (this.tl === 'dying') return this.t < TIMELINE_FRAMES.dying;
    return this.tl === 'slam' || this.tl === 'beam' || this.tl === 'cast' || this.tl === 'roar';
  }

  /** The attack or spell has reached its contact / release frame (the action resolves there). */
  get contactPassed(): boolean {
    const at = CONTACT[this.tl];
    return at === undefined || this.t >= at;
  }

  /** The dying has played out (the view hides the form). */
  get gone(): boolean { return this.tl === 'dying' && this.t >= TIMELINE_FRAMES.dying; }

  private play(tl: ColossusTimeline): void {
    if (this.tl === 'dying') return;
    this.tl = tl;
    this.t = 0;
    for (const cue of cuesBetween(tl, 0, 0)) this.onCue?.(cue);
  }

  /** A physical attack: the slam (a colossus never lunges). */
  attack(): void { this.play('slam'); }
  /** A spell: the beam for a single-target black damage spell, else the cast. */
  cast(kind: ColossusCastKind = 'cast'): void { this.play(kind); }
  hurt(): void {
    if (this.busy) return;
    this.play('hurt');
  }
  roar(): void { this.play('roar'); }
  die(): void {
    if (this.tl === 'dying') return;
    this.tl = 'dying';
    this.t = 0;
  }

  /** An interlude `pose` step. */
  pose(name: ColossusPoseName): void {
    if (name === 'attack') this.attack(); else if (name === 'cast') this.cast('cast'); else if (name === 'hurt') this.play('hurt');
    else this.roar();
  }

  /** Back to idle at t = 0 (the dev step preview replays from here). */
  reset(): void {
    this.tl = 'idle';
    this.t = 0;
    this.clock = 0;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.clock += dt;
    if (this.tl === 'idle') { this.t = this.clock % TIMELINE_FRAMES.idle; return; }
    const before = this.t;
    this.t += dt;
    for (const cue of cuesBetween(this.tl, Math.floor(before) + 1, Math.floor(this.t) + 1)) this.onCue?.(cue);
    if (this.tl === 'dying') { this.t = Math.min(this.t, TIMELINE_FRAMES.dying); return; }
    if (this.t >= TIMELINE_FRAMES[this.tl]) { this.tl = 'idle'; this.t = this.clock % TIMELINE_FRAMES.idle; }
  }

  /** The pose of every layer now. */
  frame(): ColossusPoseFrame {
    return poseAt(this.tl, this.tl === 'dying' ? Math.min(this.t, TIMELINE_FRAMES.dying - 1) : this.t, this.clock, this.layers, this.slamLimits);
  }

  /** The dev preview's `enemy: frame / t` text. */
  label(): string {
    return `${this.tl} / ${this.frameIndex}`;
  }
}
