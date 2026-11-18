/**
 * The Mirage Tower on the compiled maps (docs/WORLD_PLAN.md 4.0.2, 4.7; WND-D1): chests 3 / 2 per floor and EXIT, the
 * vestibule's chime door (the only way to `inner`), the spiral gallery (the core's stair is a long walk round both
 * rings), the shaft's sealed well (reached only from 2F: its stair down and the one-way fall off the bridge), the two
 * half-floors of 2F joined only by the bridge, the console (the cube, `mirage_ascent`, SKY_FORTRESS_OPEN, the warp to
 * `sky-castle-1f`) and the ring that lifts the party again once the flag is set; the canon entrances and the roster.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { baseTerrain, terrainAllows } from '../../../src/systems/fieldRules.js';
import type { MapData, MapNPC } from '../../../src/types/index.js';

const map = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const cutscene = (id: string): Array<Record<string, unknown>> =>
  (parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>)
    .find((c) => c.id === id)!.steps;
const [f1, f2, f3] = ['mirage-1f', 'mirage-2f', 'mirage-3f'].map(map);
const ROSTER = new Set(['black_knight', 'chimera', 'guardian', 'blue_dragon', 'green_dragon', 'stone_golem']);

/** Path lengths on foot from `from` (cells in `closed` blocked), not stepping on from a transition cell. */
function dist(m: MapData, from: [number, number], closed: Set<string> = new Set()): Map<string, number> {
  const trans = new Set(m.transitions.map((t) => `${t.x},${t.y}`));
  const seen = new Map([[`${from[0]},${from[1]}`, 0]]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    const d = seen.get(`${x},${y}`)!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(k) || closed.has(k)) continue;
      if (!terrainAllows('walking', baseTerrain(m, nx, ny))) continue;
      seen.set(k, d + 1);
      if (!trans.has(k)) q.push([nx, ny]);
    }
  }
  return seen;
}
const at = (m: MapData, e: string): [number, number] => m.entrances![e];
const key = (c: [number, number]): string => c.join(',');
const chests = (m: MapData): MapNPC[] => m.npcs.filter((n) => n.chestItem);
const stairTo = (m: MapData, target: string, entrance?: string): string[] => m.transitions
  .filter((t) => t.targetMap === target && (entrance === undefined || t.targetEntrance === entrance)).map((t) => `${t.x},${t.y}`);
const gates = (m: MapData): Set<string> => new Set((m.keyItemGates ?? []).map((g) => `${g.x},${g.y}`));

