/**
 * Transformation interludes as a pure timeline (docs/CHAOS_FORMS_PLAN.md 2.3, R18, A1, A2, R19). Steps run in order;
 * a step with `with: previous` starts on the same frame as the step before it, and a group (a step and its `with`
 * partners) lasts as long as its longest member. The unskipped total counts a message at 90 frames (the validator is
 * pinned to message speed 3) and a shake at 8 frames per shake. Confirm advances a message step only.
 */
import { BATTLE_MESSAGE_FRAMES } from './battleTiming.js';
import { SHAKE_FRAMES } from './screenShake.js';
import { TIMELINE_FRAMES, type PanEase } from './colossus/colossusChoreography.js';
import { panLimits, type ColossusFormSpec } from './colossus/colossusIndex.js';

type With = { with?: 'previous' };
export type DissolveStyle = 'flicker' | 'fade' | 'sink';
export type InterludePose = 'cast' | 'attack' | 'hurt' | 'roar';
export type InterludeStep = With & (
  | { type: 'message'; text: string }
  | { type: 'wait'; frames: number }
  | { type: 'flash'; color: string; frames: number; alpha: number }
  | { type: 'shake'; times: number }
  | { type: 'tint'; color: string; alpha: number; frames: number }
  | { type: 'fade'; alpha: number; frames: number }
  | { type: 'dissolve'; frames: number; style: DissolveStyle }
  | { type: 'swap' }
  | { type: 'rise'; frames: number; from_dy: number }
  | { type: 'pose'; name: InterludePose }
  | { type: 'variant'; layer: string; frame: string }
  | { type: 'pan'; from: [number, number]; frames: number; ease: PanEase }
  | { type: 'music'; id: string });
export type InterludeStepType = InterludeStep['type'];

export const STEP_TYPES: readonly InterludeStepType[] = ['message', 'wait', 'flash', 'shake', 'tint', 'fade', 'dissolve', 'swap', 'rise',
  'pose', 'variant', 'pan', 'music'];
/** The unskipped cap per script (D-O8), and chaos_i2's (the rise and the reveal pan, D-O15). */
export const INTERLUDE_CAP = 480;
export const INTERLUDE_CAPS: Readonly<Record<string, number>> = { chaos_i2: 600 };
/** The confirm hold-off when an interlude ends. */
export const END_HOLDOFF = 24;
const POSE_FRAMES: Record<InterludePose, number> = { cast: TIMELINE_FRAMES.cast, attack: TIMELINE_FRAMES.slam,
  hurt: TIMELINE_FRAMES.hurt, roar: TIMELINE_FRAMES.roar };

/** A step's unskipped length in frames. */
export function stepFrames(s: InterludeStep, messageFrames = BATTLE_MESSAGE_FRAMES): number {
  switch (s.type) {
    case 'message': return messageFrames;
    case 'shake': return s.times * SHAKE_FRAMES;
    case 'pose': return POSE_FRAMES[s.name];
    case 'swap': case 'variant': case 'music': return 0;
    default: return s.frames;
  }
}

interface Group { start: number; steps: number[]; length: number }

function groupsOf(steps: readonly InterludeStep[], messageFrames: number): Group[] {
  const out: Group[] = [];
  let t = 0;
  steps.forEach((s, i) => {
    const last = out[out.length - 1];
    if (s.with === 'previous' && last) {
      last.steps.push(i);
      const len = Math.max(last.length, stepFrames(s, messageFrames));
      t += len - last.length;
      last.length = len;
      return;
    }
    out.push({ start: t, steps: [i], length: stepFrames(s, messageFrames) });
    t += out[out.length - 1].length;
  });
  return out;
}

/** The script's unskipped total and the frame every step starts on. */
export function compileInterlude(steps: readonly InterludeStep[], messageFrames = BATTLE_MESSAGE_FRAMES):
  { total: number; events: { frame: number; index: number }[] } {
  const groups = groupsOf(steps, messageFrames);
  return { total: groups.reduce((n, g) => n + g.length, 0), events: groups.flatMap((g) => g.steps.map((index) => ({ frame: g.start, index }))) };
}

/** The running script: `update` once per frame returns the steps that start on it. */
export class InterludeClock {
  private readonly groups: Group[];
  private g = -1;
  private elapsed: number[] = [];
  private cut = new Set<number>();
  private finished = false;

  constructor(private readonly steps: readonly InterludeStep[], private readonly messageFrames = BATTLE_MESSAGE_FRAMES) {
    this.groups = groupsOf(steps, messageFrames);
    if (this.groups.length === 0) this.finished = true;
  }

  get done(): boolean { return this.finished; }

