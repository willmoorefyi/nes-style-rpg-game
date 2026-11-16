/**
 * Plays one interlude script (formInterlude.ts) against a host (docs/CHAOS_FORMS_PLAN.md 2.3): each step's start, its
 * per-frame progress (the dissolve, tint, fade, rise and pan) and its end. Pure of PixiJS: the host does the drawing
 * (formChangeView.ts), so the order and timing are testable on their own. A rise ends at the next pan's `from`
 * (riseSpan, 18.4): the swap builds the form at that pan offset, `from_dy` below it, so the pan starts without a jump.
 */
import { InterludeClock, type DissolveStyle, type InterludePose, type InterludeStep } from './formInterlude.js';
import { panAt, riseAt } from './colossus/colossusChoreography.js';
import { SHAKE_FRAMES } from './screenShake.js';
import { riseSpan } from '../../data/interludeScripts.js';

export interface InterludeHost {
  message(text: string): void;
  /** A full-screen flash (`alpha` 0 clears it). */
  flash(color: number, alpha: number): void;
  shake(): void;
  /** The backdrop's multiply tint toward `color` (0 = none). */
  tint(color: number, alpha: number): void;
  /** The darkening overlay (0 = clear). */
  fade(alpha: number): void;
  /** The outgoing form leaves: u in [0, 1], t its frame. */
  dissolve(style: DissolveStyle, u: number, t: number): void;
  /** Build the incoming form, `riseFrom` screen px below its rise's end (the next rise's start). */
  swap(riseFrom: number): void;
  /** Screen px below the rise's end (the pan offset set at the swap, or rest). */
  rise(dy: number): void;
  pose(name: InterludePose): void;
  variant(layer: string, frame: string): void;
  pan(x: number, y: number): void;
  music(id: string): void;
  /** The script ended (the confirm hold-off; flashes and fades cleared). */
  end(): void;
}

export const colorOf = (hex: string): number => {
  const h = hex.replace('#', '');
  return parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
};
const step4 = (a: number): number => Math.round(Math.min(1, Math.max(0, a)) * 4) / 4;

export class FormInterludePlayer {
  private readonly clock: InterludeClock;
  private running = new Set<number>();
  private tintNow = 0;
  private tintFrom = 0;
  private fadeNow = 0;
  private fadeFrom = 0;
  private ended = false;

  constructor(private readonly steps: readonly InterludeStep[], private readonly host: InterludeHost, messageFrames?: number) {
    this.clock = new InterludeClock(steps, messageFrames);
  }

  get done(): boolean { return this.ended; }

  /** One frame (confirm advances a message line); true once the script has ended. */
  update(dt: number, confirm: boolean): boolean {
    if (this.ended) return true;
    const { started } = this.clock.update(dt, confirm);
    const active = new Map(this.clock.active().map((a) => [a.index, a]));
    for (const i of [...this.running]) if (!active.has(i) || started.includes(i)) { this.finish(i); this.running.delete(i); }
    for (const i of started) { this.begin(i); this.running.add(i); }
    for (const [i, a] of active) this.tick(i, a.t, a.frames);
    if (this.clock.done) {
      for (const i of this.running) this.finish(i);
      this.running.clear();
      this.ended = true;
      this.host.end();
    }
    return this.ended;
  }

  private begin(i: number): void {
    const s = this.steps[i];
    const h = this.host;
    switch (s.type) {
      case 'message': h.message(s.text); break;
      case 'flash': h.flash(colorOf(s.color), s.alpha); break;
      case 'shake': h.shake(); break;
      case 'tint': this.tintFrom = this.tintNow; break;
      case 'fade': this.fadeFrom = this.fadeNow; break;
      case 'swap': {
        const r = this.steps.findIndex((x, j) => j > i && x.type === 'rise');
        const span = r > 0 ? riseSpan(this.steps, r) : null;
        h.swap(span ? span.from[1] - span.to[1] : 0);
        if (span && (span.to[0] !== 0 || span.to[1] !== 0)) h.pan(span.to[0], span.to[1]);
        break;
      }
      case 'rise': h.rise(s.from_dy); this.fadeFrom = this.fadeNow; break;
      case 'pose': h.pose(s.name); break;
      case 'variant': h.variant(s.layer, s.frame); break;
      case 'pan': h.pan(s.from[0], s.from[1]); break;
      case 'music': h.music(s.id); break;
      default: break;
    }
  }

  private tick(i: number, t: number, frames: number): void {
    const s = this.steps[i];
    const u = frames > 0 ? Math.min(1, t / frames) : 1;
    switch (s.type) {
      case 'flash': this.host.flash(colorOf(s.color), t < s.frames ? step4(s.alpha * (1 - t / s.frames)) : 0); break;
      case 'shake': if (t % SHAKE_FRAMES === 0 && t < s.times * SHAKE_FRAMES) this.host.shake(); break;
      case 'tint': this.tintNow = this.tintFrom + (s.alpha - this.tintFrom) * u; this.host.tint(colorOf(s.color), this.tintNow); break;
      case 'fade': this.fadeNow = this.fadeFrom + (s.alpha - this.fadeFrom) * u; this.host.fade(step4(this.fadeNow)); break;
      case 'dissolve': this.host.dissolve(s.style, u, t); break;
      case 'rise':
        this.host.rise(riseAt(t, s.frames, s.from_dy));
        if (this.fadeFrom > 0) { this.fadeNow = this.fadeFrom * (1 - u); this.host.fade(step4(this.fadeNow)); }
        break;
      case 'pan': { const p = panAt(t, s.frames, s.from, s.ease); this.host.pan(p.x, p.y); break; }
      default: break;
    }
  }

  private finish(i: number): void {
    const s = this.steps[i];
    if (s.type === 'flash') this.host.flash(colorOf(s.color), 0);
    if (s.type === 'dissolve') this.host.dissolve(s.style, 1, s.frames);
    if (s.type === 'rise') this.host.rise(0);
    if (s.type === 'pan') this.host.pan(0, 0);
  }
}
