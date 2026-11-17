/**
 * Validators for the pass W contract fields (docs/WORLD_PLAN.md 5.1 W1-0a; QUEST_PLAN 4.1): the map fields of
 * `types/quest.ts` (docks, patches, hazards, exit, world, requiredFlags, the new NPC and zone fields) and the
 * declared progression DAG, `assets/data/quest.yaml`. `validateMapData` calls `validateQuestMapFields`.
 */
import { ValidationError } from './schemaValidation.js';
import { FIELD_MODES, type QuestData } from '../types/index.js';

type Obj = Record<string, unknown>;

function kind(v: unknown): string {
  return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
}

function want(path: string, value: unknown, expected: string): void {
  if (kind(value) !== expected) throw new ValidationError(`${path}: expected ${expected}, got ${kind(value)}`);
}

function opt(path: string, value: unknown, expected: string): void {
  if (value !== undefined) want(path, value, expected);
}

function strings(path: string, value: unknown): void {
  want(path, value, 'array');
  (value as unknown[]).forEach((v, i) => want(`${path}[${i}]`, v, 'string'));
}

function optStrings(path: string, value: unknown): void {
  if (value !== undefined) strings(path, value);
}

function cell(path: string, value: unknown): void {
  want(path, value, 'array');
  const c = value as unknown[];
  if (c.length !== 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number') {
    throw new ValidationError(`${path}: expected [x, y]`);
  }
}

function list(path: string, value: unknown, each: (p: string, o: Obj) => void): void {
  if (value === undefined) return;
  want(path, value, 'array');
  (value as unknown[]).forEach((v, i) => {
    want(`${path}[${i}]`, v, 'object');
    each(`${path}[${i}]`, v as Obj);
  });
}

function mode(path: string, value: unknown): void {
  if (value !== undefined && !(FIELD_MODES as readonly unknown[]).includes(value)) {
    throw new ValidationError(`${path}: expected one of ${FIELD_MODES.join(', ')}, got ${String(value)}`);
  }
}

/** The pass W fields of a map (all optional; their owners implement them). */
export function validateQuestMapFields(m: Obj): void {
  list('MapData.docks', m.docks, (p, d) => {
    want(`${p}.id`, d.id, 'string'); want(`${p}.x`, d.x, 'number'); want(`${p}.y`, d.y, 'number');
    want(`${p}.basin`, d.basin, 'string');
  });
  list('MapData.patches', m.patches, (p, d) => {
    want(`${p}.id`, d.id, 'string'); want(`${p}.flag`, d.flag, 'string'); want(`${p}.terrain`, d.terrain, 'number');
    want(`${p}.cells`, d.cells, 'array');
    (d.cells as unknown[]).forEach((c, i) => cell(`${p}.cells[${i}]`, c));
  });
  list('MapData.hazards', m.hazards, (p, d) => {
    want(`${p}.id`, d.id, 'string'); want(`${p}.damage`, d.damage, 'number'); want(`${p}.rects`, d.rects, 'array');
  });
  if (m.exit !== undefined) {
    want('MapData.exit', m.exit, 'object');
    const e = m.exit as Obj;
    want('MapData.exit.map', e.map, 'string');
    want('MapData.exit.entrance', e.entrance, 'string');
  }
  if (m.world !== undefined) {
    want('MapData.world', m.world, 'object');
    want('MapData.world.frames', (m.world as Obj).frames, 'object');
    const a1 = ((m.world as Obj).frames as Obj).a1;
    if (a1 !== undefined) {
      want('MapData.world.frames.a1', a1, 'object');
      cell('MapData.world.frames.a1.origin', (a1 as Obj).origin);
      cell('MapData.world.frames.a1.size', (a1 as Obj).size);
    }
  }
  for (const key of ['keyItemGates', 'transitions', 'scriptedEncounters', 'vehicles'] as const) {
    list(`MapData.${key}`, m[key], (p, o) => optStrings(`${p}.requiredFlags`, o.requiredFlags));
  }
  list('MapData.npcs', m.npcs, (p, n) => {
    opt(`${p}.requiredItem`, n.requiredItem, 'string');
    opt(`${p}.takeItem`, n.takeItem, 'boolean');
    opt(`${p}.tint`, n.tint, 'string');
    opt(`${p}.actionFlag`, n.actionFlag, 'string');
    opt(`${p}.takeGold`, n.takeGold, 'number');
    opt(`${p}.clinicPrice`, n.clinicPrice, 'number');
    if (n.cutscene !== undefined) optStrings(`${p}.cutscene.requiredFlags`, (n.cutscene as Obj).requiredFlags);
  });
  list('MapData.encounterZones', m.encounterZones, (p, z) => {
    opt(`${p}.name`, z.name, 'string');
    if (z.modes !== undefined) {
      want(`${p}.modes`, z.modes, 'array');
      (z.modes as unknown[]).forEach((v, i) => mode(`${p}.modes[${i}]`, v));
    }
  });
}

