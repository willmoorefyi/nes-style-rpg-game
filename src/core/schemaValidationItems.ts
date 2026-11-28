/**
 * Validator of items.yaml's records (moved out of schemaValidation.ts by pass EQ, docs/EQUIP_FF1_PLAN.md 8, which
 * re-exports `validateItemData`). Pass EQ adds the `hands` slot and the FF1 effect fields `bonusVsFamily`, `element`,
 * `battleSpell` and `resist`.
 */
import { ValidationError } from './schemaValidation.js';
import type { ItemData } from '../types/index.js';

function fail(path: string, expected: string, value: unknown): never {
  throw new ValidationError(`${path}: expected ${expected}, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
}
function assertString(path: string, v: unknown): asserts v is string { if (typeof v !== 'string') fail(path, 'string', v); }
function assertNumber(path: string, v: unknown): asserts v is number { if (typeof v !== 'number') fail(path, 'number', v); }
function assertArray(path: string, v: unknown): asserts v is unknown[] { if (!Array.isArray(v)) fail(path, 'array', v); }
function assertObject(path: string, v: unknown): asserts v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'object', v);
}

const VALID_ITEM_TYPES = ['weapon', 'armor', 'consumable', 'key'];
const VALID_SLOTS = ['weapon', 'armor', 'shield', 'helmet', 'hands'];

export function validateItemData(data: unknown): ItemData {
  assertObject('ItemData', data);
  assertString('ItemData.id', data.id);
  assertString('ItemData.name', data.name);
  assertString('ItemData.type', data.type);
  if (!VALID_ITEM_TYPES.includes(data.type as string)) {
    throw new ValidationError(`ItemData.type: expected one of ${VALID_ITEM_TYPES.join(', ')}, got ${data.type}`);
  }
  assertObject('ItemData.stats', data.stats);
  assertNumber('ItemData.price', data.price);
  assertArray('ItemData.usableBy', data.usableBy);
  (data.usableBy as unknown[]).forEach((e, i) => assertString(`ItemData.usableBy[${i}]`, e));
  for (const k of ['hit', 'crit', 'weight']) if (data[k] !== undefined) assertNumber(`ItemData.${k}`, data[k]);
  if (data.slot !== undefined && !VALID_SLOTS.includes(data.slot as string)) {
    throw new ValidationError(`ItemData.slot: expected one of ${VALID_SLOTS.join(', ')}, got ${data.slot}`);
  }
  if (data.description !== undefined) assertString('ItemData.description', data.description);
  if (data.prompt !== undefined) assertString('ItemData.prompt', data.prompt);
  if (data.plural !== undefined) assertString('ItemData.plural', data.plural);
  for (const k of ['bonusVsFamily', 'element', 'battleSpell'] as const) if (data[k] !== undefined) assertString(`ItemData.${k}`, data[k]);
  if (data.resist !== undefined) {
    assertArray('ItemData.resist', data.resist);
    (data.resist as unknown[]).forEach((e, i) => assertString(`ItemData.resist[${i}]`, e));
  }
  return data as unknown as ItemData;
}
