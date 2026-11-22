/**
 * Originality (docs/QUEST_PLAN.md 4.6 items 2-3, docs/WORLD_PLAN.md 4.0.4): the topology self-check computed from the
 * compiled maps, per tranche (at least half of its dungeons not a simple chain; 2+ dead-end branches on each floor
 * of 24x24 or more; no two boss floors sharing octant and path length; no two floors of a dungeon of the same shape
 * within 5 %; no two equal ground grids, mirrored or transposed; the design note's `Topology:` line matching the
 * stair graph), and the phrase test over the dialogue of every built region map and new cutscene. The numbers are
 * printed per dungeon; stubs are pending (failures with QUEST_STRICT=1). The act-1 maps are exempt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../src/types/index.js';
import {
  bossPosition, classicHits, deadEnds, equalGrounds, floorOf, floorShape, stairGraph, topologyLine, within,
} from './originalityChecks.js';
import { canonRows, compiledMap, designNote, isBuilt, mapLines, passWCutsceneIds, sourceText, STRICT } from './questMaps.js';

const LEGEND: Record<string, number> = { '.': 0, '#': 1, '~': 2 };

function grid(id: string, rows: string[], extra: Partial<MapData> = {}): MapData {
  return { id, width: rows[0].length, height: rows.length, collision: rows.flatMap((r) => [...r].map((c) => LEGEND[c])),
    layers: [], tilesets: [], transitions: [], npcs: [], ...extra } as MapData;
}

const ROOM = ['#######', '#.....#', '#.....#', '#.....#', '#######'];
const t = (x: number, y: number, targetMap: string) => ({ x, y, targetMap, targetX: 1, targetY: 1 });

describe('originality: the topology numbers', () => {
  it('stair graph: a simple chain, a fork, a one-way pit', () => {
    const chain = [grid('d-b1', ROOM, { transitions: [t(5, 1, 'd-b2')] }), grid('d-b2', ROOM, { transitions: [t(1, 1, 'd-b1'), t(5, 1, 'd-b3')] }),
      grid('d-b3', ROOM, { transitions: [t(1, 1, 'd-b2')] })];
    expect(stairGraph(chain).branching).toBe(false);
    const pit = chain.map((f) => (f.id === 'd-b3' ? { ...f, transitions: [] } : f));
    expect(stairGraph(pit).branching).toBe(true);
    const fork = chain.map((f) => (f.id === 'd-b1' ? { ...f, transitions: [t(5, 1, 'd-b2'), t(5, 3, 'd-b3')] } : f))
      .map((f) => (f.id === 'd-b3' ? { ...f, transitions: [t(1, 1, 'd-b2'), t(1, 3, 'd-b1')] } : f));
    expect(stairGraph(fork).branching).toBe(true);
    expect(floorOf('marsh-cave-b2')).toEqual({ dungeon: 'marsh-cave', label: 'B2' });
    expect(floorOf('mirage-3f')).toEqual({ dungeon: 'mirage', label: '3F' });
  });

  it('dead ends, the boss position, the floor shape', () => {
    const comb = grid('c', ['#########', '#.......#', '#.#.#.#.#', '#########'], { entrances: { arrival: [1, 1] } });
    expect(deadEnds(comb)).toBe(4);
    const boss = grid('b', ROOM, { entrances: { arrival: [1, 3] },
      scriptedEncounters: [{ x: 5, y: 1, enemyIds: ['lich'], flag: 'X', isBoss: true }] });
    expect(bossPosition(boss)).toEqual({ octant: 'NE', path: 6 });
    expect(floorShape(grid('s', ROOM))).toEqual({ aspect: 5 / 3, fill: 1 });
    expect(within(1.0, 1.04)).toBe(true);
    expect(within(1.0, 1.06)).toBe(false);
  });

  it('RED: equal grounds, also mirrored or transposed', () => {
    const a = grid('a', ['####', '#..#', '#.##', '####']);
    const mirror = grid('m', ['####', '#..#', '##.#', '####']);
    const tr = grid('t', ['####', '#..#', '#.##', '####']);
    expect(equalGrounds([a, mirror])).toEqual(['a = m']);
    expect(equalGrounds([a, tr])).toEqual(['a = t']);
    expect(equalGrounds([a, grid('o', ['####', '#..#', '#..#', '####'])])).toEqual([]);
  });

  it('the Topology line names the floors and the boss floor', () => {
    expect(topologyLine('B1 -> B2 (2 stairs) -> B3 boss, one-way pit B2 -> B1')).toEqual({ floors: ['B1', 'B2', 'B3'], boss: 'B3' });
    expect(topologyLine('1F -> 2F -> 3F boss')).toEqual({ floors: ['1F', '2F', '3F'], boss: '3F' });
    expect(topologyLine('floor 1 boss -> floor 2 -> the shrine')).toEqual({ floors: ['1', '2'], boss: '1' });
  });
});

describe('originality: the phrase test', () => {
  it('RED: a famous classic line in new dialogue', () => {
    expect(classicHits(['When the world is veiled in darkness, four warriors will come.'])).toEqual([
      '"the world is veiled in darkness" in "When the world is veiled in darkness, four warriors will come."',
      '"four warriors will come" in "When the world is veiled in darkness, four warriors will come."']);
    expect(classicHits(['The marsh breathes at night.'])).toEqual([]);
  });

  it('no built region map and no pass W cutscene uses one', () => {
    const lines = canonRows().filter((r) => isBuilt(r.id)).flatMap((r) => (compiledMap(r.id) ? mapLines(compiledMap(r.id)!) : []));
    const ids = passWCutsceneIds();
    const cuts = (parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps?: Array<{ text?: unknown }> }>) ?? [];
    const flat = (d: unknown): string[] => (typeof d === 'string' ? [d] : Array.isArray(d) ? d.flatMap(flat) : []);
    for (const c of cuts) if (ids.has(c.id)) for (const s of c.steps ?? []) lines.push(...flat(s.text));
    expect(classicHits(lines)).toEqual([]);
  });
});

describe('originality: the pass W dungeons', () => {
  const rows = canonRows().filter((r) => r.kind === 'floor');
  const dungeons = new Map<string, typeof rows>();
  for (const r of rows) {
    // floors without a floor label are grouped by their stem
    const d = floorOf(r.id)?.dungeon ?? r.id.replace(/-[a-z]+$/, '');
    dungeons.set(d, [...(dungeons.get(d) ?? []), r]);
  }
  const built = [...dungeons].filter(([, fs]) => fs.every((f) => isBuilt(f.id) && compiledMap(f.id)));

  it(`${built.length} of ${dungeons.size} dungeons built; each meets the self-check`, () => {
    if (STRICT) expect(built.length).toBe(dungeons.size);
    const errors: string[] = [];
    const byTranche = new Map<string, { branching: number; total: number; bosses: string[] }>();
    for (const [d, fs] of built) {
      const maps = fs.map((f) => compiledMap(f.id)!);
      const g = stairGraph(maps);
      const owner = fs[0].owner;
      const tr = byTranche.get(owner) ?? { branching: 0, total: 0, bosses: [] };
      tr.total++;
      if (g.branching) tr.branching++;
      byTranche.set(owner, tr);
      for (const m of maps) {
        const ends = deadEnds(m);
        if (m.width >= 24 && m.height >= 24 && ends < 2) errors.push(`${m.id}: ${ends} dead-end branches < 2`);
        const b = bossPosition(m);
        if (b) {
          const key = `${b.octant} ${b.path}`;
          if (tr.bosses.includes(key)) errors.push(`${m.id}: boss room ${key} repeats another of ${owner}`);
          tr.bosses.push(key);
        }
      }
      for (let i = 0; i < maps.length; i++) for (let j = i + 1; j < maps.length; j++) {
        const [a, c] = [floorShape(maps[i]), floorShape(maps[j])];
        if (within(a.aspect, c.aspect) && within(a.fill, c.fill)) errors.push(`${maps[i].id} and ${maps[j].id}: the same shape`);
      }
      const note = designNote(sourceText(fs[0].id) ?? '').note.Topology ?? '';
      const named = topologyLine(note);
      const labels = fs.map((f) => floorOf(f.id)?.label ?? f.id);
      const bossFloor = maps.find((m) => (m.scriptedEncounters ?? []).some((e) => e.isBoss));
      // the Topology line names B<n> / <n>F floors; a dungeon of named sites has none to match
      const labelled = fs.every((f) => floorOf(f.id));
      if (labelled && named.floors.join() !== labels.join()) errors.push(`${d}: Topology names ${named.floors.join(' ')}, the floors are ${labels.join(' ')}`);
      if (labelled && bossFloor && named.boss !== floorOf(bossFloor.id)?.label) errors.push(`${d}: Topology's boss floor ${named.boss} is not ${bossFloor.id}`);
      console.log(`${d}: ${g.branching ? 'branching' : 'chain'} [${g.edges.map((e) => e.join('>')).join(' ')}]`);
    }
    for (const [owner, tr] of byTranche) if (tr.branching * 2 < tr.total) errors.push(`${owner}: ${tr.branching} of ${tr.total} dungeons branch`);
    const grounds = canonRows().filter((r) => isBuilt(r.id) && compiledMap(r.id)).map((r) => compiledMap(r.id)!);
    errors.push(...equalGrounds(grounds).map((e) => `equal ground grids: ${e}`));
    expect(errors).toEqual([]);
  });
});
