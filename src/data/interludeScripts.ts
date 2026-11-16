import type { EnemyData } from '../types/index.js';
import { ValidationError } from '../core/schemaValidation.js';

/**
 * The transformation interlude scripts (assets/data/battle-interludes.yaml; docs/CHAOS_FORMS_PLAN.md 2.3): the step
 * types, the validator a registry runs per script (a bad script throws `ValidationError`), the unskipped time (R18, A1)
 * and the per-phase rules (R19; rev 4: the B4 pan limits and a `rise` ending at the next `pan`'s `from`, 18.4). A
 * non-form phase may name a script too (B5, 18.8 row 2c: F3's 0.25 phase plays `chaos_crack`). Pure: no PixiJS. The player (`formInterlude.ts`) and the registry
 * (`InterludeRegistry`) are the view's.
 */

/** A message step at message speed 3 (A1: the validator is pinned there): `BATTLE_MESSAGE_FRAMES` in battleTiming.ts. */
export const INTERLUDE_MESSAGE_FRAMES = 90;
/** One `shake`: `SHAKE_FRAMES` of screenShake.ts. */
export const INTERLUDE_SHAKE_FRAMES = 8;
/** The unskipped-time cap (D-O8), and the longer cap of the F3 reveal (D-O15). */
export const INTERLUDE_CAP_FRAMES = 480;
const CAP_OVERRIDES: Readonly<Record<string, number>> = { chaos_i2: 600 };
/** The colossus pose timelines a `pose` step plays once (4.3), with their lengths in frames. */
export const POSE_FRAMES: Readonly<Record<string, number>> = { attack: 44, cast: 40, hurt: 20, roar: 60 };
/**
 * The motion envelope of the layers that move during a pan (B4), screen px: the body's breathing (18.3: dy 0 -> -4)
 * lifts the bottom border, nothing moves sideways, and the slam dip never runs in an interlude.
 */
export const PAN_ENVELOPE: Readonly<PanEnvelope> = { up: 4, down: 0, left: 0, right: 0 };

type Hex = `#${string}`;
interface Concurrent { with?: 'previous' }
export type InterludeStep = Concurrent & (
  | { type: 'message'; text: string }
  | { type: 'wait'; frames: number }
  | { type: 'flash'; color: Hex; frames: number; alpha: number }
  | { type: 'shake'; times: number }
  | { type: 'tint'; color: Hex; alpha: number; frames: number }
  | { type: 'fade'; alpha: number; frames: number }
  | { type: 'dissolve'; frames: number; style: 'flicker' | 'fade' | 'sink' }
  | { type: 'swap' }
  | { type: 'rise'; frames: number; from_dy: number }
  | { type: 'pose'; name: string }
  | { type: 'variant'; layer: string; frame: string }
  | { type: 'pan'; from: [number, number]; frames: number; ease: 'linear' | 'out' }
  | { type: 'music'; id: string }
);
export interface InterludeScript { id: string; steps: InterludeStep[] }
/** The allowed pan offsets, screen px from rest (B4): every opaque border stays off-screen at every offset. */
export interface PanLimits { dx: [number, number]; dy: [number, number] }
/** How far (screen px, >= 0) the moving layers can carry the art up, down, left and right of the pan offset. */
export interface PanEnvelope { up: number; down: number; left: number; right: number }
/** A colossus form's geometry as colossus.json writes it (18.5): canvas [w, h] art px, scale, rest place [x, y] screen px. */
export interface PanGeometry { canvas: [number, number]; scale: number; place: [number, number] }

const FIELDS: Readonly<Record<InterludeStep['type'], readonly string[]>> = {
  message: ['text'], wait: ['frames'], flash: ['color', 'frames', 'alpha'], shake: ['times'], tint: ['color', 'alpha', 'frames'],
  fade: ['alpha', 'frames'], dissolve: ['frames', 'style'], swap: [], rise: ['frames', 'from_dy'], pose: ['name'],
  variant: ['layer', 'frame'], pan: ['from', 'frames', 'ease'], music: ['id'],
};

export function interludeCap(id: string): number {
  return CAP_OVERRIDES[id] ?? INTERLUDE_CAP_FRAMES;
}

/** One step's unskipped length in frames (a message at speed 3, unskipped). */
export function stepFrames(step: InterludeStep): number {
  switch (step.type) {
    case 'message': return INTERLUDE_MESSAGE_FRAMES;
    case 'shake': return step.times * INTERLUDE_SHAKE_FRAMES;
    case 'pose': return POSE_FRAMES[step.name] ?? 0;
    case 'swap': case 'variant': case 'music': return 0;
    default: return step.frames;
  }
}

