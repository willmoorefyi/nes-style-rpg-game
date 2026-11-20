/**
 * NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2, 4.2, 4.3): quest.yaml's world places are names. The schema takes `entry.at`,
 * a vehicle's `at` and a `nonLoadBearing` `ref`, and refuses raw cells on the world map; `resolveQuestPlaces` gives
 * each its cell from the loaded maps; the verifier's `--maps`, `--anchors` and `--worst-canoe` options.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { validateQuestData } from '../../src/core/schemaValidationQuest.js';
import { resolveQuestPlaces } from '../../src/progression/questSpots.js';
import { loadQuestWorld } from '../../src/progression/questData.js';
import { loadMaps } from '../../src/progression/questMaps.js';
import { loadLateData } from '../../src/progression/questLateData.js';
import { parseArgs } from '../../src/progression/questReport.js';
import { worstCanoeRows } from '../../src/progression/questTravel.js';
import { AIRSHIP_ONLY, DEFAULT_TRAVEL_ROWS } from '../../src/progression/questTravelRows.js';
import type { MapData } from '../../src/types/index.js';

const stage = (extra: Record<string, unknown>): unknown => ({
  goal: 'G', towns: [], stages: [{ id: 'S0', title: 't', tranche: 'x', status: 'built', after: [], boss: [], maps: [], zones: [],
    walk: [], requires: { flags: [], items: [], vehicles: [] }, grants: { flags: ['G'], items: [], vehicles: [] }, band: null,
    kit: null, grind: 1, basins: {}, nonLoadBearing: [], ...extra }],
});
const world: MapData = {
  id: 'overworld', width: 4, height: 4, layers: [], tilesets: [], entrances: {}, collision: [], npcs: [], transitions: [],
  docks: [{ id: 'a_quay', x: 1, y: 2, basin: 'aldi' }],
  keyItemGates: [{ id: 'a_gate', x: 3, y: 0, message: 'no', permanent: false }],
  spots: { a_s_home: { at: [2, 2], kind: 'land' }, a_s_ship: { at: [1, 2], kind: 'dock' }, a_s_sky: { at: [0, 0], kind: 'landing' } },
};
const maps = new Map([['overworld', world]]);

describe('quest places by name (NW-1)', () => {
  it('the schema takes at / ref on the world map and refuses its raw cells', () => {
    expect(() => validateQuestData(stage({ entry: { map: 'overworld', at: 'a_s_home',
      vehicles: [{ type: 'ship', map: 'overworld', at: 'a_s_ship' }] } }))).not.toThrow();
    expect(() => validateQuestData(stage({ entry: { map: 'overworld', x: 2, y: 2 } }))).toThrow(/a place on overworld is a spot/);
    expect(() => validateQuestData(stage({ entry: { map: 'cave', x: 2, y: 2, vehicles: [{ type: 'ship', map: 'overworld', x: 1, y: 2 }] } })))
      .toThrow(/entry.vehicles\[0\]: a place on overworld is a spot/);
    expect(() => validateQuestData(stage({ entry: { map: 'overworld', at: 'a_s_home', x: 1 } }))).toThrow(/at or x \/ y, not both/);
    expect(() => validateQuestData(stage({ entry: { map: 'cave', x: 2, y: 2 } }))).not.toThrow();
    const nlb = (n: Record<string, unknown>): unknown => stage({ nonLoadBearing: [{ map: 'overworld', kind: 'dock', reason: 'r', ...n }] });
    expect(() => validateQuestData(nlb({ ref: 'a_quay' }))).not.toThrow();
    expect(() => validateQuestData(nlb({ at: [1, 2] }))).toThrow(/name the overworld element with ref/);
    expect(() => validateQuestData(nlb({}))).toThrow(/ref: expected string/);
  });

  it('resolveQuestPlaces fills in the cells from the spots and the element ids', () => {
    const q = validateQuestData(stage({
      entry: { map: 'overworld', at: 'a_s_home', vehicles: [{ type: 'ship', map: 'overworld', at: 'a_s_ship' },
        { type: 'airship', map: 'overworld', at: 'a_s_sky' }] },
      nonLoadBearing: [{ map: 'overworld', kind: 'dock', ref: 'a_quay', reason: 'r' },
        { map: 'overworld', kind: 'gate', ref: 'a_gate', reason: 'r' }, { map: 'cave', kind: 'npc', at: [5, 5], reason: 'r' }],
    }));
    const s = resolveQuestPlaces(q, maps).stages[0];
    expect([s.entry!.x, s.entry!.y]).toEqual([2, 2]);
    expect(s.entry!.vehicles).toEqual([{ type: 'ship', map: 'overworld', x: 1, y: 2 }, { type: 'airship', map: 'overworld', x: 0, y: 0 }]);
    expect(s.nonLoadBearing.map((n) => n.at)).toEqual([[1, 2], [3, 0], [5, 5]]);
    expect(q.stages[0].entry!.x).toBeUndefined();          // pure: the input is untouched
  });

  it('an unknown spot or ref throws with the stage and the name', () => {
    expect(() => resolveQuestPlaces(validateQuestData(stage({ entry: { map: 'overworld', at: 'a_s_nowhere' } })), maps))
      .toThrow(/quest S0 entry: map overworld has no spot a_s_nowhere/);
    expect(() => resolveQuestPlaces(validateQuestData(stage({ nonLoadBearing: [{ map: 'overworld', kind: 'gate', ref: 'a_quay',
      reason: 'r' }] })), maps)).toThrow(/has no gate a_quay/);
  });

  it('the real quest.yaml resolves on the world map to the cells of its spots, docks and gates (NW-5: the NW world)', () => {
    const w = loadQuestWorld();
    const ow = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as MapData;
    type Raw = { map: string; at?: string; type?: string };
    const raw = parse(readFileSync('assets/data/quest.yaml', 'utf-8')) as { stages: Array<{ id: string;
      entry?: Raw & { vehicles?: Raw[] }; nonLoadBearing: Array<{ map: string; kind: string; ref?: string }> }> };
    const cell = (name: string): [number, number] => ow.spots![name].at;
    let n = 0;
    for (const r of raw.stages) {
      const s = w.stages.get(r.id)!;
      if (r.entry?.map === 'overworld' && r.entry.at) {
        expect([s.entry!.x, s.entry!.y], `${r.id} entry`).toEqual(cell(r.entry.at));
        n++;
      }
      (r.entry?.vehicles ?? []).forEach((v, i) => {
        if (v.map !== 'overworld' || !v.at) return;
        const got = s.entry!.vehicles![i];
        expect([got.type, got.x, got.y], `${r.id} ${v.type}`).toEqual([v.type, ...cell(v.at)]);
        n++;
      });
      r.nonLoadBearing.forEach((e, i) => {
        if (e.map !== 'overworld' || !e.ref) return;
        const rec = e.kind === 'dock' ? ow.docks!.find((d) => d.id === e.ref) : ow.keyItemGates!.find((g) => g.id === e.ref);
        expect(s.nonLoadBearing[i].at, `${r.id} ${e.kind} ${e.ref}`).toEqual([rec!.x, rec!.y]);
        n++;
      });
    }
    expect(n).toBeGreaterThanOrEqual(27 + 33 + 5);             // NW-1's rewrite: 27 entries, 33 vehicles, 5 refs
  });
});

describe('the verifier options (NW-1)', () => {
  it('parses --maps, --anchors and --worst-canoe', () => {
    expect(parseArgs(['--maps', '/tmp/x', '--anchors', 'a.yaml', '--worst-canoe', '--strict']))
      .toMatchObject({ maps: '/tmp/x', anchors: 'a.yaml', worstCanoe: true, strict: true });
    expect(parseArgs([]).worstCanoe).toBe(false);
    expect(() => parseArgs(['--maps'])).toThrow(/--maps needs a value/);
  });

  it('--maps reads a folder\'s map before the repository\'s of the same id', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nw1-maps-'));
    const ow = parse(readFileSync('assets/maps/ai/overworld.yaml', 'utf-8')) as MapData;
    writeFileSync(join(dir, 'overworld.yaml'), JSON.stringify({ ...ow, spots: { ...ow.spots, a1_s_extra: { at: [92, 111], kind: 'land' } } }));
    const scratch = loadMaps(process.cwd(), false, dir).find((m) => m.id === 'overworld')!;
    expect(scratch.spots?.a1_s_extra).toEqual({ at: [92, 111], kind: 'land' });
    expect(loadMaps(process.cwd(), false).find((m) => m.id === 'overworld')!.spots?.a1_s_extra).toBeUndefined();
    expect(() => loadMaps(process.cwd(), false, join(dir, 'missing'))).toThrow(/no such folder/);
  });

  it('--anchors replaces world-anchors.yaml, whose bands are read from the file', () => {
    // NW-5: the default file is the NW world's; pass W's (frozen) is the one passed in
    expect(loadLateData().geo!.scale).toEqual([0.75, 0.95]);
    expect(loadLateData().geo!.longPair).toBe(23);
    const passW = loadLateData(process.cwd(), { anchors: 'tests/fixtures/passW/world-anchors.yaml' }).geo!;
    expect(passW.scale).toEqual([0.6, 0.8]);
    expect(passW.longPair).toBe(20);
    expect(() => loadLateData(process.cwd(), { anchors: '/nonexistent.yaml' })).toThrow(/no such file/);
    const dir = mkdtempSync(join(tmpdir(), 'nw1-anchors-'));
    writeFileSync(join(dir, 'a.yaml'), 'tolerance: 2\nfit: {scale: [0.7, 0.9]}\nanchors: []\n');
    expect(() => loadLateData(process.cwd(), { anchors: join(dir, 'a.yaml') })).toThrow(/missing fit.longPair/);
  });

  it('--worst-canoe adds T0-T4 with the canoe; T3 / T4 may reach the south lands, none a north anchor', () => {
    const rows = worstCanoeRows(DEFAULT_TRAVEL_ROWS);
    expect(rows.map((r) => [r.id, r.from, r.items])).toEqual(['T0', 'T1', 'T2', 'T3', 'T4'].map((t) => [`${t}+canoe`, t, ['canoe']]));
    for (const r of rows) {
      expect(r.reach).toEqual([]);
      for (const a of AIRSHIP_ONLY) expect(r.notReach, `${r.id} ${a}`).toContain(a);
      const south = ['fir_volcano', 'fir_ice', 'fir_desert'].filter((t) => r.notReach.includes(t));
      expect(south.length, r.id).toBe(r.id.startsWith('T3') || r.id.startsWith('T4') ? 0 : 3);
    }
  });
});
