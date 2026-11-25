/**
 * Dev-only monster animation preview (docs/ENEMY_ANIM_PLAN.md 6.2), no battle logic:
 *   ?enemyAnim=loop   every enemy cycles attack, pause, hurt, pause, cast (if it has one), pause; the enemies take
 *                     turns (turnPlan: one attacker at a time, EF-H follow-up); melee enemies travel to the first
 *                     living party sprite and back (pass F item 3)
 *   ?enemyAnim=step   time is frozen; `.` steps 1 frame forward, `,` 1 back (replayed from t = 0); a corner label shows
 *                     `enemy: frame / t`
 *   &slow=N           divides dt
 * A colossus form (docs/CHAOS_FORMS_PLAN.md 4.3, R17) loops slam, beam, cast and hurt (its own timelines, in place),
 * and its step label reads `enemy: <timeline> / <frame>`.
 * In the battle these run on the scene-wide dev clock (battleDevClock.ts): it steps and slows every system, and the
 * preview only drives the loop on that dt (`,` is not available there). BattleScene calls enemyAnimPreview.tick() once
 * per update, after the dev clock, and dispose() on exit.
 */
import { BitmapText, type Container } from 'pixi.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { BATTLE_MESSAGE_HEIGHT } from './BattleSceneTypes.js';
import { ATTACK_FRAMES, CAST_FRAMES, HURT_FRAMES, type EnemyPoseController } from './EnemyPoseController.js';
import { EnemyActorPoses } from './colossus/enemyActorView.js';
import { TIMELINE_FRAMES } from './colossus/colossusChoreography.js';

export type PreviewMode = 'loop' | 'step';
export const PAUSE = 20;
/** E18: the step label sits just below the battle message window (y 0 to BATTLE_MESSAGE_HEIGHT). */
export const LABEL_POS = { x: 16, y: BATTLE_MESSAGE_HEIGHT + 8 } as const;

export function parseEnemyAnim(search: string): { mode: PreviewMode; slow: number } | null {
  const q = new URLSearchParams(search);
  const mode = q.get('enemyAnim');
  if (mode !== 'loop' && mode !== 'step') return null;
  const slow = Number(q.get('slow'));
  return { mode, slow: Number.isFinite(slow) && slow >= 1 ? slow : 1 };
}

export interface PreviewTarget {
  poses: EnemyPoseController;
  count: number;
  hasCast(i: number): boolean;
  name(i: number): string;
  /** Start enemy i's attack (the view measures its travel); the poses' in-place attack when absent. */
  attack?(i: number): void;
  /** Enemy i's attack length (a travelling attack is longer); ATTACK_FRAMES when absent. */
  attackFrames?(i: number): number;
  /** Enemy i is a colossus form (it loops colossusSchedule). */
  colossus?(i: number): boolean;
  /** Start enemy i's beam (a colossus). */
  beam?(i: number): void;
  /** The step label's pose text for enemy i (a colossus's timeline and frame), or null for the pose name. */
  label?(i: number): string | null;
}

/** One label line per actor, `<name>: <frame> / <t>` (or the actor's own label, e.g. a colossus timeline). Pure; the
 *  step label here and the `&poseLabel=1` label (kneelPreview.ts) share it. */
export function poseLabelLines(poses: { state(i: number): { pose: string }; debug(i: number): { t: number } },
  names: (i: number) => string, count: number, label?: (i: number) => string | null): string[] {
  return Array.from({ length: count }, (_, i) => `${names(i)}: ${label?.(i) ?? `${poses.state(i).pose} / ${Math.floor(poses.debug(i).t)}`}`);
}

type Action = 'attack' | 'hurt' | 'cast' | 'beam';
interface KeySource {
  addEventListener(type: 'keydown', fn: (e: { key: string }) => void): void;
  removeEventListener(type: 'keydown', fn: (e: { key: string }) => void): void;
}

