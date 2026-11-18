/**
 * The sky castle on the compiled maps (docs/WORLD_PLAN.md 4.0.2, 4.7; WND-D2): the chests per floor (3 / 3 / 4 / 3 / 2)
 * and EXIT; the canon entrances and links kept for the hand-off with WND-D1 (`arrival` from `mirage_ascent`); 1F's
 * dock ring, its hub stair and the twin east-berth stair, the berth beam back to `mirage-3f`; 2F's belts, one way only,
 * and the stair island reached only by a belt; 3F's adamant in the sealed vault; 4F's zone `wnd_d2_engine` with the
 * Warmech at 1 in 64; 5F's seraph due north of the arrival, her battle and `wnd_seraph_falls` (WIND_CRYSTAL_LIT); and
 * no cell of the five floors from which the seraph can't be reached (the castle's own soft-lock check).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { baseTerrain, terrainAllows } from '../../../src/systems/fieldRules.js';
import type { MapData, MapNPC } from '../../../src/types/index.js';
import { bossPosition } from '../originalityChecks.js';

const map = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const IDS = [1, 2, 3, 4, 5].map((i) => `sky-castle-${i}f`);
const FLOORS = IDS.map(map);
const [f1, f2, f3, f4, f5] = FLOORS;
const byId = new Map(FLOORS.map((m) => [m.id, m]));
const chests = (m: MapData): MapNPC[] => m.npcs.filter((n) => n.chestItem);
const stairs = (m: MapData, target: string, entrance?: string) => m.transitions
  .filter((t) => t.targetMap === target && (!entrance || t.targetEntrance === entrance));
const walkable = (m: MapData, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < m.width && y < m.height && terrainAllows('walking', baseTerrain(m, x, y));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Cells reached on foot from `from` on one map (static NPCs block), not stepping on through a transition. */
function walk(m: MapData, from: [number, number]): Set<string> {
  const trans = new Set(m.transitions.map((t) => `${t.x},${t.y}`));
  const block = new Set(m.npcs.filter((n) => !n.wander).map((n) => `${n.x},${n.y}`));
  const seen = new Set([`${from[0]},${from[1]}`]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS) {
      const k = `${x + dx},${y + dy}`;
      if (seen.has(k) || block.has(k) || !walkable(m, x + dx, y + dy)) continue;
      seen.add(k);
      if (!trans.has(k)) q.push([x + dx, y + dy]);
    }
  }
  return seen;
}

/** The five floors as one move graph: a step, or a transition to its target entrance (castle maps only). */
function edges(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of FLOORS) {
    const trans = new Map(m.transitions.map((t) => [`${t.x},${t.y}`, t]));
    const block = new Set(m.npcs.filter((n) => !n.wander).map((n) => `${n.x},${n.y}`));
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      const k = `${x},${y}`;
      if (!walkable(m, x, y) || block.has(k)) continue;
      const t = trans.get(k);
      const to: string[] = [];
      if (t && !byId.has(t.targetMap)) continue;   // the beam down and EXIT leave the castle (WND-D1 lifts back)
      if (t) {
        const tm = byId.get(t.targetMap);
        const e = tm && t.targetEntrance ? tm.entrances![t.targetEntrance] : null;
        if (e) to.push(`${tm!.id}@${e[0]},${e[1]}`);
      } else {
        for (const [dx, dy] of DIRS) {
          const n = `${x + dx},${y + dy}`;
          if (walkable(m, x + dx, y + dy) && !block.has(n)) to.push(`${m.id}@${n}`);
        }
      }
      out.set(`${m.id}@${k}`, to);
    }
  }
  return out;
}

