/** Validator of a map's `ambient` list (LM-INT; types/ambient.ts). `validateMapData` calls it. */
import { ValidationError } from './schemaValidation.js';
import { AMBIENT_CELL_PX, AMBIENT_KINDS } from '../types/ambient.js';

const KEYS = new Set(['kind', 'x', 'y', 'ox', 'oy']);

function int(path: string, v: unknown, lo: number, hi: number): void {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < lo || v >= hi) {
    throw new ValidationError(`${path}: expected an integer in [${lo}, ${hi}), got ${String(v)}`);
  }
}

export function validateAmbient(value: unknown, width: number, height: number): void {
  if (!Array.isArray(value)) throw new ValidationError('MapData.ambient: expected array');
  value.forEach((e: unknown, i) => {
    const path = `MapData.ambient[${i}]`;
    if (typeof e !== 'object' || e === null || Array.isArray(e)) throw new ValidationError(`${path}: expected object`);
    const o = e as Record<string, unknown>;
    const extra = Object.keys(o).filter((k) => !KEYS.has(k));
    if (extra.length) throw new ValidationError(`${path}: unknown key ${extra.join(', ')}`);
    if (!(AMBIENT_KINDS as readonly unknown[]).includes(o.kind)) {
      throw new ValidationError(`${path}.kind: expected one of ${AMBIENT_KINDS.join(', ')}, got ${String(o.kind)}`);
    }
    int(`${path}.x`, o.x, 0, width);
    int(`${path}.y`, o.y, 0, height);
    if (o.ox !== undefined) int(`${path}.ox`, o.ox, 0, AMBIENT_CELL_PX);
    if (o.oy !== undefined) int(`${path}.oy`, o.oy, 0, AMBIENT_CELL_PX);
  });
}
