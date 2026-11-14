/**
 * Dev-only monster animation preview (docs/ENEMY_ANIM_PLAN.md 6.2), no battle logic:
 *   ?enemyAnim=loop   every enemy cycles attack, pause, hurt, pause, cast (if it has one), pause; staggered 20 frames
 *   ?enemyAnim=step   time is frozen; `.` steps 1 frame forward, `,` 1 back (replayed from t = 0); a corner label shows
 *                     `enemy: frame / t`
 *   &slow=N           divides dt
 * BattleScene calls enemyAnimPreview.tick() once per update and dispose() on exit (removes the key listener).
 */
import { BitmapText, type Container } from 'pixi.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { BATTLE_MESSAGE_HEIGHT } from './BattleSceneTypes.js';
import { ATTACK_FRAMES, CAST_FRAMES, HURT_FRAMES, type EnemyPoseController } from './EnemyPoseController.js';

export type PreviewMode = 'loop' | 'step';
export const STAGGER = 20;
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
}

type Action = 'attack' | 'hurt' | 'cast';
interface KeySource {
  addEventListener(type: 'keydown', fn: (e: { key: string }) => void): void;
  removeEventListener(type: 'keydown', fn: (e: { key: string }) => void): void;
}

/** The loop for one enemy: [action, start frame] pairs inside a cycle, and the cycle length. */
export function schedule(hasCast: boolean): { cycle: number; events: [Action, number][] } {
  const events: [Action, number][] = [['attack', 0], ['hurt', ATTACK_FRAMES + PAUSE]];
  let t = ATTACK_FRAMES + PAUSE + HURT_FRAMES + PAUSE;
  if (hasCast) { events.push(['cast', t]); t += CAST_FRAMES + PAUSE; }
  return { cycle: t, events };
}

export class EnemyAnimPreview {
  private clock = 0;
  private started = false;
  private label: BitmapText | null = null;
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

  /** Actions due at integer frame f (global time) for every enemy. */
  private fire(f: number): void {
    for (let i = 0; i < this.target.count; i++) {
      const local = f - i * STAGGER;
      if (local < 0) continue;
      const { cycle, events } = schedule(this.target.hasCast(i));
      for (const [action, at] of events) {
        if (local % cycle !== at) continue;
        const p = this.target.poses;
        if (action === 'attack') p.playAttack(i); else if (action === 'hurt') p.playHurt(i); else p.playCast(i);
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
    return Array.from({ length: this.target.count }, (_, i) => {
      const st = this.target.poses.state(i);
      return `${this.target.name(i)}: ${st.pose} / ${Math.floor(this.target.poses.debug(i).t)}`;
    }).join('\n');
  }

  /** Corner label (step mode). */
  showLabel(parent: Container): void {
    if (this.mode !== 'step') return;
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
  enemyView: { poses: EnemyPoseController; hasCast(i: number): boolean } | null;
  enemySprites: readonly unknown[];
}

const active = new WeakMap<object, EnemyAnimPreview>();

/** BattleScene hooks: one call per update (returns the dt to run with), one on exit. No-op outside dev builds. */
export const enemyAnimPreview = {
  tick(host: PreviewHost, names: readonly string[], container: Container, dt: number): number {
    if (!import.meta.env.DEV || typeof location === 'undefined' || !host.enemyView) return dt;
    let p = active.get(host);
    if (!p) {
      const cfg = parseEnemyAnim(location.search);
      if (!cfg) return dt;
      const view = host.enemyView;
      p = new EnemyAnimPreview(cfg.mode, cfg.slow, { poses: view.poses, count: host.enemySprites.length,
        hasCast: (i) => view.hasCast(i), name: (i) => names[i] ?? `enemy ${i}` }, typeof window === 'undefined' ? null : window);
      active.set(host, p);
    }
    const out = p.frameDt(dt);
    p.showLabel(container);
    return out;
  },
  dispose(host: object): void {
    active.get(host)?.dispose();
    active.delete(host);
  },
};
