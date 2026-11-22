/**
 * ELF-D's Marsh Cave and stage S5 (docs/WORLD_PLAN.md 3.2, 4.0.2, 4.2, 6.4, D-W14), on the compiled maps and the real
 * quest data: B1 is a loop with two stairs down, one to each half of B2; B2's halves never meet on B2; the east half's
 * ledge is a one-way pit to B3; B3's boss lies north-west of the arrival at a path of at least 40; the chest counts
 * (B1 2, B2 4, B3 3); no chest cuts off a way on from any arrival (the compiler's chokepoint check walks from one
 * entrance only, so B2 checks it here); the crown comes only from the guard's postVictoryCutscene; then the S5 walk
 * and proofs (a)-(c) in assume mode (`--stage S5`; (b) withholds the ship).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { resolveNPCDialog, type MapData } from '../../../src/types/index.js';
import { npcOutcome, type FieldState } from '../../../src/systems/fieldRules.js';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';
import { bossPosition, stairGraph } from '../originalityChecks.js';
import { distances } from './marshPaths.js';

const load = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const [b1, b2, b3] = ['marsh-cave-b1', 'marsh-cave-b2', 'marsh-cave-b3'].map(load);
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>;
const links = (m: MapData, to: string): string[] => [...new Set(m.transitions.filter((t) => t.targetMap === to).map((t) => t.targetEntrance!))].sort();
const at = (m: MapData, e: string): [number, number] => m.entrances![e] as [number, number];
const cell = (m: MapData, to: string, ent: string): string => {
  const t = m.transitions.find((x) => x.targetMap === to && x.targetEntrance === ent)!;
  return `${t.x},${t.y}`;
};
const state = (flags: string[]): FieldState => ({ flags: new Set(flags), items: new Set(), vehicles: [], mode: 'walking' } as FieldState);

describe('ELF-D: the Marsh Cave floors', () => {
  it('B1 has two stairs down, the west one to B2 arrival and the east one to B2 arrival_east, and back', () => {
    expect(links(b1, 'marsh-cave-b2')).toEqual(['arrival', 'arrival_east']);
    expect(links(b2, 'marsh-cave-b1')).toEqual(['down', 'down_east']);
    expect(links(b1, 'overworld')).toEqual(['elf_marsh']);
    // B1's banks form one ring: both stairs are reachable from the way in
    const d = distances(b1, at(b1, 'arrival'));
    expect(d.has(cell(b1, 'marsh-cave-b2', 'arrival')) && d.has(cell(b1, 'marsh-cave-b2', 'arrival_east'))).toBe(true);
  });

  it('B2 west and east are not joined on B2; the west stair goes down to B3, the east ledge is a one-way pit', () => {
    const west = distances(b2, at(b2, 'arrival'));
    const east = distances(b2, at(b2, 'arrival_east'));
    expect(west.has(`${at(b2, 'arrival_east').join(',')}`)).toBe(false);
    expect(west.has(cell(b2, 'marsh-cave-b3', 'arrival'))).toBe(true);
    expect(east.has(cell(b2, 'marsh-cave-b3', 'pit'))).toBe(true);
    expect(east.has(cell(b2, 'marsh-cave-b3', 'arrival'))).toBe(false);
    expect(links(b3, 'marsh-cave-b2')).toEqual(['down']);         // nothing leads back up the pit
    expect(b3.entrances?.pit).toBeDefined();
    expect(stairGraph([b1, b2, b3]).branching).toBe(true);
  });

  it('B3: the boss lies north-west of the arrival at a path of at least 40; the pit lands in reach of the stair up', () => {
    const b = bossPosition(b3)!;
    expect(b.octant).toBe('NW');
    expect(b.path).toBeGreaterThanOrEqual(40);
    expect(distances(b3, at(b3, 'pit')).has(cell(b3, 'marsh-cave-b2', 'down'))).toBe(true);
  });

  it('chests: B1 2, B2 4, B3 3, all CHEST_ELF_D_*; none cuts off a way on from any arrival', () => {
    const chests = (m: MapData) => m.npcs.filter((n) => n.chestItem);
    expect([b1, b2, b3].map((m) => chests(m).length)).toEqual([2, 4, 3]);
    for (const m of [b1, b2, b3]) for (const c of chests(m)) expect(c.chestFlag).toMatch(/^CHEST_ELF_D_/);
    for (const m of [b1, b2, b3]) {
      for (const e of ['arrival', 'arrival_east', 'pit']) {
        if (!m.entrances?.[e]) continue;
        const open = { ...m, npcs: [] };
        const withNpcs = distances(m, at(m, e));
        for (const t of m.transitions) {
          const k = `${t.x},${t.y}`;
          if (distances(open, at(m, e)).has(k)) expect(withNpcs.has(k), `${m.id} ${e} -> ${t.targetMap}`).toBe(true);
        }
      }
    }
  });

  it('every floor: the EXIT spell leads to the fens, encounters from the S5 roster, the swamp_cave stage; B3 canSave false', () => {
    const roster = new Set(['ghast', 'scorpion', 'shadow', 'green_slime', 'crawler', 'gray_ooze', 'bloodbones', 'zombie', 'ghoul']);
    for (const m of [b1, b2, b3]) {
      expect(m.exit).toEqual({ map: 'overworld', entrance: 'elf_marsh' });
      const ids = (m.encounters ?? []).flatMap((e) => (e.groups ?? []).map((g) => g.id));
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every((i) => roster.has(i))).toBe(true);
      expect(m.battleBackgrounds?.default).toBe('swamp_cave');
    }
    expect(b3.canSave).toBe(false);
    expect(b3.entrances?.boss).toBeDefined();
  });
});

describe('P1-1-09 (FX-S): the hint before the keepers', () => {
  const knight = b3.npcs.find((n) => n.id === 'elf_d_last_escort');
  const lines = (flags: string[]): string => resolveNPCDialog(knight?.dialog ?? [], (f) => flags.includes(f)).join(' ');

  it('a knight of the escort on B3 recommends magic and potions before the fight, other words after it', () => {
    expect(knight).toBeDefined();
    expect(lines([])).toMatch(/mages? cast/i);
    expect(lines([])).toMatch(/potions/i);
    expect(lines([])).toMatch(/three keepers/i);
    expect(lines(['MARSH_GUARD_DEFEATED'])).not.toMatch(/potions/i);
  });

  it('every way from B3\'s arrivals to the bier passes the knight\'s row, and he blocks none of them', () => {
    const k = knight as NonNullable<typeof knight>;
    const bier = b3.npcs.find((n) => n.id === 'elf_d_bier') as NonNullable<typeof knight>;
    const row = new Set<string>();
    for (let x = 0; x < b3.width; x++) row.add(`${x},${k.y}`);
    for (const e of ['arrival', 'pit']) {
      expect(distances(b3, at(b3, e)).has(`${bier.x},${bier.y}`), e).toBe(true);
      expect(distances(b3, at(b3, e)).has(`${k.x},${k.y}`), e).toBe(true);
      expect(distances(b3, at(b3, e), row).has(`${bier.x},${bier.y}`), `${e} without the knight's row`).toBe(false);
    }
  });
});

describe('ELF-D: the guard and the crown', () => {
  it('talking to the bier starts piscodemon x3 once; elf_d_crown alone gives the crown (D-W14)', () => {
    const bier = b3.npcs.find((n) => n.id === 'elf_d_bier')!;
    expect(npcOutcome(bier, state([]), b3.scriptedEncounters ?? []).battle).toBe('MARSH_GUARD_DEFEATED');
    expect(npcOutcome(bier, state(['MARSH_GUARD_DEFEATED']), b3.scriptedEncounters ?? []).present).toBe(false);
    const enc = b3.scriptedEncounters!.find((e) => e.npc === 'elf_d_bier')!;
    expect(enc.enemyIds).toEqual(['piscodemon', 'piscodemon', 'piscodemon']);
    expect([enc.isBoss, enc.postVictoryCutscene]).toEqual([true, 'elf_d_crown']);
    const gives = cutscenes.filter((c) => c.steps.some((s) => s.type === 'give_item' && s.item === 'crown'));
    expect(gives.map((c) => c.id)).toEqual(['elf_d_crown']);
    for (const m of [b1, b2, b3]) expect(m.npcs.some((n) => n.chestItem === 'crown' || n.giftItem === 'crown')).toBe(false);
  });
});

describe('ELF-D: stage S5 in assume mode', () => {
  const world = loadQuestWorld({ root: process.cwd() });

  it('the walk replays; proofs (a)-(c) hold', () => {
    const s = world.stages.get('S5')!;
    expect(s.status).toBe('built');
    expect(s.walk[s.walk.length - 1]).toBe('marsh-cave-b3:battle:MARSH_GUARD_DEFEATED');
    const ctx = createQuestContext(world, { stage: 'S5' });
    for (const r of runCoreProofs(ctx, new Set(['a', 'b', 'c']))) expect(r.failures.map((f) => f.message), r.proof).toEqual([]);
  });

  it('the walk reaches the crown and MARSH_GUARD_DEFEATED (withholding the ship is proof (b), above)', () => {
    const ctx = createQuestContext(world, { stage: 'S5' });
    const v = closure(ctx).view(ctx.start.place);
    expect([v.flags.has('MARSH_GUARD_DEFEATED'), v.items.has('crown')]).toEqual([true, true]);
  });
});