  private groupDone(): boolean {
    const grp = this.groups[this.g];
    return grp.steps.every((i, k) => this.cut.has(i) || this.elapsed[k] >= stepFrames(this.steps[i], this.messageFrames));
  }

  /** One frame. Confirm ends a running message step (nothing else); a finished group hands over to the next. */
  update(dt: number, confirm: boolean): { started: number[] } {
    const started: number[] = [];
    if (this.finished) return { started };
    if (confirm && this.g >= 0) for (const i of this.groups[this.g].steps) if (this.steps[i].type === 'message') this.cut.add(i);
    while (this.g < 0 || this.groupDone()) {
      if (this.g + 1 >= this.groups.length) { this.finished = true; return { started }; }
      this.g++;
      this.elapsed = this.groups[this.g].steps.map(() => 0);
      started.push(...this.groups[this.g].steps);
    }
    this.elapsed = this.elapsed.map((e) => e + dt);
    if (this.g === this.groups.length - 1 && this.groupDone()) this.finished = true;
    return { started };
  }

  /** The running steps with their frame and length (the rise, pan, dissolve and tint progress). */
  active(): { index: number; t: number; frames: number }[] {
    if (this.g < 0 || this.finished) return [];
    return this.groups[this.g].steps.map((index, k) => ({ index, t: this.elapsed[k], frames: stepFrames(this.steps[index], this.messageFrames) }));
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

/** Problems with one script (empty: valid): fields and values per step, the caps, the A2 pan start, swaps. */
export function interludeProblems(id: string, steps: readonly InterludeStep[]): string[] {
  const out: string[] = [];
  const p = (i: number, m: string): void => { out.push(`interlude ${id} step ${i + 1}: ${m}`); };
  let swaps = 0;
  steps.forEach((s, i) => {
    if (!STEP_TYPES.includes(s.type)) { p(i, `unknown step type ${String(s.type)}`); return; }
    if (s.with !== undefined && s.with !== 'previous') p(i, 'with must be previous');
    if ('frames' in s && (!isNum(s.frames) || s.frames < 0 || !Number.isInteger(s.frames))) p(i, 'frames must be a whole number >= 0');
    if ('alpha' in s && (!isNum(s.alpha) || s.alpha < 0 || s.alpha > 1 || (s.type === 'flash' && s.alpha === 0))) p(i, 'alpha must be in (0, 1] (0 allowed for tint and fade)');
    if ('color' in s && !COLOR.test(String(s.color))) p(i, 'color must be #rgb or #rrggbb');
    if (s.type === 'message' && typeof s.text !== 'string') p(i, 'message needs text');
    if (s.type === 'shake' && (!Number.isInteger(s.times) || s.times < 1)) p(i, 'times must be a whole number >= 1');
    if (s.type === 'dissolve' && !['flicker', 'fade', 'sink'].includes(s.style)) p(i, 'style must be flicker, fade or sink');
    if (s.type === 'pose' && !(s.name in POSE_FRAMES)) p(i, 'pose must be cast, attack, hurt or roar');
    if (s.type === 'swap' && ++swaps > 1) p(i, 'more than one swap');
    if (s.type === 'rise' && swaps === 0) p(i, 'rise before the swap');
    if (s.type === 'rise' && (!Number.isInteger(s.from_dy) || s.from_dy < 0)) p(i, 'from_dy must be a whole number >= 0');
    if (s.type === 'pan') {
      const [dx, dy] = Array.isArray(s.from) ? s.from : [NaN, NaN];
      if (!Number.isInteger(dx) || !Number.isInteger(dy)) p(i, 'from must be two whole numbers');
      else if (dx > 0 || dy < -70 || dy > 0) p(i, `pan start ${dx},${dy}: A2 needs dx <= 0 and dy in [-70, 0]`);
      if (s.ease !== 'linear' && s.ease !== 'out') p(i, 'ease must be linear or out');
    }
  });
  if (out.length > 0) return out;
  const cap = INTERLUDE_CAPS[id] ?? INTERLUDE_CAP;
  const total = compileInterlude(steps).total;
  if (total > cap) out.push(`interlude ${id}: ${total} frames > ${cap} unskipped`);
  return out;
}

/** Every pan offset inside the coverage limits of the form it reveals (R13; the limits come from colossus.json). */
export function panProblems(steps: readonly InterludeStep[], form: ColossusFormSpec): string[] {
  const { dx, dy } = panLimits(form);
  return steps.flatMap((s, i) => (s.type === 'pan' && (s.from[0] < dx[0] || s.from[0] > dx[1] || s.from[1] < dy[0] || s.from[1] > dy[1])
    ? [`step ${i + 1}: pan ${s.from.join(',')} outside dx [${dx.join(', ')}], dy [${dy.join(', ')}]`] : []));
}
