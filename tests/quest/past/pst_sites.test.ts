/**
 * The time gate and the Temple of the Past on the compiled maps (docs/WORLD_PLAN.md 4.0.2, 4.8; PST): the act-1
 * temple's time gate (the gate cell, the stair, the hour keeper), the chests and EXIT of every floor, the five
 * refights and their stairs on, floor 2's wards, floor 3's flood, floor 4's spiral, floor 5's two routes, and the
 * shrine's Chaos with the ending.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { baseTerrain, canEnter, gateCheck, terrainAllows, type FieldState } from '../../../src/systems/fieldRules.js';
import type { MapData, MapNPC } from '../../../src/types/index.js';

const map = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const cutscene = (id: string): Array<Record<string, unknown>> =>
  (parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>)
    .find((c) => c.id === id)!.steps;
const FLOORS = ['past-temple-1', 'past-temple-2', 'past-temple-3', 'past-temple-4', 'past-temple-5', 'past-chaos'];
const [f1, f2, f3, f4, f5, fc] = FLOORS.map(map);
const temple = map('temple-of-fiends');
const CRYSTALS = ['EARTH_CRYSTAL_LIT', 'FIRE_CRYSTAL_LIT', 'WATER_CRYSTAL_LIT', 'WIND_CRYSTAL_LIT'];
const state = (flags: string[], items: string[] = []): FieldState =>
  ({ flags: new Set(flags), items: new Set(items), mode: 'walking', vehicles: [] }) as FieldState;
type Cell = [number, number];
const k = (x: number, y: number): string => `${x},${y}`;

/** Cells reached on foot from `from` with the gate cells in `closed` blocked, not stepping on through a transition. */
function walk(m: MapData, from: Cell, closed: Set<string> = new Set()): Set<string> {
  const trans = new Set(m.transitions.map((t) => k(t.x, t.y)));
  const seen = new Set([k(...from)]);
  const q: Cell[] = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const key = k(nx, ny);
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(key) || closed.has(key)) continue;
      if (!terrainAllows('walking', baseTerrain(m, nx, ny))) continue;
      seen.add(key);
      if (!trans.has(key)) q.push([nx, ny]);
    }
  }
  return seen;
}
/** The shortest walking distance from `from` to `to` (-1 when unreachable). */
function dist(m: MapData, from: Cell, to: Cell, closed: Set<string> = new Set()): number {
  const d = new Map([[k(...from), 0]]);
  const q: Cell[] = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (x === to[0] && y === to[1]) return d.get(k(x, y))!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const key = k(nx, ny);
      if (d.has(key) || closed.has(key) || !terrainAllows('walking', baseTerrain(m, nx, ny))) continue;
      d.set(key, d.get(k(x, y))! + 1);
      q.push([nx, ny]);
    }
  }
  return -1;
}
const at = (m: MapData, e: string): Cell => m.entrances![e];
const chests = (m: MapData): MapNPC[] => m.npcs.filter((n) => n.chestItem);
const npc = (m: MapData, id: string): MapNPC => m.npcs.find((n) => n.id === id)!;
const stairTo = (m: MapData, target: string) => m.transitions.filter((t) => t.targetMap === target);
const nextTo = (_m: MapData, n: MapNPC, seen: Set<string>): boolean =>
  [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(k(n.x + dx, n.y + dy)));

