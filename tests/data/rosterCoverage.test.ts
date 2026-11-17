/**
 * Roster coverage (docs/WORLD_PLAN.md 3.2 "Roster coverage", QUEST_PLAN 4.4; W1-F): every enemy without `formOf`
 * appears in some stage's roster. A stage's roster is its bosses, the tables of its `zones` (`<map>:<zone id>`) and
 * every table (main, zones, scripted) of the compiled maps its `maps` globs match. Until the regions are built this
 * only reports what is missing; with `QUEST_STRICT=1` (INT) a missing enemy fails.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { EncounterEntry, EnemyData, MapData } from '../../src/types/index.js';
import type { QuestData, QuestStage } from '../../src/types/quest.js';

const read = <T>(f: string): T => parse(readFileSync(f, 'utf-8')) as T;
const quest = read<QuestData>('assets/data/quest.yaml');
const enemies = read<EnemyData[]>('assets/data/enemies.yaml');
const compiled = read<string[]>('assets/maps/ai/index.yaml');
const STRICT = process.env.QUEST_STRICT === '1';

const cache = new Map<string, MapData | null>();
const mapOf = (id: string): MapData | null => {
  if (!cache.has(id)) {
    const f = `assets/maps/ai/${id}.yaml`;
    cache.set(id, existsSync(f) ? read<MapData>(f) : null);
  }
  return cache.get(id) ?? null;
};
const globRe = (g: string): RegExp => new RegExp(`^${g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
const idsOf = (table: readonly EncounterEntry[] | undefined): string[] =>
  (table ?? []).flatMap((e) => [...(e.groups ?? []).map((g) => g.id), ...(e.enemies ?? [])]);

/** The enemy ids of one stage's roster (see the header). */
function rosterOf(stage: QuestStage): Set<string> {
  const out = new Set<string>(stage.boss);
  for (const z of stage.zones) {
    const [mapId, zoneId] = z.split(':');
    for (const id of idsOf(mapOf(mapId)?.encounterZones?.find((x) => x.id === zoneId)?.encounters)) out.add(id);
  }
  const globs = stage.maps.map(globRe);
  for (const mapId of compiled.filter((id) => globs.some((g) => g.test(id)))) {
    const m = mapOf(mapId);
    if (!m) continue;
    for (const id of idsOf(m.encounters)) out.add(id);
    for (const z of m.encounterZones ?? []) for (const id of idsOf(z.encounters)) out.add(id);
    for (const s of m.scriptedEncounters ?? []) for (const id of s.enemyIds) out.add(id);
  }
  return out;
}

describe('roster coverage (WORLD_PLAN 3.2)', () => {
  const covered = new Set(quest.stages.flatMap((s) => [...rosterOf(s)]));
  const missing = enemies.filter((e) => !e.formOf && !covered.has(e.id)).map((e) => e.id);

  it('S0 (act 1, built) covers its roster: garland and the temple and approach enemies', () => {
    const s0 = rosterOf(quest.stages.find((s) => s.id === 'S0')!);
    for (const id of ['garland', 'gr_imp', 'wolf', 'gr_wolf', 'skeleton']) expect(s0.has(id), id).toBe(true);
  });

  it('every roster id is an enemy', () => {
    const ids = new Set(enemies.map((e) => e.id));
    for (const id of covered) expect(ids.has(id), id).toBe(true);
  });

  it(`every enemy without formOf is in a stage roster (${STRICT ? 'QUEST_STRICT: fails' : 'reports only'})`, () => {
    if (missing.length > 0) {
      console.log(`rosterCoverage: ${missing.length} of ${enemies.filter((e) => !e.formOf).length} enemies in no stage roster: ${missing.join(', ')}`);
    }
    if (STRICT) expect(missing).toEqual([]);
  });
});
