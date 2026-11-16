import type { EnemyData } from '../types/index.js';
import { ValidationError } from '../core/schemaValidation.js';

/**
 * The transformation interlude scripts (assets/data/battle-interludes.yaml; docs/CHAOS_FORMS_PLAN.md 2.3): the step
 * types, the validator a registry runs per script (a bad script throws `ValidationError`), the unskipped time (R18, A1)
 * and the per-form-pair rules (R13, R19, A2). Pure: no PixiJS. The player (`formInterlude.ts`) and the registry
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
/** The pan start rule (A2): dy in [-70, 0] art px, dx <= 0. */
export const PAN_START_DY: readonly [number, number] = [-70, 0];

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
/** The allowed pan offsets in art px (R13): the canvas still covers the field at every offset. */
export interface PanLimits { dx: [number, number]; dy: [number, number] }

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
 * The pan limits that keep the field covered (R13): the canvas placed at `place` (screen px, its top-left), `size`
 * screen px, `scale` screen px per art px. Sideways and above, a 6 px shake margin stays covered; below, the bottom
 * strip covers y >= 780. For the planned F3 ((-390, -300), 2700 x 1560, scale 3): dx [-128, 128], dy [-160, 138].
 */
export function panLimits(place: { x: number; y: number }, size: { w: number; h: number }, scale: number,
  field = { w: 1920, top: 120, bottom: 780 }, margin = 6): PanLimits {
  return {
    dx: [Math.ceil((field.w + margin - (place.x + size.w)) / scale), Math.floor((-margin - place.x) / scale)],
    dy: [Math.ceil((field.bottom - (place.y + size.h)) / scale), Math.floor((field.top - margin - place.y) / scale)],
  };
}

const artOf = (e: EnemyData): string => e.colossus ?? e.sprite;

/**
 * The rules for the script that plays when `from` changes into `to` (R19, R13, A2): exactly one `swap` when the art id
 * changes and none when it does not (F3 -> F4); `rise` only after the swap and only into a colossus; `variant` and
 * `pan` only on a colossus form, each pan inside `limits` (when known) and the start rule.
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
    if (s.type !== 'pan') return;
    if (!to.colossus) { errors.push(`${script.id}: pan only on a colossus form`); return; }
    const [dx, dy] = s.from;
    if (dx > 0) errors.push(`${script.id}: pan start dx ${dx} must be <= 0 (A2)`);
    if (dy < PAN_START_DY[0] || dy > PAN_START_DY[1]) errors.push(`${script.id}: pan start dy ${dy} outside [${PAN_START_DY.join(', ')}] (A2)`);
    if (limits && (dx < limits.dx[0] || dx > limits.dx[1] || dy < limits.dy[0] || dy > limits.dy[1])) {
      errors.push(`${script.id}: pan offset (${dx}, ${dy}) outside the coverage limits dx [${limits.dx.join(', ')}] dy [${limits.dy.join(', ')}] (R13)`);
    }
  });
  return errors;
}
