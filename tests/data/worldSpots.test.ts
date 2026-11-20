/**
 * NW-1 (docs/NATURAL_WORLD_PLAN.md 5.2, D-NW10): quest.yaml, the debug scenarios and the cutscenes name their world-map
 * places, never raw cells. Every `at` / `spot` names a spot of its map, of the kind its user needs (a stage entry or a
 * spawn on land, a ship at a dock spot, an airship at a landing spot); every `nonLoadBearing` `ref` names an element
 * of its kind; and the compiled world carries the source's spots and basin seeds unchanged. NW-5: the world is pass
 * NW's; act 1's records keep pass W's cells (`tests/fixtures/passW/overworld.yaml`) moved by the act-1 delta (54, 44).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateMapData } from '../../src/core/schemaValidation.js';
import type { MapData, MapSpot, SpotKind } from '../../src/types/index.js';

const read = (p: string): unknown => parse(readFileSync(p, 'utf-8'));
const world = validateMapData(read('assets/maps/ai/overworld.yaml'));
const source = read('assets-src/maps/overworld.yaml') as { spots: Record<string, MapSpot>; world: { basins: unknown } };
const spots = world.spots ?? {};
const passW = read('tests/fixtures/passW/overworld.yaml') as { keyItemGates: Array<{ id: string; x: number; y: number }> };
const DELTA = [54, 44];                       // act 1's pins: pass W's cell + (54, 44) (docs/NATURAL_WORLD_PLAN.md 2.2)
type Place = { map: string; at?: string; x?: number; y?: number; type?: string };
const quest = read('assets/data/quest.yaml') as {
  stages: Array<{ id: string; entry?: Place & { vehicles?: Place[] };
    nonLoadBearing: Array<{ map: string; kind: string; ref?: string; at?: unknown }> }>;
};
const scenarios = read('assets/data/debug-scenarios.yaml') as Array<{ id: string; map?: string; spot?: string;
  spawn?: unknown; frame?: string; vehicles?: Place[] }>;
const cutscenes = read('assets/data/cutscenes.yaml') as Array<{ id: string; steps: Array<Place & { vehicle?: string }> }>;
const KIND: Record<string, SpotKind> = { ship: 'dock', airship: 'landing', canoe: 'land' };

/** `where: spot` lines for every world place of the data, with the kind it must have. */
function places(): Array<{ where: string; place: Place; kind: SpotKind }> {
  const out: Array<{ where: string; place: Place; kind: SpotKind }> = [];
  for (const s of quest.stages) {
    if (s.entry) out.push({ where: `quest ${s.id} entry`, place: s.entry, kind: 'land' });
    for (const v of s.entry?.vehicles ?? []) out.push({ where: `quest ${s.id} ${v.type}`, place: v, kind: KIND[v.type!] });
  }
  for (const sc of scenarios) {
    if (sc.spot) out.push({ where: `scenario ${sc.id}`, place: { map: sc.map!, at: sc.spot }, kind: 'land' });
    for (const v of sc.vehicles ?? []) out.push({ where: `scenario ${sc.id} ${v.type}`, place: v, kind: KIND[v.type!] });
  }
  for (const c of cutscenes) {
    for (const st of c.steps) {
      if ((st as { type?: string }).type === 'set_vehicle') {
        out.push({ where: `cutscene ${c.id}`, place: st, kind: KIND[st.vehicle!] });
      }
    }
  }
  return out;
}

describe('world spots (NW-1)', () => {
  it('the compiled world has the source spots and basin seeds, every spot named <prefix>_s_<name>', () => {
    expect(Object.keys(spots).length).toBeGreaterThanOrEqual(40);
    expect(spots).toEqual(source.spots);
    expect(world.world?.basins).toEqual(source.world.basins);
    const [cx, cy] = world.entrances!.cornelia;      // the Aldi's seed: the cell below Cornelia's jetty, 10 south of the gate
    expect(world.world?.basins).toEqual({ aldi: [cx, cy + 10], ocean: [2, 2] });
    for (const name of Object.keys(spots)) expect(name).toMatch(/^(a1|elf|ert|fir|ord|wat|wnd)_s_[a-z0-9_]+$/);
  });

  it('no world place in the data is a raw cell', () => {
    const raw = places().filter((p) => p.place.map === 'overworld' && (p.place.x !== undefined || p.place.y !== undefined));
    expect(raw.map((p) => p.where)).toEqual([]);
    for (const sc of scenarios.filter((s) => s.map === 'overworld')) {
      expect(sc.frame ?? sc.spawn, `${sc.id}: a spot or an entrance`).toBeUndefined();
    }
  });

  it('every at / spot names a spot of its map, of the kind its user needs', () => {
    const maps = new Map<string, MapData>([['overworld', world]]);
    const named = places().filter((p) => p.place.at !== undefined);
    expect(named.length).toBeGreaterThanOrEqual(27 + 33 + 36 + 3 + 1);       // the NW-1 rewrite's counts
    for (const { where, place, kind } of named) {
      const s = maps.get(place.map)?.spots?.[place.at!];
      expect(s, `${where}: ${place.map} has spot ${place.at}`).toBeDefined();
      expect(s!.kind, `${where}: ${place.at}`).toBe(kind);
    }
  });

  it('every nonLoadBearing element on the world map is named (ref), and exists', () => {
    const refs = quest.stages.flatMap((s) => s.nonLoadBearing.filter((n) => n.map === 'overworld')
      .map((n) => ({ ...n, stage: s.id })));
    expect(refs.map((n) => `${n.stage} ${n.kind} ${n.ref}`)).toEqual([
      'S0 gate a1_bridge_gate_w', 'S0 gate a1_bridge_gate_e', 'S2 dock a1_pravoka', 'S4 dock elf_port', 'S10 dock ert_dwarf',
    ]);
    for (const n of refs) {
      expect(n.at, `${n.stage}: no cell`).toBeUndefined();
      const hit = n.kind === 'dock' ? world.docks?.find((d) => d.id === n.ref) : world.keyItemGates?.find((g) => g.id === n.ref);
      expect(hit, `${n.stage} ${n.kind} ${n.ref}`).toBeDefined();
    }
    expect(world.keyItemGates?.map((g) => [g.id, g.x, g.y]))
      .toEqual(passW.keyItemGates.map((g) => [g.id, g.x + DELTA[0], g.y + DELTA[1]]));
  });

  it('the spots stand on their records: Cornelia on its entrance, the ships on their docks', () => {
    const at = (n: string): [number, number] => spots[n].at;
    expect(at('a1_s_cornelia')).toEqual(world.entrances!.cornelia);
    const dock = world.docks!.find((d) => d.id === 'a1_pravoka')!;
    expect(at('a1_s_pravoka_ship')).toEqual([dock.x, dock.y]);
    expect(spots.fir_s_airship.kind).toBe('landing');
    for (const d of world.docks ?? []) {
      const ship = Object.entries(spots).find(([, s]) => s.kind === 'dock' && s.at[0] === d.x && s.at[1] === d.y);
      expect(ship, `a ship spot on dock ${d.id}`).toBeDefined();
    }
  });
});