describe('WND-D1: the Mirage Tower (S27)', () => {
  it('chests 3 / 3 / 2, each flag CHEST_WND_D1_; EXIT to the sands; the canon entrances; the tower background', () => {
    expect([f1, f2, f3].map((m) => chests(m).length)).toEqual([3, 3, 2]);
    for (const m of [f1, f2, f3]) {
      for (const c of chests(m)) expect(c.chestFlag, c.id).toMatch(/^CHEST_WND_D1_/);
      expect(m.exit).toEqual({ map: 'overworld', entrance: 'wnd_mirage' });
      expect(m.battleBackgrounds?.default).toBe('tower_of_babel');
      for (const t of m.encounters ?? []) for (const g of t.groups ?? []) expect(ROSTER.has(g.id), g.id).toBe(true);
    }
    expect(Object.keys(f1.entrances!)).toEqual(expect.arrayContaining(['arrival', 'inner', 'up']));
    expect(Object.keys(f2.entrances!)).toEqual(expect.arrayContaining(['arrival', 'up']));
    expect(Object.keys(f3.entrances!)).toContain('arrival');
    expect(stairTo(f1, 'overworld', 'wnd_mirage').some((k) => dist(f1, at(f1, 'arrival')).has(k))).toBe(true);
  });

  it('1F: the vestibule door wants the chime; without it neither `inner` nor the stair up is reached', () => {
    const doors = f1.keyItemGates ?? [];
    expect(doors.length).toBeGreaterThan(0);
    for (const g of doors) expect(g).toMatchObject({ requiredItem: 'chime', permanent: false });
    const shut = dist(f1, at(f1, 'arrival'), gates(f1));
    expect(shut.has(key(at(f1, 'inner')))).toBe(false);
    expect(stairTo(f1, 'mirage-2f').some((k) => shut.has(k))).toBe(false);
    for (const g of doors) expect(shut.has(`${g.x},${g.y + 1}`), 'the door is stepped onto from the vestibule').toBe(true);
    const open = dist(f1, at(f1, 'arrival'));
    expect(open.has(key(at(f1, 'inner')))).toBe(true);
  });

  it('1F: the spiral winds round both rings, so the stair up is far from the door though the core is near it', () => {
    const d = dist(f1, at(f1, 'inner'));
    const up = Math.min(...stairTo(f1, 'mirage-2f', 'arrival').map((k) => d.get(k) ?? Infinity));
    const [ix, iy] = at(f1, 'inner');
    const [ux, uy] = at(f1, 'up');
    expect(up).toBeGreaterThan(150);
    expect(Math.abs(ix - ux) + Math.abs(iy - uy)).toBeLessThan(25);
  });

  it('1F: the well at the shaft\'s foot is reached only from 2F (its stair, or the fall), and leads back up', () => {
    const fromDoor = dist(f1, at(f1, 'inner'));
    expect(fromDoor.has(key(at(f1, 'well')))).toBe(false);
    expect(fromDoor.has(key(at(f1, 'shaft')))).toBe(false);
    const well = dist(f1, at(f1, 'shaft'));
    expect(well.has(key(at(f1, 'well')))).toBe(true);
    expect(stairTo(f1, 'mirage-2f', 'well').some((k) => well.has(k))).toBe(true);
    expect(chests(f1).some((c) => well.has(`${c.x},${c.y}`) || [[0, 1], [1, 0], [0, -1], [-1, 0]]
      .some(([dx, dy]) => well.has(`${c.x + dx},${c.y + dy}`)))).toBe(true);
    expect(stairTo(f2, 'mirage-1f', 'well')).toHaveLength(2);
  });

  it('2F: the two half-floors are joined only by the bridge; one cracked span drops one way into the well', () => {
    const fromArrival = dist(f2, at(f2, 'arrival'));
    const up = stairTo(f2, 'mirage-3f', 'arrival');
    expect(up.some((k) => fromArrival.has(k))).toBe(true);
    const bridge = new Set<string>();
    for (let x = 0; x < f2.width; x++) for (const y of [14, 15]) {
      const t = baseTerrain(f2, x, y);
      if (terrainAllows('walking', t) && x >= 16 && x <= 23) bridge.add(`${x},${y}`);
    }
    expect(bridge.size).toBeGreaterThan(0);
    expect(up.some((k) => dist(f2, at(f2, 'arrival'), bridge).has(k))).toBe(false);
    const fall = f2.transitions.filter((t) => t.targetMap === 'mirage-1f' && t.targetEntrance === 'shaft');
    expect(fall).toHaveLength(1);
    expect(fromArrival.has(`${fall[0].x},${fall[0].y}`)).toBe(true);
    // one way: nothing on 1F leads back to the cracked span
    expect(f1.transitions.filter((t) => t.targetMap === 'mirage-2f').map((t) => t.targetEntrance).sort())
      .toEqual(['arrival', 'arrival', 'well', 'well']);
  });

  it('3F: the console takes the cube and plays mirage_ascent, which sets SKY_FORTRESS_OPEN and warps to the sky', () => {
    const console_ = f3.npcs.find((n) => n.id === 'mirage_console')!;
    expect(console_).toMatchObject({ requiredItem: 'cube', cutscene: { id: 'mirage_ascent', onceFlag: 'SKY_FORTRESS_OPEN' } });
    expect(console_.takeItem).toBeUndefined();
    const reach = dist(f3, at(f3, 'arrival'));
    expect([[0, 1], [1, 0], [-1, 0]].some(([dx, dy]) => reach.has(`${console_.x + dx},${console_.y + dy}`))).toBe(true);
    const steps = cutscene('mirage_ascent');
    const flagAt = steps.findIndex((s) => s.type === 'set_flag' && s.flag === 'SKY_FORTRESS_OPEN');
    const warpAt = steps.findIndex((s) => s.type === 'warp');
    expect(flagAt).toBeGreaterThanOrEqual(0);
    expect(warpAt).toBeGreaterThan(flagAt);
    expect(steps[warpAt]).toMatchObject({ map: 'sky-castle-1f', entrance: 'arrival' });
    expect(steps.some((s) => s.type === 'take_item')).toBe(false);
  });

  it('3F: the ring before the console lifts the party to the sky castle only once SKY_FORTRESS_OPEN is set', () => {
    const ring = f3.transitions.filter((t) => t.targetMap === 'sky-castle-1f');
    expect(ring.length).toBeGreaterThan(0);
    for (const t of ring) expect(t).toMatchObject({ targetEntrance: 'arrival', requiredFlag: 'SKY_FORTRESS_OPEN' });
    const reach = dist(f3, at(f3, 'arrival'));
    expect(ring.some((t) => reach.has(`${t.x},${t.y}`))).toBe(true);
    expect(reach.has(key(at(f3, 'ring')))).toBe(true);
  });
});
