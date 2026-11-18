/**
 * Gurgu Volcano on the compiled maps (docs/WORLD_PLAN.md 4.0.2, 4.4; FIR-D1): the chests per floor (3 / 4 / 4 / 4 / 2)
 * and EXIT; B1's rim walk round a rock crater with its two stairs on opposite sides; the two galleries that cross (B2
 * west to east, B3 north to south), B2's east stair to B3's north gallery and its west stair to the sealed forge, a
 * dead end with treasure; B4's two routes; B5's queen due south of the arrival, her battle and `fir_ashen_falls`
 * (FIRE_CRYSTAL_LIT); and no static NPC cutting off a way on.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { baseTerrain, terrainAllows } from '../../../src/systems/fieldRules.js';
import type { MapData, MapNPC } from '../../../src/types/index.js';
import { bossPosition, floorShape } from '../originalityChecks.js';

const map = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const cutscene = (id: string): Array<Record<string, unknown>> =>
  (parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>)
    .find((c) => c.id === id)!.steps;
const [b1, b2, b3, b4, b5] = [1, 2, 3, 4, 5].map((i) => map(`gurgu-b${i}`));
const FLOORS = [b1, b2, b3, b4, b5];

/** Cells reached on foot from `from` (static NPCs block when `npcs`), not stepping on through a transition. */
function walk(m: MapData, from: [number, number], npcs = false, closed: string[] = []): Set<string> {
  const trans = new Set(m.transitions.map((t) => `${t.x},${t.y}`));
  const block = new Set([...closed, ...(npcs ? m.npcs.filter((n) => !n.wander).map((n) => `${n.x},${n.y}`) : [])]);
  const seen = new Set([`${from[0]},${from[1]}`]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(k) || block.has(k)) continue;
      if (!terrainAllows('walking', baseTerrain(m, nx, ny))) continue;
      seen.add(k);
      if (!trans.has(k)) q.push([nx, ny]);
    }
  }
  return seen;
}
const at = (m: MapData, e: string): [number, number] => m.entrances![e];
const chests = (m: MapData): MapNPC[] => m.npcs.filter((n) => n.chestItem);
const stairs = (m: MapData, target: string, entrance?: string): string[] => m.transitions
  .filter((t) => t.targetMap === target && (!entrance || t.targetEntrance === entrance)).map((t) => `${t.x},${t.y}`);
const reaches = (seen: Set<string>, cells: string[]): boolean => cells.some((c) => seen.has(c));

