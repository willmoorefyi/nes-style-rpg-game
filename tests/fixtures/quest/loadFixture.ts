/**
 * Tiny synthetic worlds for the progression verifier (docs/QUEST_PLAN.md 4.5, docs/WORLD_PLAN.md 5.2 W1-H). A fixture
 * is one YAML file: `quest` (stages need only `id`; the other fields get defaults), `maps` (a `grid` of characters
 * instead of `collision`), `cutscenes`, `items`, `start` and `worldMap`. A RED fixture names its base with
 * `extends:` and overrides it: `maps` and `quest.stages` merge by `id` (`remove: true` drops one), other keys
 * replace.
 *
 * Grid legend: `.` grass, `#` wall, `~` water, `^` mountain, `r` river, `_` road, `=` bridge, `C` counter.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { buildQuestWorld, type QuestWorld, type QuestWorldInput } from '../../../src/progression/questData.js';
import type { MapData } from '../../../src/types/index.js';

const DIR = 'tests/fixtures/quest';

const LEGEND: Record<string, number> = { '.': 0, '#': 1, '~': 2, '^': 3, r: 7, _: 8, '=': 9, C: 10 };

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Arrays of `{id}` objects merge by id; objects merge by key; anything else replaces. */
function mergeById(base: Obj[], over: Obj[]): Obj[] {
  const out = base.map((b) => ({ ...b }));
  for (const o of over) {
    const i = out.findIndex((b) => b.id === o.id);
    if (o.remove === true) {
      if (i >= 0) out.splice(i, 1);
    } else if (i >= 0) out[i] = { ...out[i], ...o };
    else out.push(o);
  }
  return out;
}

function merge(base: Obj, over: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (k === 'extends') continue;
    const b = out[k];
    if ((k === 'maps' || k === 'stages') && Array.isArray(b) && Array.isArray(v)) out[k] = mergeById(b as Obj[], v as Obj[]);
    else if (isObj(b) && isObj(v) && k === 'quest') out[k] = merge(b, v);
    else out[k] = v;
  }
  return out;
}

function readFixture(name: string): Obj {
  const raw = parse(readFileSync(join(DIR, `${name}.yaml`), 'utf-8')) as Obj;
  return typeof raw.extends === 'string' ? merge(readFixture(raw.extends), raw) : raw;
}

function toMap(m: Obj): MapData {
  const grid = (m.grid as string[] | undefined) ?? [];
  const width = grid[0]?.length ?? 0;
  const collision = grid.flatMap((row) => [...row].map((c) => {
    const t = LEGEND[c];
    if (t === undefined) throw new Error(`fixture map ${String(m.id)}: unknown grid character ${c}`);
    return t;
  }));
  const npcs = ((m.npcs as Obj[] | undefined) ?? []).map((n) => ({ sprite: 'villager', dialog: ['...'], ...n }));
  const rest = { ...m };
  delete rest.grid;
  return {
    layers: [], tilesets: [], transitions: [], width, height: grid.length, collision, ...rest, npcs,
  } as unknown as MapData;
}

function toStage(s: Obj): Obj {
  const needs = (v: unknown): Obj => ({ flags: [], items: [], vehicles: [], ...(isObj(v) ? v : {}) });
  return {
    title: String(s.id), tranche: 'T', after: [], boss: [], band: null, kit: null, maps: [], zones: [], grind: 1,
    walk: [], basins: {}, nonLoadBearing: [], status: 'pending', ...s, requires: needs(s.requires), grants: needs(s.grants),
  };
}

/** The fixture's raw input (merged with its base, defaults filled). */
export function fixtureInput(name: string): QuestWorldInput {
  const f = readFixture(name);
  const quest = f.quest as Obj;
  return {
    quest: { towns: [], ...quest, stages: ((quest.stages as Obj[]) ?? []).map(toStage) },
    maps: ((f.maps as Obj[]) ?? []).map(toMap),
    cutscenes: (f.cutscenes as QuestWorldInput['cutscenes']) ?? [],
    items: (f.items as QuestWorldInput['items']) ?? [],
    start: f.start as QuestWorldInput['start'],
    worldMap: f.worldMap as string | undefined,
  };
}

export function loadFixture(name: string): QuestWorld {
  return buildQuestWorld(fixtureInput(name));
}