/** The loop for one enemy: [action, start frame] pairs inside a cycle, and the cycle length. */
export function schedule(hasCast: boolean, attackFrames = ATTACK_FRAMES): { cycle: number; events: [Action, number][] } {
  const events: [Action, number][] = [['attack', 0], ['hurt', attackFrames + PAUSE]];
  let t = attackFrames + PAUSE + HURT_FRAMES + PAUSE;
  if (hasCast) { events.push(['cast', t]); t += CAST_FRAMES + PAUSE; }
  return { cycle: t, events };
}

/** The turn plan (EF-H follow-up, docs/ENEMY_FEEDBACK_PLAN.md): each enemy's loop starts after the attack slots of the
 *  enemies before it (a slot = its attack length + PAUSE), and all share one cycle, the larger of the slots' sum and
 *  the longest own cycle, so no two attack windows overlap. Pure. */
export function turnPlan(loops: readonly { cycle: number; attack: number }[]): { offsets: number[]; cycle: number } {
  const offsets: number[] = [];
  let t = 0;
  for (const l of loops) { offsets.push(t); t += l.attack + PAUSE; }
  return { offsets, cycle: Math.max(t, ...loops.map((l) => l.cycle)) };
}

/** A colossus's loop: slam, beam, cast and hurt, each followed by the pause. */
export function colossusSchedule(): { cycle: number; events: [Action, number][] } {
  const events: [Action, number][] = [];
  let t = 0;
  for (const [a, n] of [['attack', TIMELINE_FRAMES.slam], ['beam', TIMELINE_FRAMES.beam], ['cast', TIMELINE_FRAMES.cast],
    ['hurt', TIMELINE_FRAMES.hurt]] as [Action, number][]) { events.push([a, t]); t += n + PAUSE; }
  return { cycle: t, events };
}

export class EnemyAnimPreview {
  private clock = 0;
  private started = false;
  private label: BitmapText | null = null;
  /** Each enemy's loop, fixed when the preview starts. */
  private plan: { loops: ReturnType<typeof schedule>[]; offsets: number[]; cycle: number } | null = null;
  private readonly onKey = (e: { key: string }): void => {
    if (this.mode !== 'step') return;
    if (e.key === '.') this.stepTo(this.clock + 1);
    else if (e.key === ',') this.stepTo(Math.max(0, this.clock - 1));
  };

  constructor(readonly mode: PreviewMode, readonly slow: number, private readonly target: PreviewTarget,
    private readonly keys: KeySource | null = null) {
    keys?.addEventListener('keydown', this.onKey);
  }

  get time(): number { return this.clock; }

  /** Each enemy's loop and its turn, fixed when the preview first fires (the views have measured their travel). */
  private turns(): { loops: ReturnType<typeof schedule>[]; offsets: number[]; cycle: number } {
    if (!this.plan) {
      const loops = Array.from({ length: this.target.count }, (_, i) => this.target.colossus?.(i) ? colossusSchedule()
        : schedule(this.target.hasCast(i), this.target.attackFrames?.(i) ?? ATTACK_FRAMES));
      // the attack window: up to the next event less its pause (schedule / colossusSchedule put one after each action)
      const attack = loops.map((l) => (l.events.find((e) => e[0] !== 'attack')?.[1] ?? l.cycle) - PAUSE);
      this.plan = { loops, ...turnPlan(loops.map((l, i) => ({ cycle: l.cycle, attack: attack[i] }))) };
    }
    return this.plan;
  }

  /** Actions due at integer frame f (global time) for every enemy. */
  private fire(f: number): void {
    const { loops, offsets, cycle } = this.turns();
    for (let i = 0; i < this.target.count; i++) {
      const local = f - offsets[i];
      if (local < 0) continue;
      const { events } = loops[i];
      for (const [action, at] of events) {
        if (local % cycle !== at) continue;
        const p = this.target.poses;
        if (action === 'attack') { if (this.target.attack) this.target.attack(i); else p.playAttack(i); }
        else if (action === 'hurt') p.playHurt(i); else if (action === 'beam') this.target.beam?.(i); else p.playCast(i);
      }
    }
  }

