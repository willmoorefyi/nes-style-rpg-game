/**
 * FIR-D2's Ice Cavern and stage S16 (docs/WORLD_PLAN.md 3.2, 4.0.2, 4.4, 6.4, D-W14), on the compiled maps and the
 * real quest data: B1's pillar hall has three branches, its stair down in the north branch; B1's two pockets are cut
 * off from the hall and reached only by B2's cracked ice (one-way pits), each with a stair back down to B2's arrival;
 * B2's way down lies behind the ice shelf, which opens (the patch `fir_d2_shelf`) only on FIR_D2_SHELF, the flag Hesk's
 * cutscene sets; a safe way round the cracks reaches the shelf; B3's vault lies north-east of the arrival; chests
 * 3 / 4 / 3 and none cuts off a way on; the levistone comes only from the eye's postVictoryCutscene; then the S16 walk
 * and proofs (a)-(c) in assume mode (`--stage S16`; (b) withholds the canoe).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../../src/types/index.js';
import { npcOutcome, type FieldState } from '../../../src/systems/fieldRules.js';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';
import { bossPosition, deadEnds, stairGraph } from '../originalityChecks.js';
import { cellsTo, distances, key } from './icePaths.js';

const load = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const [b1, b2, b3] = ['ice-cavern-b1', 'ice-cavern-b2', 'ice-cavern-b3'].map(load);
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>;
const at = (m: MapData, e: string): [number, number] => m.entrances![e] as [number, number];
const ents = (m: MapData, to: string): string[] => [...new Set(m.transitions.filter((t) => t.targetMap === to).map((t) => t.targetEntrance!))].sort();
const state = (flags: string[]): FieldState => ({ flags: new Set(flags), items: new Set(), vehicles: [], mode: 'walking' } as FieldState);
const SHELF = new Set(['FIR_D2_SHELF']);
const reaches = (d: Map<string, number>, cells: string[]): boolean => cells.some((c) => d.has(c));

describe('FIR-D2: the Ice Cavern floors', () => {
  it('B1: the mouth leads to the stair down; the two pockets are not reached from the hall, and each has its stair back to B2', () => {
    expect(ents(b1, 'overworld')).toEqual(['fir_ice']);
    expect(ents(b1, 'ice-cavern-b2')).toEqual(['arrival']);
    const hall = distances(b1, at(b1, 'arrival'));
    const stairs = b1.transitions.filter((t) => t.targetMap === 'ice-cavern-b2').map((t) => key(t.x, t.y));
    const near = (c: string, [x, y]: [number, number]): boolean => Math.abs(Number(c.split(',')[0]) - x) <= 2 && Math.abs(Number(c.split(',')[1]) - y) <= 2;
    const down = stairs.filter((c) => near(c, at(b1, 'down')));
    expect(down.length).toBe(2);
    expect(down.every((c) => hall.has(c))).toBe(true);
    for (const p of ['pocket_w', 'pocket_e']) {
      expect(hall.has(key(...at(b1, p))), p).toBe(false);
      const d = distances(b1, at(b1, p));
      const mine = stairs.filter((c) => d.has(c) && !down.includes(c));
      expect(mine.length, p).toBe(2);
      expect(down.some((c) => d.has(c)), p).toBe(false);
    }
    expect(deadEnds(b1)).toBeGreaterThanOrEqual(2);
  });

  it('B2: every cracked cell is a one-way pit to a B1 pocket; nothing on B1 leads back to one', () => {
    const pits = b2.transitions.filter((t) => t.targetMap === 'ice-cavern-b1' && t.targetEntrance !== 'down');
    expect(pits.length).toBeGreaterThanOrEqual(12);
    expect(new Set(pits.map((t) => t.targetEntrance))).toEqual(new Set(['pocket_w', 'pocket_e']));
    expect(ents(b2, 'ice-cavern-b1')).toEqual(['down', 'pocket_e', 'pocket_w']);
    // B1's stairs all come up at B2's arrival: no stair lands on the cracks
    expect(b1.transitions.filter((t) => t.targetMap === 'ice-cavern-b2').every((t) => t.targetEntrance === 'arrival')).toBe(true);
    expect(stairGraph([b1, b2, b3]).branching).toBe(true);
  });

  it('B2: the stair down is behind the shelf; it opens only on FIR_D2_SHELF; a way round the cracks reaches it', () => {
    const pits = new Set(cellsTo(b2, 'ice-cavern-b1').filter((c) => !cellsTo(b2, 'ice-cavern-b1', 'down').includes(c)));
    const down = cellsTo(b2, 'ice-cavern-b3', 'arrival');
    expect(reaches(distances(b2, at(b2, 'arrival'), new Set(), pits), down)).toBe(false);
    expect(reaches(distances(b2, at(b2, 'arrival'), SHELF, pits), down)).toBe(true);
    const patch = b2.patches!.find((p) => p.id === 'fir_d2_shelf')!;
    expect(patch.flag).toBe('FIR_D2_SHELF');
    // Hesk is talkable on the safe way, and his cutscene is the one that sets the flag
    const hesk = b2.npcs.find((n) => n.id === 'fir_d2_hesk')!;
    expect(distances(b2, at(b2, 'arrival'), new Set(), pits).has(key(hesk.x, hesk.y))).toBe(true);
    expect(hesk.cutscene).toEqual({ id: 'fir_d2_shelf', onceFlag: 'FIR_D2_SHELF' });
    const sets = cutscenes.filter((c) => c.steps.some((s) => s.type === 'set_flag' && s.flag === 'FIR_D2_SHELF'));
    expect(sets.map((c) => c.id)).toEqual(['fir_d2_shelf']);
    // the inspect cells sit on the shelf, faced from the north band
    for (const c of b2.inspect ?? []) expect(patch.cells.some(([x, y]) => x === c.x && y === c.y)).toBe(true);
    expect(deadEnds(b2)).toBeGreaterThanOrEqual(2);
  });

  it('B3: the vault lies north-east of the arrival at a path of at least 40; nothing leads back but the stair', () => {
    const b = bossPosition(b3)!;
    expect(b.octant).toBe('NE');
    expect(b.path).toBeGreaterThanOrEqual(40);
    expect(ents(b3, 'ice-cavern-b2')).toEqual(['down']);
    expect(deadEnds(b3)).toBeGreaterThanOrEqual(2);
  });

  it('chests: B1 3, B2 4, B3 3, all CHEST_FIR_D2_*; none cuts off a way on from any arrival', () => {
    const chests = (m: MapData) => m.npcs.filter((n) => n.chestItem);
    expect([b1, b2, b3].map((m) => chests(m).length)).toEqual([3, 4, 3]);
    for (const m of [b1, b2, b3]) for (const c of chests(m)) expect(c.chestFlag).toMatch(/^CHEST_FIR_D2_/);
    for (const m of [b1, b2, b3]) for (const e of Object.keys(m.entrances ?? {})) {
      const open = distances(m, at(m, e), SHELF, new Set(), false);
      const withNpcs = distances(m, at(m, e), SHELF);
      for (const t of m.transitions) {
        const k = key(t.x, t.y);
        if (open.has(k)) expect(withNpcs.has(k), `${m.id} ${e} -> ${t.targetMap} ${k}`).toBe(true);
      }
    }
  });

  it('every floor: the EXIT spell leads to the hollow, encounters from the S16 roster, the ice_cave stage; B2, B3 canSave false', () => {
    const roster = new Set(['white_dragon', 'winter_wolf', 'mindflayer', 'ice_gigas', 'specter', 'remorazz', 'dark_wizard']);
    for (const m of [b1, b2, b3]) {
      expect(m.exit).toEqual({ map: 'overworld', entrance: 'fir_ice' });
      const ids = (m.encounters ?? []).flatMap((e) => (e.groups ?? []).map((g) => g.id));
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every((i) => roster.has(i))).toBe(true);
      expect(m.battleBackgrounds?.default).toBe('ice_cave');
    }
    expect([b1.canSave, b2.canSave, b3.canSave]).toEqual([true, false, false]);
    expect(b3.entrances?.boss).toBeDefined();
  });
});

describe('FIR-D2: the eye and the levistone', () => {
  it('touching the stone starts the eye, its warden and two rime-seers once; fir_evil_eye_falls alone gives the stone', () => {
    const stone = b3.npcs.find((n) => n.id === 'fir_d2_stone')!;
    expect(npcOutcome(stone, state([]), b3.scriptedEncounters ?? []).battle).toBe('EVIL_EYE_DEFEATED');
    expect(npcOutcome(stone, state(['EVIL_EYE_DEFEATED']), b3.scriptedEncounters ?? []).present).toBe(false);
    const enc = b3.scriptedEncounters!.find((e) => e.npc === 'fir_d2_stone')!;
    expect(enc.enemyIds).toEqual(['evil_eye', 'ice_gigas', 'dark_wizard', 'dark_wizard']);
    expect([enc.isBoss, enc.postVictoryCutscene]).toEqual([true, 'fir_evil_eye_falls']);
    const gives = cutscenes.filter((c) => c.steps.some((s) => s.type === 'give_item' && s.item === 'levistone'));
    expect(gives.map((c) => c.id)).toEqual(['fir_evil_eye_falls']);
    for (const m of [b1, b2, b3]) expect(m.npcs.some((n) => n.chestItem === 'levistone' || n.giftItem === 'levistone')).toBe(false);
  });
});

describe('FIR-D2: stage S16 in assume mode', () => {
  const world = loadQuestWorld({ root: process.cwd() });

  it('the walk replays; proofs (a)-(c) hold', () => {
    const s = world.stages.get('S16')!;
    expect(s.status).toBe('built');
    expect(s.walk[s.walk.length - 1]).toBe('ice-cavern-b3:battle:EVIL_EYE_DEFEATED');
    const ctx = createQuestContext(world, { stage: 'S16' });
    for (const r of runCoreProofs(ctx, new Set(['a', 'b', 'c']))) expect(r.failures.map((f) => f.message), r.proof).toEqual([]);
  });

  it('the closure reaches the levistone, EVIL_EYE_DEFEATED and FIR_D2_SHELF (withholding the canoe is proof (b))', () => {
    const ctx = createQuestContext(world, { stage: 'S16' });
    const v = closure(ctx).view(ctx.start.place);
    expect([v.flags.has('EVIL_EYE_DEFEATED'), v.items.has('levistone'), v.flags.has('FIR_D2_SHELF')]).toEqual([true, true, true]);
  });
});
