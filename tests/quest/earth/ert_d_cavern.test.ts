/**
 * ERT-D's Cavern of Earth B1-B5 (docs/WORLD_PLAN.md 4.0.2, 4.3, 6.3 GT-17 / GT-18, D-W14) on the compiled maps: the
 * canon stairs, the split gallery's two stairs (one into the walled-off ore annex), the one-way slide, the rod seal
 * in front of B3's stair down, the false stairwell's one-way pit into B4's pocket, the chest counts, the boss
 * floors (canSave false, a `boss` entrance), and the vampire, Sovereign and altar events through `npcOutcome`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../../src/types/index.js';
import { baseTerrain, npcOutcome, terrainAllows, type FieldState } from '../../../src/systems/fieldRules.js';

const ids = [1, 2, 3, 4, 5].map((i) => `cavern-earth-b${i}`);
const maps = Object.fromEntries(ids.map((id) => [id, parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData]));
const [b1, b2, b3, b4, b5] = ids.map((id) => maps[id]);
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>;
const steps = (id: string) => cutscenes.find((c) => c.id === id)!.steps;
const state = (flags: string[], items: string[] = []): FieldState => ({ flags: new Set(flags), items: new Set(items),
  vehicles: [], mode: 'walking' } as FieldState);
const npc = (m: MapData, id: string) => m.npcs.find((n) => n.id === id)!;
const targets = (m: MapData, to: string) => [...new Set(m.transitions.filter((t) => t.targetMap === to).map((t) => t.targetEntrance))].sort();

/** Walkable cells reached on foot from `from`, never stepping on `blocked` (a closed gate). */
function reach(m: MapData, from: [number, number], blocked: Array<[number, number]> = []): Set<string> {
  const no = new Set(blocked.map(([x, y]) => `${x},${y}`));
  const seen = new Set([`${from[0]},${from[1]}`]);
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [nx, ny] = [x + dx, y + dy];
      const k = `${nx},${ny}`;
      if (seen.has(k) || no.has(k) || nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      if (!terrainAllows('walking', baseTerrain(m, nx, ny))) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}
const at = (m: MapData, e: string): [number, number] => m.entrances![e] as [number, number];
const reaches = (m: MapData, from: string, to: string, blocked: Array<[number, number]> = []) => reach(m, at(m, from), blocked).has(at(m, to).join(','));

describe('ERT-D: the Cavern of Earth floors', () => {
  it('the canon stairs: each floor down to the next floor\'s arrival, and back; EXIT to the cave mouth', () => {
    for (let k = 0; k < 4; k++) {
      expect(targets(maps[ids[k]], ids[k + 1]), ids[k]).toContain('arrival');
      expect(targets(maps[ids[k + 1]], ids[k]), ids[k + 1]).toContain('down');
    }
    for (const m of [b1, b2, b3, b4, b5]) expect(m.exit, m.id).toEqual({ map: 'overworld', entrance: 'ert_earth_cave' });
    expect(targets(b1, 'overworld')).toEqual(['ert_earth_cave']);
  });

  it('chests per floor 3 / 4 / 3 / 4 / 2, each with its own CHEST_ERT_D_ flag; no key item in a chest', () => {
    const chests = [b1, b2, b3, b4, b5].map((m) => m.npcs.filter((n) => n.chestItem));
    expect(chests.map((c) => c.length)).toEqual([3, 4, 3, 4, 2]);
    const flags = chests.flat().map((n) => n.chestFlag!);
    expect(new Set(flags).size).toBe(flags.length);
    for (const f of flags) expect(f).toMatch(/^CHEST_ERT_D_/);
    expect(chests.flat().some((n) => ['ruby', 'rod'].includes(n.chestItem!))).toBe(false);
  });

  it('B1 splits: two stairs down to B2, the main way and the ore annex, which is walled off from the rest of B2', () => {
    expect(targets(b1, 'cavern-earth-b2')).toEqual(['annex', 'arrival']);
    expect(targets(b2, 'cavern-earth-b1')).toEqual(['annex_up', 'down', 'slide']);
    expect(reaches(b2, 'arrival', 'down')).toBe(true);
    expect(reaches(b2, 'arrival', 'annex')).toBe(false);
    expect(reaches(b1, 'arrival', 'down') && reaches(b1, 'arrival', 'annex_up')).toBe(true);
  });

  it('B2\'s slide is one-way: it lands in B1\'s alcove, and no B1 stair leads back to it', () => {
    expect(b2.transitions.some((t) => t.targetEntrance === 'slide')).toBe(true);
    expect(b1.transitions.some((t) => t.targetMap === 'cavern-earth-b2' && !['arrival', 'annex'].includes(t.targetEntrance!))).toBe(false);
    expect(reaches(b1, 'arrival', 'slide')).toBe(true);
  });

  it('B3: the rod seal (permanent, EARTH_SEAL_BROKEN) is the only way to the stair down; the boss lies east', () => {
    const gate = b3.keyItemGates!.find((g) => g.requiredItem === 'rod')!;
    expect([gate.permanent, gate.flag]).toEqual([true, 'EARTH_SEAL_BROKEN']);
    expect(reaches(b3, 'arrival', 'down')).toBe(true);
    expect(reaches(b3, 'arrival', 'down', [[gate.x, gate.y]])).toBe(false);
    expect(reaches(b3, 'arrival', 'boss', [[gate.x, gate.y]])).toBe(true);
    const enc = b3.scriptedEncounters![0];
    expect(enc.x - at(b3, 'arrival')[0]).toBeGreaterThan(Math.abs(enc.y - at(b3, 'arrival')[1]) * 2);
  });

  it('B4: a ring with two stairwells; the false one is a one-way pit into the pocket, which climbs back to the arrival', () => {
    expect(targets(b4, 'cavern-earth-b5')).toEqual(['arrival']);
    expect(targets(b4, 'cavern-earth-b4')).toEqual(['arrival', 'pocket']);
    expect(reaches(b4, 'arrival', 'pocket')).toBe(false);
    expect(reaches(b4, 'arrival', 'down')).toBe(true);
    const out = b4.transitions.filter((t) => t.targetMap === 'cavern-earth-b4' && t.targetEntrance === 'arrival');
    expect(out.every((t) => reach(b4, at(b4, 'pocket')).has(`${t.x},${t.y}`))).toBe(true);
  });

  it('B3 and B5 are the boss floors: canSave false, a boss entrance; the other floors may save', () => {
    expect([b1, b2, b3, b4, b5].map((m) => m.canSave)).toEqual([true, true, false, true, false]);
    for (const m of [b3, b5]) {
      expect(m.entrances?.boss, m.id).toBeDefined();
      expect(reaches(m, 'arrival', 'boss'), m.id).toBe(true);
    }
    expect(b5.battleBackgrounds?.default).toBe('throne_lich');
  });
});

describe('ERT-D: the vampire, the Rime Sovereign and the altar', () => {
  it('the vampire fights with three mummies until he falls; his cutscene alone gives the ruby (D-W14)', () => {
    const v = npc(b3, 'ert_d_vampire');
    expect(npcOutcome(v, state([]), b3.scriptedEncounters ?? []).battle).toBe('VAMPIRE_DEFEATED');
    expect(npcOutcome(v, state(['VAMPIRE_DEFEATED']), b3.scriptedEncounters ?? []).present).toBe(false);
    const enc = b3.scriptedEncounters!.find((e) => e.npc === 'ert_d_vampire')!;
    expect([enc.enemyIds, enc.isBoss, enc.postVictoryCutscene]).toEqual([['vampire', 'mummy', 'mummy', 'mummy'], true, 'ert_vampire_falls']);
    const s = steps('ert_vampire_falls');
    expect(s.filter((x) => x.type === 'give_item').map((x) => x.item)).toEqual(['ruby']);
    expect(s.filter((x) => x.type === 'set_flag').map((x) => x.flag)).toEqual(['VAMPIRE_DEFEATED']);
    const gives = cutscenes.filter((c) => c.steps.some((x) => x.type === 'give_item' && x.item === 'ruby'));
    expect(gives.map((c) => c.id)).toEqual(['ert_vampire_falls']);
  });

  it('the Sovereign fights with two earth elementals; his fall sets EARTH_CAVE_COMPLETE and shows the shade', () => {
    const enc = b5.scriptedEncounters!.find((e) => e.npc === 'ert_d_lich')!;
    expect([enc.enemyIds, enc.flag, enc.postVictoryCutscene]).toEqual([['lich', 'earth_elemental', 'earth_elemental'],
      'EARTH_CAVE_COMPLETE', 'ert_lich_falls']);
    expect(steps('ert_lich_falls').filter((x) => x.type === 'set_flag').map((x) => x.flag)).toEqual(['EARTH_CAVE_COMPLETE']);
    const shade = npc(b5, 'ert_d_altar_shade');
    expect(npcOutcome(shade, state(['EARTH_SEAL_BROKEN']), b5.scriptedEncounters ?? []).present).toBe(false);
    expect(npcOutcome(shade, state(['EARTH_SEAL_BROKEN', 'EARTH_CAVE_COMPLETE']), b5.scriptedEncounters ?? []).cutscene).toBe('ert_earth_crystal');
    expect(steps('ert_earth_crystal').filter((x) => x.type === 'set_flag').map((x) => x.flag)).toEqual(['EARTH_CRYSTAL_LIT']);
    expect(npcOutcome(npc(b5, 'ert_d_lich'), state(['EARTH_CAVE_COMPLETE']), b5.scriptedEncounters ?? []).present).toBe(false);
  });
});
