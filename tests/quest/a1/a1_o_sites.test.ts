/**
 * A1-O's sites and zones (docs/WORLD_PLAN.md 2.2, 4.0.3, 4.1; S3, S7): Matoya's cave on the compiled maps, the
 * anchors a1_matoya and a1_pravoka within 2 cells of their targets, Pravoka's door, quay and brig, the cairn, and the
 * mainland and sea zones (every walkable mainland cell in a1_mainland; every Water cell of the A1 box in exactly one
 * ship zone, a1_aldi or a1_north_sea).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { TerrainType, type MapData, type MapNPC } from '../../../src/types/index.js';
import { npcOutcome, terrainAllows, baseTerrain, type FieldState } from '../../../src/systems/fieldRules.js';
import { validateMapData } from '../../../src/core/schemaValidation.js';

const load = (id: string) => validateMapData(parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8'))) as MapData;
const ow = load('overworld');
const cave = load('matoya-cave');
const anchors = (parse(readFileSync('assets/data/world-anchors.yaml', 'utf-8')) as {
  anchors: Array<{ entrance: string; target: [number, number] }>;
}).anchors;
const state = (flags: string[], items: string[] = []): FieldState =>
  ({ flags: new Set(flags), items: new Set(items), mode: 'walking', vehicles: [] });
type Step = { type: string; flag?: string; item?: string };
const cutscene = (id: string) => (parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Step[] }>)
  .find((c) => c.id === id)!;

describe('A1 anchors and doors (WORLD_PLAN 2.2, 4.1)', () => {
  it.each(['a1_matoya', 'a1_pravoka'])('%s is an entrance within 2 cells of its target, on a walkable cell', (name) => {
    const at = ow.entrances![name];
    const target = anchors.find((a) => a.entrance === name)!.target;
    expect(Math.max(Math.abs(at[0] - target[0]), Math.abs(at[1] - target[1]))).toBeLessThanOrEqual(2);
    expect(terrainAllows('walking', baseTerrain(ow, at[0], at[1]))).toBe(true);
  });

  it('the doors: Matoya\'s cave mouth and Pravoka\'s icon lead to their maps, one cell from the anchor', () => {
    for (const [map, entrance, anchor] of [['matoya-cave', 'arrival', 'a1_matoya'], ['pravoka', 'gate', 'a1_pravoka']]) {
      const t = ow.transitions.find((x) => x.targetMap === map)!;
      expect(t.targetEntrance).toBe(entrance);
      const [ax, ay] = ow.entrances![anchor];
      expect(Math.abs(t.x - ax) + Math.abs(t.y - ay)).toBe(1);
    }
    const back = cave.transitions.find((t) => t.targetMap === 'overworld')!;
    expect(back.targetEntrance).toBe('a1_matoya');
    expect(cave.exit).toEqual({ map: 'overworld', entrance: 'a1_matoya' });
  });

  it('the brig waits at the Pravoka quay for BIKKE_DEFEATED; no ship off Cornelia\'s jetty', () => {
    const ships = (ow.vehicles ?? []).filter((v) => v.type === 'ship');
    const dock = (ow.docks ?? []).find((d) => d.id === 'a1_pravoka')!;
    expect(ships).toHaveLength(1);
    expect([ships[0].x, ships[0].y]).toEqual([dock.x, dock.y]);
    expect(ships[0].requiredFlag).toBe('BIKKE_DEFEATED');
  });

  it('the cairn on the saddle pass is an inspect cell with original text', () => {
    const cairn = (ow.inspect ?? []).find((i) => JSON.stringify(i.text).includes('saddle'));
    expect(cairn).toBeDefined();
    expect(terrainAllows('walking', baseTerrain(ow, cairn!.x, cairn!.y))).toBe(false);     // the stones block
    expect(terrainAllows('walking', baseTerrain(ow, cairn!.x, cairn!.y + 1))).toBe(true);  // read from the pass
  });
});

describe("Matoya's cave (S3, S7)", () => {
  const matoya = cave.npcs.find((n) => n.id === 'matoya') as MapNPC;

  it('is at least 16x14, with Matoya and three wandering brooms', () => {
    expect(cave.width).toBeGreaterThanOrEqual(16);
    expect(cave.height).toBeGreaterThanOrEqual(14);
    expect(cave.npcs).toHaveLength(4);
    expect(cave.npcs.filter((n) => n.id.startsWith('broom_') && n.wander)).toHaveLength(3);
  });

  it('her lines differ before, with the eye held and after; the eye plays a1_matoya_sight', () => {
    const before = npcOutcome(matoya, state([]), []);
    const holding = npcOutcome(matoya, state([], ['crystal_eye']), []);
    const after = npcOutcome(matoya, state(['A1_O_HERB_GIVEN']), []);
    expect(new Set([before.dialog[0], holding.dialog[0], after.dialog[0]]).size).toBe(3);
    expect(before.cutscene).toBeUndefined();
    expect(holding.cutscene).toBe('a1_matoya_sight');
    expect(npcOutcome(matoya, state(['A1_O_HERB_GIVEN'], ['crystal_eye']), []).cutscene).toBeUndefined();
  });

  it('the scene takes the eye, gives the herb and sets A1_O_HERB_GIVEN', () => {
    const steps = cutscene('a1_matoya_sight').steps;
    expect(steps.filter((s) => s.type === 'take_item').map((s) => s.item)).toEqual(['crystal_eye']);
    expect(steps.filter((s) => s.type === 'give_item').map((s) => s.item)).toEqual(['herb']);
    expect(steps.filter((s) => s.type === 'set_flag').map((s) => s.flag)).toEqual(['A1_O_HERB_GIVEN']);
  });
});

describe('A1 zones (WORLD_PLAN 4.0.3, 4.1)', () => {
  const zones = ow.encounterZones ?? [];
  const zone = (id: string) => zones.find((z) => z.id === id)!;
  const inZone = (id: string, x: number, y: number) => zone(id).rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

  it('a1_mainland (walking), a1_aldi and a1_north_sea (ship), each named', () => {
    expect(zone('a1_mainland').modes).toBeUndefined();
    expect(zone('a1_aldi').modes).toEqual(['ship']);
    expect(zone('a1_north_sea').modes).toEqual(['ship']);
    for (const id of ['a1_mainland', 'a1_aldi', 'a1_north_sea']) expect(zone(id).name).toBeTruthy();
  });

  it('the mainland zone holds the north shore, Matoya\'s clearing and Pravoka\'s gate, no peninsula cell', () => {
    for (const e of ['north_shore', 'a1_matoya', 'a1_pravoka']) expect(inZone('a1_mainland', ...ow.entrances![e]), e).toBe(true);
    for (const e of ['cornelia', 'temple']) expect(inZone('a1_mainland', ...ow.entrances![e]), e).toBe(false);
  });

  it('every Water cell of the A1 box is in exactly one ship zone; aldi holds the basin seed and the quay', () => {
    const bad: string[] = [];
    for (let y = 64; y <= 143; y++) {
      for (let x = 64; x <= 143; x++) {
        if (ow.collision[y * ow.width + x] !== TerrainType.Water) continue;
        const n = Number(inZone('a1_aldi', x, y)) + Number(inZone('a1_north_sea', x, y));
        if (n !== 1) bad.push(`(${x}, ${y}) in ${n}`);
      }
    }
    expect(bad).toEqual([]);
    expect(inZone('a1_aldi', 92, 121)).toBe(true);
    const dock = (ow.docks ?? []).find((d) => d.id === 'a1_pravoka')!;
    expect(inZone('a1_aldi', dock.x, dock.y)).toBe(true);
    expect(inZone('a1_north_sea', 100, 66)).toBe(true);
  });
});