describe('PST: the time gate in the act-1 temple (S29)', () => {
  const gate = (temple.keyItemGates ?? []).find((g) => g.x === 3 && g.y === 4)!;
  const keeper = npc(temple, 'hour_keeper');

  it('the gate cell (3, 4) needs the lute and the four crystal flags; it is also the stair down (TIME_GATE_OPEN)', () => {
    expect(gate.requiredItem).toBe('lute');
    expect([...(gate.requiredFlags ?? [])].sort()).toEqual([...CRYSTALS].sort());
    expect(gateCheck(gate, state(CRYSTALS, ['lute'])).open).toBe(true);
    for (const f of CRYSTALS) expect(gateCheck(gate, state(CRYSTALS.filter((c) => c !== f), ['lute'])).open, f).toBe(false);
    expect(gateCheck(gate, state(CRYSTALS)).open).toBe(false);
    expect(canEnter(temple, { x: 3, y: 4 }, 'walking', state(['GARLAND_DEFEATED']))).toBe(false);
    const stair = temple.transitions.filter((t) => t.x === 3 && t.y === 4);
    expect(stair).toEqual([{ x: 3, y: 4, targetMap: 'past-temple-1', targetEntrance: 'arrival', requiredFlags: ['TIME_GATE_OPEN'] }]);
    expect(at(temple, 'time_gate')).toEqual([3, 5]);
    expect(stairTo(f1, 'temple-of-fiends').every((t) => t.targetEntrance === 'time_gate')).toBe(true);
  });

  it('the hour keeper stands in the corner (3, 3) from the earth crystal on and is talked to only from the gate cell', () => {
    expect([keeper.x, keeper.y]).toEqual([3, 3]);
    expect(keeper.showIf).toBe('EARTH_CRYSTAL_LIT');
    expect(keeper.cutscene).toEqual({ id: 'pst_time_gate', onceFlag: 'TIME_GATE_OPEN' });
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [3 + dx, 3 + dy] as Cell)
      .filter(([x, y]) => terrainAllows('walking', baseTerrain(temple, x, y)));
    expect(open).toEqual([[3, 4]]);
    const steps = cutscene('pst_time_gate');
    expect(steps.filter((s) => s.type === 'set_flag').map((s) => s.flag)).toEqual(['TIME_GATE_OPEN']);
    // the party is set back off the ring onto the time_gate arrival and takes the stair itself
    expect(steps.filter((s) => s.type === 'warp')).toEqual([{ type: 'warp', map: 'temple-of-fiends', entrance: 'time_gate', facing: 'up' }]);
  });

  it('Garland\'s room keeps its act-1 NPCs and battle; the keeper and the gate are the only additions', () => {
    expect(temple.npcs.map((n) => n.id).filter((id) => !id.startsWith('chest_'))).toEqual(['garland', 'captive_princess', 'hour_keeper']);
    expect(new Set((temple.scriptedEncounters ?? []).map((e) => e.flag))).toEqual(new Set(['GARLAND_DEFEATED']));
    expect((temple.keyItemGates ?? []).length).toBe(1);
  });
});