const STAGE_ID = /^S\d+$/;

function needs(path: string, value: unknown): void {
  want(path, value, 'object');
  const n = value as Obj;
  for (const k of ['flags', 'items', 'vehicles']) strings(`${path}.${k}`, n[k]);
}

function validateStage(p: string, s: Obj): void {
  want(`${p}.id`, s.id, 'string');
  if (!STAGE_ID.test(s.id as string)) throw new ValidationError(`${p}.id: expected S<n>, got ${String(s.id)}`);
  for (const k of ['title', 'tranche', 'status']) want(`${p}.${k}`, s[k], 'string');
  if (s.status !== 'pending' && s.status !== 'built') throw new ValidationError(`${p}.status: pending or built`);
  for (const k of ['after', 'boss', 'maps', 'zones', 'walk']) strings(`${p}.${k}`, s[k]);
  needs(`${p}.requires`, s.requires);
  needs(`${p}.grants`, s.grants);
  if (s.band !== null) {
    cell(`${p}.band`, s.band);
    const [lo, hi] = s.band as number[];
    if (lo > hi) throw new ValidationError(`${p}.band: low above high`);
  }
  if (s.kit !== null) want(`${p}.kit`, s.kit, 'string');
  want(`${p}.grind`, s.grind, 'number');
  if ((s.grind as number) < 1 || (s.grind as number) > 3) throw new ValidationError(`${p}.grind: expected 1.0-3.0`);
  want(`${p}.basins`, s.basins, 'object');
  for (const [name, c] of Object.entries(s.basins as Obj)) cell(`${p}.basins.${name}`, c);
  list(`${p}.nonLoadBearing`, s.nonLoadBearing, (q, n) => {
    for (const k of ['map', 'kind', 'reason']) want(`${q}.${k}`, n[k], 'string');
    cell(`${q}.at`, n.at);
  });
  want(`${p}.nonLoadBearing`, s.nonLoadBearing, 'array');
  if (s.entry !== undefined) {
    want(`${p}.entry`, s.entry, 'object');
    const e = s.entry as Obj;
    want(`${p}.entry.map`, e.map, 'string'); want(`${p}.entry.x`, e.x, 'number'); want(`${p}.entry.y`, e.y, 'number');
    mode(`${p}.entry.mode`, e.mode);
  }
  opt(`${p}.optional`, s.optional, 'boolean');
  optStrings(`${p}.milestones`, s.milestones);
  for (const f of (s.milestones as string[] | undefined) ?? []) {
    if (!(s.grants as { flags: string[] }).flags.includes(f)) throw new ValidationError(`${p}.milestones: ${f} is not granted`);
  }
}

/** `assets/data/quest.yaml`: the goal, the stages (ids unique, `after` known, no cycle) and the shop towns. */
export function validateQuestData(data: unknown): QuestData {
  want('quest', data, 'object');
  const q = data as Obj;
  want('quest.goal', q.goal, 'string');
  list('quest.stages', q.stages, validateStage);
  want('quest.stages', q.stages, 'array');
  const stages = q.stages as Obj[];
  const ids = new Set<string>();
  for (const s of stages) {
    if (ids.has(s.id as string)) throw new ValidationError(`quest.stages: duplicate id ${String(s.id)}`);
    ids.add(s.id as string);
  }
  const after = new Map(stages.map((s) => [s.id as string, s.after as string[]]));
  for (const [id, deps] of after) {
    for (const d of deps) if (!ids.has(d)) throw new ValidationError(`quest.stages ${id}: after names unknown ${d}`);
  }
  const done = new Set<string>();
  const visit = (id: string, path: string[]): void => {
    if (done.has(id)) return;
    if (path.includes(id)) throw new ValidationError(`quest.stages: cycle ${[...path, id].join(' -> ')}`);
    for (const d of after.get(id) ?? []) visit(d, [...path, id]);
    done.add(id);
  };
  for (const id of ids) visit(id, []);
  list('quest.towns', q.towns, (p, t) => {
    for (const k of ['id', 'owner', 'bandStage', 'kit', 'status']) want(`${p}.${k}`, t[k], 'string');
    strings(`${p}.maps`, t.maps);
    strings(`${p}.opensAfter`, t.opensAfter);
    for (const s of [...(t.opensAfter as string[]), t.bandStage as string]) {
      if (!ids.has(s)) throw new ValidationError(`${p}: unknown stage ${s}`);
    }
  });
  want('quest.towns', q.towns, 'array');
  return data as QuestData;
}
