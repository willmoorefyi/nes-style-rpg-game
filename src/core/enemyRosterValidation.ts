/**
 * Validators for the roster fields of EnemyData (docs/ROSTER_PLAN.md 7.2, FW-D): strict like the rest of the enemy
 * schema (a bad value throws). Cross-file rules (an `ai` spell exists, `num` is unique, a rematch's first battle and
 * sprite) are checked by tests/data/crossFileValidation.test.ts and rosterStats.test.ts.
 */
import { ATTACK_STATUSES, PROTECT_CATEGORIES } from '../types/enemyRoster.js';
import { ValidationError } from './schemaValidation.js';

/** The spec has 128 records (001-128). */
export const MAX_ENEMY_NUM = 128;

const kind = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function fail(id: string, key: string, what: string, got: unknown): never {
  throw new ValidationError(`EnemyData(${id}).${key}: expected ${what}, got ${typeof got === 'object' ? kind(got) : String(got)}`);
}

/** A list whose every entry is one of `allowed` (no duplicates). */
function oneOfList(id: string, key: string, value: unknown, allowed: readonly string[]): void {
  if (!Array.isArray(value)) fail(id, key, `a list of ${allowed.join(' | ')}`, value);
  value.forEach((v, i) => {
    if (!allowed.includes(v as string)) fail(id, `${key}[${i}]`, allowed.join(' | '), v);
  });
  if (new Set(value).size !== value.length) fail(id, key, 'no duplicates', value.join(', '));
}

/** A use rate: a number in [0, 1]. */
function rate(id: string, key: string, value: unknown): void {
  if (typeof value !== 'number' || !(value >= 0 && value <= 1)) fail(id, key, 'a rate from 0 to 1', value);
}

function validateAi(id: string, value: unknown): void {
  if (kind(value) !== 'object') fail(id, 'ai', 'an object {rate, actions}', value);
  const ai = value as Record<string, unknown>;
  const extra = Object.keys(ai).filter((k) => k !== 'rate' && k !== 'actions');
  if (extra.length) fail(id, 'ai', 'only rate and actions', extra.join(', '));
  rate(id, 'ai.rate', ai.rate);
  if (!Array.isArray(ai.actions) || ai.actions.length === 0) fail(id, 'ai.actions', 'a non-empty list', ai.actions);
  ai.actions.forEach((a: unknown, i: number) => {
    const p = `ai.actions[${i}]`;
    if (kind(a) !== 'object') fail(id, p, 'an object', a);
    const act = a as Record<string, unknown>;
    if (act.type !== 'magic') fail(id, `${p}.type`, 'magic', act.type);
    if (typeof act.spellId !== 'string' || act.spellId === '') fail(id, `${p}.spellId`, 'a spell id', act.spellId);
    if (typeof act.weight !== 'number' || !(act.weight > 0)) fail(id, `${p}.weight`, 'a number above 0', act.weight);
  });
}

function validateSpecials(id: string, value: unknown): void {
  if (!Array.isArray(value)) fail(id, 'specials', 'a list', value);
  value.forEach((s: unknown, i: number) => {
    if (kind(s) !== 'object') fail(id, `specials[${i}]`, 'an object {id, rate}', s);
    const sp = s as Record<string, unknown>;
    if (typeof sp.id !== 'string' || sp.id === '') fail(id, `specials[${i}].id`, 'a string', sp.id);
    rate(id, `specials[${i}].rate`, sp.rate);
  });
}

/** `num`, `tuned`, `rematchOf`, `description`, `protect`, `statusWeak`, `attackStatus`, `spells`, `ai`, `specials`. */
export function validateEnemyRoster(data: Record<string, unknown>): void {
  const id = typeof data.id === 'string' ? data.id : '?';
  const num = data.num;
  if (num !== undefined && !(typeof num === 'number' && Number.isInteger(num) && num >= 1 && num <= MAX_ENEMY_NUM)) {
    fail(id, 'num', `an integer from 1 to ${MAX_ENEMY_NUM}`, num);
  }
  if (data.tuned !== undefined && typeof data.tuned !== 'boolean') fail(id, 'tuned', 'true or false', data.tuned);
  if (data.rematchOf !== undefined) {
    if (typeof data.rematchOf !== 'string') fail(id, 'rematchOf', 'an enemy id', data.rematchOf);
    if (typeof data.name !== 'string' || !data.name.endsWith(' II')) fail(id, 'name', 'a rematch name ending in " II"', data.name);
  }
  if (data.description !== undefined) {
    if (typeof data.description !== 'string' || !/^[\x20-\x7e]+$/.test(data.description)) {
      fail(id, 'description', 'printable ASCII text (the NES font)', data.description);
    }
  }
  if (data.protect !== undefined) oneOfList(id, 'protect', data.protect, PROTECT_CATEGORIES);
  if (data.statusWeak !== undefined) oneOfList(id, 'statusWeak', data.statusWeak, PROTECT_CATEGORIES);
  if (data.attackStatus !== undefined) oneOfList(id, 'attackStatus', data.attackStatus, ATTACK_STATUSES);
  if (data.spells !== undefined) {
    if (!Array.isArray(data.spells)) fail(id, 'spells', 'a list of spell codes', data.spells);
    data.spells.forEach((s: unknown, i: number) => {
      if (typeof s !== 'string' || !/^[a-z0-9]+$/.test(s)) fail(id, `spells[${i}]`, 'a lowercase spell code', s);
    });
  }
  if (data.ai !== undefined) validateAi(id, data.ai);
  if (data.specials !== undefined) validateSpecials(id, data.specials);
}