/** Each step's start frame and the script's total: sequential steps, `with: previous` starts with the step before it. */
export function interludeTimeline(script: InterludeScript): { starts: number[]; total: number } {
  let total = 0;
  let prevStart = 0;
  const starts = script.steps.map((step) => {
    const start = step.with === 'previous' ? prevStart : total;
    total = Math.max(total, start + stepFrames(step));
    prevStart = start;
    return start;
  });
  return { starts, total };
}

export const interludeFrames = (script: InterludeScript): number => interludeTimeline(script).total;

function bad(id: string, i: number, what: string): never {
  throw new ValidationError(`battle-interludes(${id}).steps[${i}]: ${what}`);
}

/** Validate one script: known step types, their fields, `with: previous`, and the cap. Throws `ValidationError`. */
export function validateInterludeScript(script: InterludeScript): void {
  const id = typeof script?.id === 'string' ? script.id : '?';
  if (!Array.isArray(script?.steps) || script.steps.length === 0) throw new ValidationError(`battle-interludes(${id}).steps: a non-empty list`);
  script.steps.forEach((raw, i) => {
    const step = raw as unknown as Record<string, unknown>;
    const type = step.type as InterludeStep['type'];
    if (!(type in FIELDS)) bad(id, i, `unknown step type ${String(step.type)}`);
    const extra = Object.keys(step).filter((k) => k !== 'type' && k !== 'with' && !FIELDS[type].includes(k));
    if (extra.length) bad(id, i, `unknown fields ${extra.join(', ')}`);
    if (step.with !== undefined && step.with !== 'previous') bad(id, i, `with: expected previous, got ${String(step.with)}`);
    if (step.with !== undefined && i === 0) bad(id, i, 'with: previous on the first step');
    const int = (k: string, min = 1) => { if (!Number.isInteger(step[k]) || (step[k] as number) < min) bad(id, i, `${k}: an integer >= ${min}`); };
    const unit = (k: string, zero = false) => {
      const v = step[k];
      if (typeof v !== 'number' || !(zero ? v >= 0 && v <= 1 : v > 0 && v <= 1)) bad(id, i, `${k}: a number in ${zero ? '[0, 1]' : '(0, 1]'}`);
    };
    const color = () => { if (typeof step.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(step.color)) bad(id, i, 'color: "#rrggbb"'); };
    const str = (k: string) => { if (typeof step[k] !== 'string' || step[k] === '') bad(id, i, `${k}: a string`); };
    if (FIELDS[type].includes('frames')) int('frames');
    switch (type) {
      case 'message':
        if (typeof step.text !== 'string' || !/^[\x20-\x7e]+$/.test(step.text)) bad(id, i, 'text: printable ASCII text (the NES font)');
        break;
      case 'flash': color(); unit('alpha'); break;
      case 'tint': color(); unit('alpha', true); break;
      case 'fade': unit('alpha', true); break;
      case 'shake': int('times'); break;
      case 'dissolve': if (!['flicker', 'fade', 'sink'].includes(step.style as string)) bad(id, i, 'style: flicker | fade | sink'); break;
      case 'rise': int('from_dy'); break;
      case 'pose': if (!((step.name as string) in POSE_FRAMES)) bad(id, i, `pose: one of ${Object.keys(POSE_FRAMES).join(' | ')}`); break;
      case 'variant': str('layer'); str('frame'); break;
      case 'music': str('id'); break;
      case 'pan': {
        const f = step.from;
        if (!Array.isArray(f) || f.length !== 2 || !f.every(Number.isInteger)) bad(id, i, 'from: [dx, dy] whole art px');
        if (step.ease !== 'linear' && step.ease !== 'out') bad(id, i, 'ease: linear | out');
        break;
      }
      default: break;
    }
  });
  const total = interludeFrames(script);
  if (total > interludeCap(id)) throw new ValidationError(`battle-interludes(${id}): ${total} unskipped frames, over the cap ${interludeCap(id)}`);
}