describe('FIR-D1: Gurgu Volcano (S15)', () => {
  it('chests 3 / 4 / 4 / 4 / 2, each flag CHEST_FIR_D1_; EXIT to fir_volcano; B5 no save; the staged backdrops', () => {
    expect(FLOORS.map((m) => chests(m).length)).toEqual([3, 4, 4, 4, 2]);
    for (const m of FLOORS) {
      for (const c of chests(m)) expect(c.chestFlag, c.id).toMatch(/^CHEST_FIR_D1_/);
      expect(m.exit).toEqual({ map: 'overworld', entrance: 'fir_volcano' });
    }
    expect(b5.canSave).toBe(false);
    expect(FLOORS.map((m) => m.battleBackgrounds?.default))
      .toEqual(['fire_temple', 'fire_temple', 'magma_temple', 'magma_temple', 'throne_kary']);
    expect(stairs(b1, 'overworld', 'fir_volcano').length).toBeGreaterThan(0);
  });

  it('B1: the rim walk rounds a rock crater; its two stairs down lie on opposite sides', () => {
    const cx = Math.floor(b1.width / 2); const cy = 18;
    expect(terrainAllows('walking', baseTerrain(b1, cx, cy))).toBe(false);
    const east = b1.transitions.filter((t) => t.targetMap === 'gurgu-b2' && t.targetEntrance === 'arrival');
    const west = b1.transitions.filter((t) => t.targetMap === 'gurgu-b2' && t.targetEntrance === 'west');
    expect(Math.min(...east.map((t) => t.x))).toBeGreaterThan(cx + 12);
    expect(Math.max(...west.map((t) => t.x))).toBeLessThan(cx - 12);
    const rim = walk(b1, at(b1, 'arrival'));
    expect(reaches(rim, east.map((t) => `${t.x},${t.y}`)) && reaches(rim, west.map((t) => `${t.x},${t.y}`))).toBe(true);
    // a ring: with the south arc closed (the rows below the crater, at the arrival's column) the east stair's landing
    // still reaches the west stair, round by the north
    const [ax] = at(b1, 'arrival');
    const south = [24, 25, 26, 27, 28].flatMap((y) => [ax, ax + 1].map((x) => `${x},${y}`));
    const north = walk(b1, at(b1, 'down'), false, south);
    expect(north.has(at(b1, 'arrival').join(','))).toBe(false);
    expect(reaches(north, west.map((t) => `${t.x},${t.y}`))).toBe(true);
  });

  it('B2 and B3 cross: B2 runs west to east, B3 north to south; B2\'s east stair reaches B3\'s north gallery', () => {
    expect(floorShape(b2).aspect).toBeGreaterThan(1.5);
    expect(floorShape(b3).aspect).toBeLessThan(1);
    const down = b2.transitions.filter((t) => t.targetMap === 'gurgu-b3' && t.targetEntrance === 'arrival');
    const forge = b2.transitions.filter((t) => t.targetMap === 'gurgu-b3' && t.targetEntrance === 'forge');
    expect(Math.min(...down.map((t) => t.x))).toBeGreaterThan(b2.width * 0.75);
    expect(Math.max(...forge.map((t) => t.x))).toBeLessThan(b2.width * 0.25);
    expect(at(b3, 'arrival')[1]).toBeLessThan(b3.height * 0.2);
    expect(at(b3, 'down')[1]).toBeGreaterThan(b3.height * 0.8);
  });

  it('B3: the forge is a dead end with treasure, walled off from the gallery and reached only by B2\'s west stair', () => {
    const gallery = walk(b3, at(b3, 'arrival'));
    const forge = walk(b3, at(b3, 'forge'));
    expect(gallery.has(at(b3, 'forge').join(','))).toBe(false);
    expect(reaches(forge, stairs(b3, 'gurgu-b4'))).toBe(false);
    expect(reaches(forge, stairs(b3, 'gurgu-b2', 'forge'))).toBe(true);
    expect(b3.transitions.filter((t) => forge.has(`${t.x},${t.y}`)).every((t) => t.targetEntrance === 'forge')).toBe(true);
    expect(chests(b3).filter((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dx, dy]) => forge.has(`${c.x + dx},${c.y + dy}`))).map((c) => c.chestItem).sort()).toEqual(['opal_armlet', 'sun_blade']);
  });

  it('every way on stays open round the static NPCs (chests and the queen)', () => {
    const check = (m: MapData, from: string, targets: string[]): void => {
      const free = walk(m, at(m, from)); const plugged = walk(m, at(m, from), true);
      for (const t of targets) if (free.has(t)) expect(plugged.has(t), `${m.id} ${from} -> ${t}`).toBe(true);
    };
    for (const m of FLOORS) {
      const targets = [...m.transitions.map((t) => `${t.x},${t.y}`), ...Object.values(m.entrances!).map((e) => e.join(','))];
      check(m, 'arrival', targets);
    }
    check(b3, 'forge', b3.transitions.map((t) => `${t.x},${t.y}`));
  });

  it('B5: the queen waits due south of the arrival; her fall relights the crystal (fir_ashen_falls)', () => {
    expect(bossPosition(b5)?.octant).toBe('S');
    const enc = b5.scriptedEncounters!.find((e) => e.isBoss)!;
    expect(enc).toMatchObject({ npc: 'ashen_queen', enemyIds: ['ashen_queen', 'fire_lizard'], flag: 'FIRE_CRYSTAL_LIT',
      postVictoryCutscene: 'fir_ashen_falls' });
    const queen = b5.npcs.find((n) => n.id === 'ashen_queen')!;
    expect([queen.x, queen.y, queen.hideIf]).toEqual([enc.x, enc.y, 'FIRE_CRYSTAL_LIT']);
    expect(walk(b5, at(b5, 'arrival')).has(at(b5, 'boss').join(','))).toBe(true);
    expect(cutscene('fir_ashen_falls')).toContainEqual({ type: 'set_flag', flag: 'FIRE_CRYSTAL_LIT' });
    const altar = (b5.inspect ?? [])[0];
    expect(altar.text).toHaveLength(2);
  });
});
