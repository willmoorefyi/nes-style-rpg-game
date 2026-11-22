/** Validator of a map's `ambient` list (LM-INT; types/ambient.ts). `validateMapData` calls it. */
import { ValidationError } from './schemaValidation.js';
import { AMBIENT_CELL_PX, AMBIENT_KINDS, FLAME_STYLES } from '../types/ambient.js';

const KEYS: Record<string, Set<string>> = {
  smoke: new Set(['kind', 'x', 'y', 'ox', 'oy']),
  flame: new Set(['kind', 'x', 'y', 'ox', 'oy', 'style', 'glow', 'foot', 'mask']),
};
const MASK_KEYS = new Set(['dx', 'dy', 'rows', 'tongue']);

function int(path: string, v: unknown, lo: number, hi: number): void {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < lo || v >= hi) {
    throw new ValidationError(`${path}: expected an integer in [${lo}, ${hi}), got ${String(v)}`);
  }
}

function object(path: string, v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ValidationError(`${path}: expected object`);
  return v as Record<string, unknown>;
}

/** AR-P2: a compiled flame's mask (ambient_flame.py): equal rows of '.' and '1'-'4', at least one lit pixel. */
function validateMask(path: string, v: unknown): void {
  const m = object(path, v);
  const extra = Object.keys(m).filter((k) => !MASK_KEYS.has(k));
  if (extra.length) throw new ValidationError(`${path}: unknown key ${extra.join(', ')}`);
  int(`${path}.dx`, m.dx, -96, 96);
  int(`${path}.dy`, m.dy, -96, 96);
  if (typeof m.tongue !== 'boolean') throw new ValidationError(`${path}.tongue: expected boolean`);
  const rows = m.rows;
  if (!Array.isArray(rows) || !rows.length || !rows.every((r) => typeof r === 'string' && /^[.1-4]+$/.test(r))
      || !rows.every((r) => r.length === (rows[0] as string).length) || !rows.join('').replace(/\./g, '').length) {
    throw new ValidationError(`${path}.rows: expected equal rows of '.' and '1'-'4' with a lit pixel`);
  }
}

export function validateAmbient(value: unknown, width: number, height: number): void {
  if (!Array.isArray(value)) throw new ValidationError('MapData.ambient: expected array');
  value.forEach((e: unknown, i) => {
    const path = `MapData.ambient[${i}]`;
    const o = object(path, e);
    if (!(AMBIENT_KINDS as readonly unknown[]).includes(o.kind)) {
      throw new ValidationError(`${path}.kind: expected one of ${AMBIENT_KINDS.join(', ')}, got ${String(o.kind)}`);
    }
    const extra = Object.keys(o).filter((k) => !KEYS[o.kind as string].has(k));
    if (extra.length) throw new ValidationError(`${path}: unknown key ${extra.join(', ')}`);
    int(`${path}.x`, o.x, 0, width);
    int(`${path}.y`, o.y, 0, height);
    if (o.ox !== undefined) int(`${path}.ox`, o.ox, 0, AMBIENT_CELL_PX);
    if (o.oy !== undefined) int(`${path}.oy`, o.oy, 0, AMBIENT_CELL_PX);
    if (o.kind !== 'flame') return;
    if (!(FLAME_STYLES as readonly unknown[]).includes(o.style)) {
      throw new ValidationError(`${path}.style: expected one of ${FLAME_STYLES.join(', ')}, got ${String(o.style)}`);
    }
    int(`${path}.glow`, o.glow, 8, 65);
    int(`${path}.foot`, o.foot, 0, height);
    if (o.mask !== undefined) validateMask(`${path}.mask`, o.mask);
  });
}
