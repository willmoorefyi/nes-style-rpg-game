/**
 * A quest fixture written out in the repository's layout (docs/TEST_SPEED_PLAN.md 8), so `loadQuestWorld` and
 * `loadLateData` read it through the input recorder (src/progression/questInputs.ts): the fixture's maps as
 * `assets/maps/ai/<id>.yaml` with an `index.yaml`, its quest, cutscenes and items in `assets/data/`, the mini late data
 * as `enemies.yaml`, `kits.yaml`, `spells.yaml` and an empty `world-anchors.yaml`, plus one legacy
 * `assets/maps/legacy-room.yaml` linked from a compiled map and one linked legacy map with no file
 * (`legacy-missing`, the probe case). Its verdicts may differ from `miniContext()`'s (the travel rows are the
 * defaults here); tests on it assert fingerprints and hit == miss, never verdicts.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { QuestStart } from '../../src/progression/questData.js';
import type { MapData } from '../../src/types/index.js';
import { fixtureInput } from '../fixtures/quest/loadFixture.js';
import { MINI_LATE } from '../progression/miniWorld.js';

export interface RepoFixture {
  root: string;
  start: QuestStart;
  worldMap: string;
  /** Repository-relative paths of every file written. */
  files: string[];
  /** The compiled map that links the two legacy maps. */
  linkMap: string;
}

export const LEGACY_ROOM = 'legacy-room';
export const LEGACY_MISSING = 'legacy-missing';

function legacyRoom(): MapData {
  return {
    id: LEGACY_ROOM, name: 'Legacy room', width: 3, height: 3, layers: [], tilesets: [], collision: [1, 1, 1, 1, 0, 1, 1, 1, 1],
    npcs: [], transitions: [],
  } as unknown as MapData;
}

export function writeRepoFixture(dir: string, name = 'mini'): RepoFixture {
  const input = fixtureInput(name);
  const files: string[] = [];
  const put = (rel: string, v: unknown): void => {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), stringify(v));
    files.push(rel);
  };
  const maps = input.maps.map((m) => ({ ...m }));
  const link = maps[maps.length - 1];
  // two links on a wall cell (0, 0): never walked, but the loader follows them to the legacy folder
  link.transitions = [...link.transitions,
    { x: 0, y: 0, targetMap: LEGACY_ROOM, targetX: 1, targetY: 1 },
    { x: 0, y: 0, targetMap: LEGACY_MISSING, targetX: 1, targetY: 1 },
  ] as MapData['transitions'];
  for (const m of maps) put(`assets/maps/ai/${m.id}.yaml`, m);
  put('assets/maps/ai/index.yaml', maps.map((m) => m.id));
  put(`assets/maps/${LEGACY_ROOM}.yaml`, legacyRoom());
  put('assets/data/quest.yaml', input.quest);
  put('assets/data/cutscenes.yaml', input.cutscenes);
  put('assets/data/items.yaml', [...input.items, ...(MINI_LATE.items ?? [])]);
  put('assets/data/enemies.yaml', MINI_LATE.enemies ?? []);
  put('assets/data/kits.yaml', MINI_LATE.kits ?? {});
  put('assets/data/spells.yaml', []);
  put('assets/data/world-anchors.yaml', null); // no anchors: the fixture has no geography (proof (g) has nothing)
  if (!input.start) throw new Error(`fixture ${name}: no start`);
  return { root: dir, start: input.start, worldMap: input.worldMap ?? 'overworld', files, linkMap: link.id };
}