  /** Replay from t = 0 to frame t (step mode). */
  stepTo(t: number): void {
    this.started = true;
    this.target.poses.reset();
    for (let f = 0; f < t; f++) { this.fire(f); this.target.poses.update(1); }
    this.clock = t;
    this.fire(t);
  }

  /** The dt the scene should run with: loop slows it and fires the schedule; step freezes it (0). */
  frameDt(dt: number): number {
    if (this.mode === 'step') {
      if (!this.started) this.stepTo(0);
      this.started = true;
      return 0;
    }
    const d = dt / this.slow;
    const before = this.clock;
    this.clock += d;
    for (let f = Math.ceil(before); f < this.clock; f++) this.fire(f);
    return d;
  }

  labelText(): string {
    return poseLabelLines(this.target.poses, (i) => this.target.name(i), this.target.count, this.target.label).join('\n');
  }

  /** Corner label (step mode, or `force` while the scene-wide dev clock steps). */
  showLabel(parent: Container, force = false): void {
    if (this.mode !== 'step' && !force) return;
    if (!this.label) {
      this.label = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: 24, fill: 0xffff00 } });
      this.label.position.set(LABEL_POS.x, LABEL_POS.y);
      parent.addChild(this.label);
    }
    this.label.text = `t ${this.clock}\n${this.labelText()}`;
  }

  dispose(): void {
    this.keys?.removeEventListener('keydown', this.onKey);
    this.label?.parent?.removeChild(this.label);
    this.label = null;
  }
}

interface PreviewHost {
  enemyView: { poses: EnemyPoseController; hasCast(i: number): boolean; playAttack?(i: number, target: Container | null): void;
    attackLength?(i: number, target: Container | null): number } | null;
  enemySprites: readonly unknown[];
  /** The party sprites: melee enemies travel to the first living (visible) one. */
  partySprites?: readonly Container[];
}

/** The first party sprite still shown (a fallen hero fades or drops; the preview only needs a visible target). */
function firstLiving(sprites: readonly Container[] | undefined): Container | null {
  return sprites?.find((s) => s.visible && s.alpha > 0) ?? null;
}

/** The preview's view of a battle display: the poses (routed for a colossus, EnemyActorPoses), the view's travel. */
export function previewTarget(host: PreviewHost, names: readonly string[], target: () => Container | null): PreviewTarget {
  const view = host.enemyView!;
  const routed = view.poses instanceof EnemyActorPoses ? view.poses : null;
  return { poses: view.poses, count: host.enemySprites.length, hasCast: (i) => view.hasCast(i), name: (i) => names[i] ?? `enemy ${i}`,
    ...(view.playAttack ? { attack: (i: number) => view.playAttack?.(i, target()) } : {}),
    ...(view.attackLength ? { attackFrames: (i: number) => view.attackLength?.(i, target()) ?? ATTACK_FRAMES } : {}),
    ...(routed ? { colossus: (i: number) => routed.colossus(i) !== null, beam: (i: number) => routed.playBeam(i), label: (i: number) => routed.label(i) } : {}) };
}

const active = new WeakMap<object, EnemyAnimPreview>();

/** BattleScene hooks: one call per update with the dev clock's dt (the loop driver runs at slow 1 on it, since the clock
 *  already slowed or stepped it; `stepping` shows the frame label), one on exit. No-op outside dev builds. */
export const enemyAnimPreview = {
  tick(host: PreviewHost, names: readonly string[], container: Container, dt: number, stepping = false): void {
    if (!import.meta.env.DEV || typeof location === 'undefined' || !host.enemyView) return;
    let p = active.get(host);
    if (!p) {
      if (!parseEnemyAnim(location.search)) return;
      p = new EnemyAnimPreview('loop', 1, previewTarget(host, names, () => firstLiving(host.partySprites)));
      active.set(host, p);
    }
    p.frameDt(dt);
    p.showLabel(container, stepping);
  },
  dispose(host: object): void {
    active.get(host)?.dispose();
    active.delete(host);
  },
};
