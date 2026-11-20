/**
 * Validators for the pass W contract fields (docs/WORLD_PLAN.md 5.1 W1-0a; QUEST_PLAN 4.1): the map fields of
 * `types/quest.ts` (docks, patches, hazards, exit, world, requiredFlags, the new NPC and zone fields) and the
 * declared progression DAG, `assets/data/quest.yaml`. `validateMapData` calls `validateQuestMapFields`.
 */
import { ValidationError } from './schemaValidation.js';
import { FIELD_MODES, SPOT_KINDS, type QuestData } from '../types/index.js';

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

/** `MapData.world`: `frames` (optional since NW-1), the composer's `basins` (name -> cell) and `cuts` (name -> cells). */
function validateWorld(w: unknown): void {
  want('MapData.world', w, 'object');
  const world = w as Obj;
  if (world.frames !== undefined) {
    want('MapData.world.frames', world.frames, 'object');
    const a1 = (world.frames as Obj).a1;
    if (a1 !== undefined) {
      want('MapData.world.frames.a1', a1, 'object');
      cell('MapData.world.frames.a1.origin', (a1 as Obj).origin);
      cell('MapData.world.frames.a1.size', (a1 as Obj).size);
    }
  }
  if (world.basins !== undefined) {
    want('MapData.world.basins', world.basins, 'object');
    for (const [k, c] of Object.entries(world.basins as Obj)) cell(`MapData.world.basins.${k}`, c);
  }
  if (world.cuts !== undefined) {
    want('MapData.world.cuts', world.cuts, 'object');
    for (const [k, cs] of Object.entries(world.cuts as Obj)) {
      want(`MapData.world.cuts.${k}`, cs, 'array');
      (cs as unknown[]).forEach((c, i) => cell(`MapData.world.cuts.${k}[${i}]`, c));
    }
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
  if (m.world !== undefined) validateWorld(m.world);
  if (m.spots !== undefined) {
    want('MapData.spots', m.spots, 'object');
    for (const [name, s] of Object.entries(m.spots as Obj)) {
      want(`MapData.spots.${name}`, s, 'object');
      cell(`MapData.spots.${name}.at`, (s as Obj).at);
      if (!(SPOT_KINDS as readonly unknown[]).includes((s as Obj).kind)) {
        throw new ValidationError(`MapData.spots.${name}.kind: expected one of ${SPOT_KINDS.join(', ')}`);
      }
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

/** The world map's id: its places are named (spots, `ref`), never raw cells (NW-1, D-NW10). */
const WORLD_MAP = 'overworld';

/** A place `{map, at}` (a spot of the map) or `{map, x, y}`; on the world map only `at`. */
function place(path: string, o: Obj): void {
  want(`${path}.map`, o.map, 'string');
  if (o.at !== undefined) {
    want(`${path}.at`, o.at, 'string');
    if (o.x !== undefined || o.y !== undefined) throw new ValidationError(`${path}: at or x / y, not both`);
  } else if (o.map === WORLD_MAP) {
    throw new ValidationError(`${path}: a place on ${WORLD_MAP} is a spot (at: <name>), not x / y (NW-1)`);
  } else {
    want(`${path}.x`, o.x, 'number'); want(`${path}.y`, o.y, 'number');
  }
}

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
  if ((s.grind as number) < 1 || (s.grind as number) > 7) throw new ValidationError(`${p}.grind: expected 1.0-7.0`);
  want(`${p}.basins`, s.basins, 'object');
  for (const [name, c] of Object.entries(s.basins as Obj)) cell(`${p}.basins.${name}`, c);
  list(`${p}.nonLoadBearing`, s.nonLoadBearing, (q, n) => {
    for (const k of ['map', 'kind', 'reason']) want(`${q}.${k}`, n[k], 'string');
    if (n.map === WORLD_MAP) {
      if (n.at !== undefined) throw new ValidationError(`${q}.at: name the ${WORLD_MAP} element with ref (NW-1)`);
      want(`${q}.ref`, n.ref, 'string');
    } else {
      cell(`${q}.at`, n.at);
      opt(`${q}.ref`, n.ref, 'string');
    }
    for (const k of ['element', 'stage']) if (n[k] !== undefined) want(`${q}.${k}`, n[k], 'string');
    if (n.kind === 'quest' && n.element === undefined) throw new ValidationError(`${q}.element: required for kind quest`);
  });
  want(`${p}.nonLoadBearing`, s.nonLoadBearing, 'array');
  if (s.entry !== undefined) {
    want(`${p}.entry`, s.entry, 'object');
    const e = s.entry as Obj;
    place(`${p}.entry`, e);
    mode(`${p}.entry.mode`, e.mode);
    list(`${p}.entry.vehicles`, e.vehicles, (q, v) => { want(`${q}.type`, v.type, 'string'); place(q, v); });
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