describe('WND-D2: the sky castle (S28)', () => {
  it('chests 3 / 3 / 4 / 3 / 2, each flag CHEST_WND_D2_; EXIT to wnd_mirage; 5F no save; the staged backdrops', () => {
    expect(FLOORS.map((m) => chests(m).length)).toEqual([3, 3, 4, 3, 2]);
    for (const m of FLOORS) {
      for (const c of chests(m)) expect(c.chestFlag, c.id).toMatch(/^CHEST_WND_D2_/);
      expect(m.exit).toEqual({ map: 'overworld', entrance: 'wnd_mirage' });
    }
    expect(f5.canSave).toBe(false);
    expect(FLOORS.map((m) => m.battleBackgrounds?.default))
      .toEqual(['sky_palace', 'sky_palace', 'sky_palace', 'sky_palace', 'throne_tiamat']);
  });

  it('keeps the canon entrances and links (arrival / up / boss), so WND-D1\'s warp lands in any merge order', () => {
    for (let i = 0; i < 5; i++) {
      expect(FLOORS[i].entrances!.arrival, IDS[i]).toBeDefined();
      if (i < 4) {
        expect(FLOORS[i].entrances!.up, IDS[i]).toBeDefined();
        expect(stairs(FLOORS[i], IDS[i + 1], 'arrival').length, IDS[i]).toBeGreaterThan(0);
        expect(stairs(FLOORS[i + 1], IDS[i], 'up').length, IDS[i + 1]).toBeGreaterThan(0);
      }
    }
    expect(f5.entrances!.boss).toBeDefined();
    // 1F has no walking way out to the overworld; its south berth's beam drops to the Mirage Tower's top
    expect(stairs(f1, 'overworld')).toEqual([]);
    expect(stairs(f1, 'mirage-3f', 'ring').length).toBe(2);
  });

  it('1F: the berth gate wants SKY_FORTRESS_OPEN; twin stairs up from the hub and the east berth', () => {
    expect(f1.keyItemGates!.map((g) => g.requiredFlag)).toEqual(['SKY_FORTRESS_OPEN', 'SKY_FORTRESS_OPEN']);
    expect(stairs(f1, 'sky-castle-2f', 'arrival').length).toBe(2);
    expect(stairs(f1, 'sky-castle-2f', 'east').length).toBe(2);
    const ring = walk(f1, f1.entrances!.up);
    expect(ring.has(`${f1.entrances!.up_east[0]},${f1.entrances!.up_east[1]}`)).toBe(true);
  });

  it('2F: the stair island is reached only by a belt, and every belt is walked one way', () => {
    const e = f2.entrances!;
    const fromArrival = walk(f2, e.arrival);
    const up = stairs(f2, 'sky-castle-3f').map((t) => `${t.x},${t.y}`);
    expect(up.some((c) => fromArrival.has(c))).toBe(false);
    expect(up.some((c) => walk(f2, e.e_belt).has(c))).toBe(true);
    const belts = f2.transitions.filter((t) => t.targetMap === f2.id);
    expect(new Set(belts.map((t) => t.targetEntrance))).toEqual(new Set(['c_belt', 'd_belt', 'e_belt', 'f_belt']));
    // each belt's far end is not on a belt, and walking from it never leads back onto the belt's start side
    for (const t of belts) {
      const [x, y] = e[t.targetEntrance!];
      expect(belts.some((b) => b.x === x && b.y === y), t.targetEntrance).toBe(false);
    }
    // B => D: from the east island D is not reached on foot; C => F likewise
    expect(walk(f2, e.east).has(`${e.d_belt[0]},${e.d_belt[1]}`)).toBe(false);
    expect(walk(f2, e.c_belt).has(`${e.f_belt[0]},${e.f_belt[1]}`)).toBe(false);
  });

  it('3F: the adamant lies in the sealed vault, a dead end reached only by the west passage', () => {
    const c = chests(f3).find((n) => n.chestItem === 'adamant')!;
    expect(c.chestFlag).toBe('CHEST_WND_D2_ADAMANT');
    expect(FLOORS.flatMap(chests).filter((n) => n.chestItem === 'adamant').length).toBe(1);
    expect(c.x).toBeLessThan(8);
    expect(c.y).toBeGreaterThan(21);
  });

  it('4F: the whole floor is the zone wnd_d2_engine, where the Warmech is 1 formation in 64', () => {
    const z = f4.encounterZones!.find((x) => x.id === 'wnd_d2_engine')!;
    expect(z.rects).toEqual([[0, 0, f4.width - 1, f4.height - 1]]);
    const total = z.encounters.reduce((s, e) => s + e.weight, 0);
    const mech = z.encounters.filter((e) => (e.groups ?? []).some((g) => g.id === 'warmech'));
    expect(mech.length).toBe(1);
    expect(mech[0].weight / total).toBe(1 / 64);
    for (const m of [f1, f2, f3, f5]) expect(JSON.stringify(m.encounters)).not.toContain('warmech');
  });

  it('5F: the seraph due north of the arrival, her battle and wnd_seraph_falls (WIND_CRYSTAL_LIT)', () => {
    expect(bossPosition(f5)?.octant).toBe('N');
    const enc = f5.scriptedEncounters![0];
    expect(enc).toMatchObject({ npc: 'hollow_seraph', enemyIds: ['hollow_seraph', 'air_elemental'], flag: 'WIND_CRYSTAL_LIT',
      isBoss: true, postVictoryCutscene: 'wnd_seraph_falls' });
    const steps = (parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>)
      .find((c) => c.id === 'wnd_seraph_falls')!.steps;
    expect(steps.some((s) => s.type === 'set_flag' && s.flag === 'WIND_CRYSTAL_LIT')).toBe(true);
  });

  it('no soft-lock inside the castle: from every cell reached from 1F\'s arrival the seraph is reached', () => {
    const g = edges();
    const start = `${f1.id}@${f1.entrances!.arrival.join(',')}`;
    const reach = new Set([start]);
    const q = [start];
    for (let i = 0; i < q.length; i++) for (const n of g.get(q[i]) ?? []) if (!reach.has(n)) { reach.add(n); q.push(n); }
    const back = new Map<string, string[]>();
    for (const [a, ns] of g) for (const n of ns) back.set(n, [...(back.get(n) ?? []), a]);
    const goal = `${f5.id}@${f5.entrances!.boss.join(',')}`;
    expect(reach.has(goal)).toBe(true);
    const can = new Set([goal]);
    const r = [goal];
    for (let i = 0; i < r.length; i++) for (const p of back.get(r[i]) ?? []) if (!can.has(p)) { can.add(p); r.push(p); }
    expect([...reach].filter((s) => g.has(s) && !can.has(s))).toEqual([]);
  });
});