/**
 * The pan limits (B4, 18.4): the border rule minus the motion envelope, per axis, in screen px from rest. The canvas's
 * left, right and bottom borders carry opaque body pixels, so they stay off-screen (left <= -margin, right >= w +
 * margin) or behind the bottom strip (bottom >= 780 + margin); the top border is glow only and stays behind the message
 * window (top <= 120 - margin). For the planned F3 ((-527, -210), 2700 x 1080 at scale 1, the 4 px breathing):
 * dx [-247, +521], dy [-80, +324].
 */
export function panLimits(g: PanGeometry, env: PanEnvelope = PAN_ENVELOPE,
  field = { w: 1920, top: 120, bottom: 780 }, margin = 6): PanLimits {
  const [x, y] = g.place;
  const w = g.canvas[0] * g.scale;
  const h = g.canvas[1] * g.scale;
  return {
    dx: [Math.ceil(field.w + margin + env.left - (x + w)), Math.floor(-margin - env.right - x)],
    dy: [Math.ceil(field.bottom + margin + env.up - (y + h)), Math.floor(field.top - margin - env.down - y)],
  };
}

/**
 * Where a `rise` (step `i`) carries the canvas, screen px from rest: it ends at the `from` of the next `pan` (18.4, so
 * the pan starts without a jump), or at rest when no pan follows, and starts `from_dy` below its end.
 */
export function riseSpan(steps: readonly InterludeStep[], i: number): { from: [number, number]; to: [number, number] } {
  const rise = steps[i];
  if (rise?.type !== 'rise') throw new Error(`riseSpan: step ${i} is not a rise`);
  const pan = steps.slice(i + 1).find((s) => s.type === 'pan');
  const to: [number, number] = pan?.type === 'pan' ? [pan.from[0], pan.from[1]] : [0, 0];
  return { from: [to[0], to[1] + rise.from_dy], to };
}

const artOf = (e: EnemyData): string => e.colossus ?? e.sprite;

/**
 * The rules for the script that plays when `from` changes into `to` (R19, B4; `from === to` for a non-form phase):
 * exactly one `swap` when the art id changes and none when it does not (F3 -> F4, chaos_crack); `rise` only after the
 * swap and only into a colossus; `variant` and `pan` only on a colossus form, each pan inside `limits` (when known);
 * a rise ends at the next pan's `from` (`riseSpan`), so that pan may not run `with: previous` beside the rise, and no
 * swap or other rise may come between them.
 */
export function interludeFormErrors(script: InterludeScript, from: EnemyData, to: EnemyData, limits?: PanLimits): string[] {
  const errors: string[] = [];
  const swaps = script.steps.filter((s) => s.type === 'swap').length;
  const changes = artOf(from) !== artOf(to);
  if (changes && swaps !== 1) errors.push(`${script.id}: the art changes (${artOf(from)} -> ${artOf(to)}), so exactly one swap (got ${swaps})`);
  if (!changes && swaps !== 0) errors.push(`${script.id}: the art is kept (${artOf(to)}), so no swap (got ${swaps})`);
  const swapAt = script.steps.findIndex((s) => s.type === 'swap');
  script.steps.forEach((s, i) => {
    if (s.type === 'rise' && (swapAt < 0 || i < swapAt || !to.colossus)) errors.push(`${script.id}: rise only after the swap, into a colossus form`);
    if (s.type === 'variant' && !to.colossus) errors.push(`${script.id}: variant only on a colossus form`);
    if (s.type === 'rise') {
      const next = script.steps.findIndex((x, j) => j > i && x.type === 'pan');
      if (next > 0 && script.steps.slice(i + 1, next).some((x) => x.type === 'swap' || x.type === 'rise')) {
        errors.push(`${script.id}: a swap or a rise between the rise and the pan it ends at`);
      }
      const after = script.steps.slice(i + 1).findIndex((x) => x.with !== 'previous');
      const group = script.steps.slice(i + 1, after < 0 ? undefined : i + 1 + after);
      if (group.some((x) => x.type === 'pan')) errors.push(`${script.id}: a pan alongside the rise (the rise ends where the pan starts)`);
    }
    if (s.type !== 'pan') return;
    if (!to.colossus) { errors.push(`${script.id}: pan only on a colossus form`); return; }
    const [dx, dy] = s.from;
    if (limits && (dx < limits.dx[0] || dx > limits.dx[1] || dy < limits.dy[0] || dy > limits.dy[1])) {
      errors.push(`${script.id}: pan offset (${dx}, ${dy}) outside the border limits dx [${limits.dx.join(', ')}] dy [${limits.dy.join(', ')}] (B4)`);
    }
  });
  return errors;
}
