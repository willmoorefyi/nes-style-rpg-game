/**
 * Validators for pass F's battle data (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 8): the enemy attack fields (strict, like
 * the rest of EnemyData) and the effect / status-visual tables, whose bad entries are logged (`console.error`) and
 * dropped so one typo never blanks every effect.
 */
import {
  EFFECT_KINDS, STATUS_POSTURES, type EffectDef, type SpellEffectsData, type StatusVisual, type StatusVisualsData,
} from '../types/fxData.js';
import { ValidationError } from './schemaValidation.js';

const ATTACKS = ['melee', 'ranged'];
const ATTACK_ANIMS = ['heavy'];

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** EnemyData's `attack` (melee | ranged), `attackEffect` (string), `attackAnim` (heavy) and `pulseTint` ("#rrggbb", a
 *  heavy attacker only), all optional. */
export function validateEnemyAttack(data: Record<string, unknown>): void {
  const id = typeof data.id === 'string' ? data.id : '?';
  if (data.attack !== undefined && !ATTACKS.includes(data.attack as string)) {
    throw new ValidationError(`EnemyData(${id}).attack: expected melee or ranged, got ${String(data.attack)}`);
  }
  if (data.attackEffect !== undefined && typeof data.attackEffect !== 'string') {
    throw new ValidationError(`EnemyData(${id}).attackEffect: expected string, got ${typeof data.attackEffect}`);
  }
  if (data.attackAnim !== undefined && !ATTACK_ANIMS.includes(data.attackAnim as string)) {
    throw new ValidationError(`EnemyData(${id}).attackAnim: expected heavy, got ${String(data.attackAnim)}`);
  }
  if (data.pulseTint !== undefined) {
    if (typeof data.pulseTint !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(data.pulseTint)) {
      throw new ValidationError(`EnemyData(${id}).pulseTint: expected a "#rrggbb" colour, got ${String(data.pulseTint)}`);
    }
    if (data.attackAnim !== 'heavy') throw new ValidationError(`EnemyData(${id}).pulseTint: only a heavy attacker (attackAnim: heavy) pulses`);
  }
}

/** The reason an effect entry is unusable, or null. */
function effectProblem(e: unknown): string | null {
  if (!isObject(e)) return 'not an object';
  if (!(EFFECT_KINDS as readonly unknown[]).includes(e.kind)) return `unknown kind ${String(e.kind)}`;
  if (typeof e.frames !== 'number' || !Number.isInteger(e.frames) || e.frames <= 0) return 'frames must be a positive integer';
  if (typeof e.impact !== 'number' || !Number.isInteger(e.impact) || e.impact < 0 || e.impact >= e.frames) {
    return 'impact must be an integer with 0 <= impact < frames';
  }
  for (const key of ['glyph', 'ramp'] as const) if (e[key] !== undefined && typeof e[key] !== 'string') return `${key} must be a string`;
  if (e.count !== undefined && (typeof e.count !== 'number' || e.count < 0)) return 'count must be a number >= 0';
  return null;
}

/** An id -> effect id table, keeping only entries that name a defined effect. */
function refTable(path: string, value: unknown, effects: Record<string, EffectDef>): Record<string, string> {
  const out: Record<string, string> = {};
  if (value === undefined || value === null) return out;
  if (!isObject(value)) {
    console.error(`${path}: expected a table of effect ids; ignored`);
    return out;
  }
  for (const [id, ref] of Object.entries(value)) {
    if (typeof ref === 'string' && effects[ref]) out[id] = ref;
    else console.error(`${path}.${id}: unknown effect ${String(ref)}; dropped`);
  }
  return out;
}

/** assets/data/spell-effects.yaml: `effects`, `spells`, `items`, `attacks` (and optional `byEffect`). */
export function validateSpellEffects(data: unknown, path = 'spell-effects.yaml'): SpellEffectsData {
  const root = isObject(data) ? data : {};
  if (!isObject(data)) console.error(`${path}: expected a mapping; no effects loaded`);
  const effects: Record<string, EffectDef> = {};
  for (const [id, e] of Object.entries(isObject(root.effects) ? root.effects : {})) {
    const problem = effectProblem(e);
    if (problem) console.error(`${path} effects.${id}: ${problem}; dropped`);
    else effects[id] = e as unknown as EffectDef;
  }
  const result: SpellEffectsData = {
    effects,
    spells: refTable(`${path} spells`, root.spells, effects),
    items: refTable(`${path} items`, root.items, effects),
    attacks: refTable(`${path} attacks`, root.attacks, effects),
  };
  if (root.byEffect !== undefined) result.byEffect = refTable(`${path} byEffect`, root.byEffect, effects);
  return result;
}

/** The reason a status-visual entry is unusable, or null (unknown keys are kept for later tranches). */
function visualProblem(v: unknown): string | null {
  if (!isObject(v)) return 'not an object';
  if (v.posture !== undefined && !(STATUS_POSTURES as readonly unknown[]).includes(v.posture)) return `unknown posture ${String(v.posture)}`;
  for (const key of ['overlay', 'icon', 'tag'] as const) if (v[key] !== undefined && typeof v[key] !== 'string') return `${key} must be a string`;
  const p = v.pulse;
  if (p !== undefined && !(Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n > 0) && p[0] < p[1])) {
    return 'pulse must be [on, period] with 0 < on < period';
  }
  if (v.tint !== undefined && (typeof v.tint !== 'number' || v.tint < 0 || v.tint > 0xffffff)) return 'tint must be 0x000000-0xffffff';
  for (const key of ['reserved', 'party'] as const) if (v[key] !== undefined && typeof v[key] !== 'boolean') return `${key} must be true or false`;
  return null;
}

/** assets/data/status-visuals.yaml: `statuses` by status name. */
export function validateStatusVisuals(data: unknown, path = 'status-visuals.yaml'): StatusVisualsData {
  if (!isObject(data)) console.error(`${path}: expected a mapping; no status visuals loaded`);
  const raw = isObject(data) && isObject(data.statuses) ? data.statuses : {};
  const statuses: Record<string, StatusVisual> = {};
  for (const [id, v] of Object.entries(raw)) {
    const problem = visualProblem(v);
    if (problem) console.error(`${path} statuses.${id}: ${problem}; dropped`);
    else statuses[id] = v as StatusVisual;
  }
  return { statuses };
}
