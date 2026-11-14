import { MAX_FORMATION } from '../systems/EncounterTable.js';
import { ValidationError } from './schemaValidation.js';

/** Map encounter data: `encounters` entries and `encounterZones` (docs/FIX_PLAN_PENINSULA.md, T4c). */

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function fail(path: string, message: string): never {
  throw new ValidationError(`${path}: ${message}`);
}

/** Each entry has a `weight` and exactly one of `enemies` (ids) or `groups` ({id, min, max?}, 0 <= min <= max <= 9). */
export function validateEncounterEntries(path: string, value: unknown): void {
  if (!Array.isArray(value)) fail(path, 'expected array');
  value.forEach((entry, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(entry)) fail(p, 'expected object');
    if (typeof entry.weight !== 'number' || entry.weight < 0) fail(`${p}.weight`, 'expected a number >= 0');
    const hasEnemies = entry.enemies !== undefined;
    const hasGroups = entry.groups !== undefined;
    if (hasEnemies === hasGroups) fail(p, 'give exactly one of enemies or groups');
    if (hasEnemies) {
      const enemies = entry.enemies;
      if (!Array.isArray(enemies) || enemies.some((id) => typeof id !== 'string')) {
        fail(`${p}.enemies`, 'expected an array of enemy ids');
      }
      return;
    }
    const groups = entry.groups;
    if (!Array.isArray(groups) || groups.length === 0) fail(`${p}.groups`, 'expected a non-empty array');
    groups.forEach((group, j) => validateGroup(`${p}.groups[${j}]`, group));
  });
}

function validateGroup(path: string, group: unknown): void {
  if (!isObject(group)) fail(path, 'expected object');
  if (typeof group.id !== 'string') fail(`${path}.id`, 'expected string');
  const { min } = group;
  const max = group.max ?? min;
  if (!isInt(min) || !isInt(max)) fail(path, 'min and max must be integers');
  if (min < 0 || min > max || max > MAX_FORMATION) {
    fail(path, `expected 0 <= min <= max <= ${MAX_FORMATION}, got min ${min}, max ${max}`);
  }
}

function validateRate(path: string, rate: unknown): void {
  if (!isObject(rate) || !isInt(rate.min) || !isInt(rate.max) || rate.min < 1 || rate.min > rate.max) {
    fail(path, 'expected {min, max} integers with 1 <= min <= max');
  }
}

/** Zones: an id, inclusive rects of 4 integers inside the map, an encounter list and an optional rate. */
export function validateEncounterZones(value: unknown, width: number, height: number): void {
  if (!Array.isArray(value)) fail('MapData.encounterZones', 'expected array');
  value.forEach((zone, i) => {
    const p = `MapData.encounterZones[${i}]`;
    if (!isObject(zone)) fail(p, 'expected object');
    if (typeof zone.id !== 'string' || zone.id === '') fail(`${p}.id`, 'expected a non-empty string');
    const rects = zone.rects;
    if (!Array.isArray(rects) || rects.length === 0) fail(`${p}.rects`, 'expected a non-empty array');
    rects.forEach((rect, j) => {
      const r = `${p}.rects[${j}]`;
      if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(isInt)) fail(r, 'expected [x0, y0, x1, y1] integers');
      const [x0, y0, x1, y1] = rect as number[];
      if (x0 < 0 || y0 < 0 || x1 >= width || y1 >= height || x0 > x1 || y0 > y1) {
        fail(r, `[${x0}, ${y0}, ${x1}, ${y1}] is not an inclusive rect inside the ${width}x${height} map`);
      }
    });
    validateEncounterEntries(`${p}.encounters`, zone.encounters);
    if (zone.encounterRate !== undefined) validateRate(`${p}.encounterRate`, zone.encounterRate);
  });
}