describe('PST: the Temple of the Past (S30)', () => {
  it('chests 4 / 4 / 3 / 4 / 3 / 2, each CHEST_PST_; the Masamune and the Dragon Armor once each; EXIT, no saving', () => {
    expect([f1, f2, f3, f4, f5, fc].map((m) => chests(m).length)).toEqual([4, 4, 3, 4, 3, 2]);
    const all = [f1, f2, f3, f4, f5, fc].flatMap(chests);
    for (const c of all) expect(c.chestFlag, c.id).toMatch(/^CHEST_PST_/);
    expect(all.filter((c) => c.chestItem === 'masamune').length).toBe(1);
    expect(all.filter((c) => c.chestItem === 'dragon_armor').length).toBe(1);
    for (const m of [f1, f2, f3, f4, f5, fc]) {
      expect(m.exit, m.id).toEqual({ map: 'overworld', entrance: 'temple' });
      expect(m.canSave, m.id).toBe(false);
    }
  });

  const REFIGHTS: Array<[MapData, string, string, string, string]> = [
    [f1, 'past_lich', 'PAST_LICH_DEFEATED', 'pst_lich_falls', 'past-temple-2'],
    [f2, 'past_ashen_queen', 'PAST_ASHEN_DEFEATED', 'pst_ashen_falls', 'past-temple-3'],
    [f3, 'past_drowned_sovereign', 'PAST_DROWNED_DEFEATED', 'pst_drowned_falls', 'past-temple-4'],
    [f4, 'past_hollow_seraph', 'PAST_SERAPH_DEFEATED', 'pst_seraph_falls', 'past-temple-5'],
    [f5, 'past_death_eye', 'DEATH_EYE_DEFEATED', 'pst_death_eye_falls', 'past-chaos'],
  ];

  it('each floor ends at one boss: its talk starts the fight, its cutscene sets its milestone, its stair on needs it', () => {
    for (const [m, id, flag, cut, next] of REFIGHTS) {
      const enc = (m.scriptedEncounters ?? []).filter((e) => e.isBoss);
      expect(enc.length, m.id).toBe(1);
      expect(enc[0].npc, m.id).toBe(id);
      expect(enc[0].flag, m.id).toBe(flag);
      expect(enc[0].postVictoryCutscene, m.id).toBe(cut);
      expect(npc(m, id).hideIf, m.id).toBe(flag);
      expect(cutscene(cut).filter((s) => s.type === 'set_flag').map((s) => s.flag), cut).toEqual([flag]);
      const on = stairTo(m, next);
      expect(on.length, m.id).toBeGreaterThan(0);
      for (const t of on) expect(t.requiredFlags, `${m.id} (${t.x}, ${t.y})`).toEqual([flag]);
      // only the stair reads the milestone: no gate on the floor does
      expect((m.keyItemGates ?? []).filter((g) => (g.requiredFlags ?? []).includes(flag)), m.id).toEqual([]);
      // the boss is reached on foot from the arrival
      expect(nextTo(m, npc(m, id), walk(m, at(m, 'arrival'), new Set((m.keyItemGates ?? []).map((g) => k(g.x, g.y))))) || m === f2, m.id).toBe(true);
    }
  });

  it('floor 1: twin stairs behind the high seat, west to the south arm and east to the sealed east arm', () => {
    expect(stairTo(f1, 'past-temple-2').map((t) => t.targetEntrance).sort()).toEqual(['arrival', 'arrival', 'east', 'east']);
    expect(stairTo(f2, 'past-temple-1').map((t) => t.targetEntrance).sort()).toEqual(['down', 'down', 'down_east', 'down_east']);
  });

  it('floor 2: the wards open the west arm, then the north arm; the east arm never joins the hub', () => {
    const gates = (f2.keyItemGates ?? []);
    const cells = (flag: string) => new Set(gates.filter((g) => g.requiredFlags?.includes(flag)).map((g) => k(g.x, g.y)));
    const hub = cells('PST_WARD_HUB'); const west = cells('PST_WARD_WEST');
    expect(hub.size).toBe(2);
    expect(west.size).toBe(2);
    const wardWest = npc(f2, 'ward_west'); const queen = npc(f2, 'past_ashen_queen');
    const start = at(f2, 'arrival');
    const shut = walk(f2, start, new Set([...hub, ...west]));
    expect(nextTo(f2, npc(f2, 'ward_hub'), shut)).toBe(true);
    expect(nextTo(f2, wardWest, shut)).toBe(false);
    const afterHub = walk(f2, start, west);
    expect(nextTo(f2, wardWest, afterHub)).toBe(true);
    expect(nextTo(f2, queen, afterHub)).toBe(false);
    expect(nextTo(f2, queen, walk(f2, start))).toBe(true);
    expect(npc(f2, 'ward_hub').cutscene).toEqual({ id: 'pst_ward_hub', onceFlag: 'PST_WARD_HUB' });
    expect(wardWest.cutscene).toEqual({ id: 'pst_ward_west', onceFlag: 'PST_WARD_WEST' });
    expect(walk(f2, start).has(k(...at(f2, 'east')))).toBe(false);
  });

  it('floor 3: the flood is deep water; the apse is reached only round the aisles and over the transepts', () => {
    const lake = [];
    for (let y = 0; y < f3.height; y++) for (let x = 0; x < f3.width; x++) if (baseTerrain(f3, x, y) === 11) lake.push(k(x, y));
    expect(lake.length).toBeGreaterThan(300);
    const reached = walk(f3, at(f3, 'arrival'));
    expect(lake.some((c) => reached.has(c))).toBe(false);
    expect(nextTo(f3, npc(f3, 'past_drowned_sovereign'), reached)).toBe(true);
  });

  it('floor 4: the spiral is one long way in (at least 150 steps to the well room); the Masamune lies deepest', () => {
    const d = dist(f4, at(f4, 'arrival'), at(f4, 'boss'));
    expect(d).toBeGreaterThanOrEqual(150);
    const blade = chests(f4).find((c) => c.chestItem === 'masamune')!;
    const depth = (c: MapNPC) => dist(f4, at(f4, 'arrival'), [c.x, c.y]);
    for (const c of chests(f4)) if (c !== blade) expect(depth(blade)).toBeGreaterThan(depth(c));
  });

  it('floor 5: two routes reach the guarded landing, each without the other', () => {
    const eye = npc(f5, 'past_death_eye');
    const west = new Set<string>(); const east = new Set<string>();
    for (let y = 6; y <= 26; y++) for (let x = 0; x < f5.width; x++) (x < 20 ? west : east).add(k(x, y));
    expect(nextTo(f5, eye, walk(f5, at(f5, 'arrival'), west)), 'by the east chambers').toBe(true);
    expect(nextTo(f5, eye, walk(f5, at(f5, 'arrival'), east)), 'by the west colonnade').toBe(true);
    expect((f5.inspect ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('the shrine: Chaos (its four forms) on the rim, no random battles; the ending sets CHAOS_DEFEATED and ends the game', () => {
    const enc = fc.scriptedEncounters ?? [];
    expect(enc).toHaveLength(1);
    expect(enc[0]).toMatchObject({ npc: 'past_chaos', enemyIds: ['chaos'], flag: 'CHAOS_DEFEATED', isBoss: true, postVictoryCutscene: 'ending' });
    expect(fc.battleBackgrounds?.default).toBe('rim');
    expect(fc.encounters ?? []).toEqual([]);
    expect(fc.transitions.map((t) => t.targetMap)).toEqual(['past-temple-5', 'past-temple-5']);
    const steps = cutscene('ending');
    expect(steps.filter((s) => s.type === 'set_flag').map((s) => s.flag)).toEqual(['CHAOS_DEFEATED']);
    expect(steps.find((s) => s.type === 'warp')).toMatchObject({ map: 'cornelia-castle-2f' });
    expect(steps[steps.length - 1].type).toBe('end_game');
    for (const m of [f1, f2, f3, f4, f5]) expect(m.battleBackgrounds?.default, m.id).toBe('fiend_hall');
  });
});
