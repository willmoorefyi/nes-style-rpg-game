/**
 * Proof (h), the travel-requirement matrix (docs/WORLD_PLAN.md 6.2): the mini world's rows pass; each row's RED
 * fixture removes one wall, gate or patch crossing and that row fails; the dock rule of 2.6; the default rows of the
 * plan; and the repository (T0 checked, the rest pending until their regions are built).
 */
import { describe, expect, it } from 'vitest';
import { TerrainType } from '../../src/types/index.js';
import { loadQuestWorld, type QuestWorld } from '../../src/progression/questData.js';
import { createQuestContext } from '../../src/progression/questProofs.js';
import { attachLate, buildLateData } from '../../src/progression/questLateData.js';
import { proofTravel, travelRow } from '../../src/progression/questTravel.js';
import { DEFAULT_TRAVEL_ROWS } from '../../src/progression/questTravelRows.js';
import { editMap, setCells } from '../../src/progression/questMutateOps.js';
import { MINI_LATE, MINI_ROWS, miniContext } from './miniWorld.js';

const mini = miniContext();

function run(edit: (w: QuestWorld) => QuestWorld): string[] {
  const ctx = attachLate(createQuestContext(edit(mini.world)), buildLateData(MINI_LATE));
  return proofTravel(ctx).failures.map((f) => f.message);
}

const dropGate = (x: number, y: number) => (w: QuestWorld): QuestWorld => editMap(w, 'overworld', (m) => {
  m.keyItemGates = (m.keyItemGates ?? []).filter((g) => g.x !== x || g.y !== y);
});

describe('travelMatrix: the mini world', () => {
  it('every row passes, the basin rows included', () => {
    const r = proofTravel(mini);
    expect(r.failures).toEqual([]);
    expect(r.line).toBe('(h) travel matrix: OK  (6 rows, 2 basin rows; 8 checked, 0 pending)');
  });

  it('rows are cumulative and inherit their start: T5 holds the ship, the canal and the canoe', () => {
    const out = travelRow(mini, MINI_ROWS, MINI_ROWS.find((r) => r.id === 'T5')!);
    expect(out).toEqual({ row: 'T5', status: 'ok', failures: [], missing: [] });
  });
});

describe('travelMatrix: each row fails on its RED fixture', () => {
  it('T0: the bridge open from the start (its three gates gone)', () => {
    const msgs = run((w) => [[9, 3], [10, 3], [11, 3]].reduce((acc, [x, y]) => dropGate(x, y)(acc), w));
    expect(msgs).toContain('TRAVEL T0 reaches a1_pravoka');
  });

  it('T2 and B1: the canal open without its flag', () => {
    const msgs = run(dropGate(31, 11));
    expect(msgs).toContain('TRAVEL T2 reaches ert_melmond');
    expect(msgs).toContain('TRAVEL B1 ship docks a1_pravoka elf_port ert_dwarf ert_melmond fir_crescent (want a1_pravoka elf_port ert_dwarf)');
  });

  it('B1: an Aldi wall\'s water cut opened (W_isthmus)', () => {
    const msgs = run((w) => setCells(w, [[31, 9]], TerrainType.Water));
    expect(msgs.some((m) => m.startsWith('TRAVEL B1 ship docks '))).toBe(true);
  });

  it('T3: the river through Crescent\'s ring walkable (no canoe)', () => {
    expect(run(dropGate(37, 5))).toEqual(expect.arrayContaining(['TRAVEL T3 reaches fir_volcano', 'TRAVEL T3 reaches fir_ice']));
  });

  it('T6b: the waterfall river walkable', () => {
    expect(run(dropGate(21, 22))).toContain('TRAVEL T6b reaches wat_waterfall');
  });

  it('T2: a missing dock (elf_port and ert_dwarf gone) leaves Elfland unreached', () => {
    const msgs = run((w) => editMap(w, 'overworld', (m) => { m.docks = (m.docks ?? []).filter((d) => d.id === 'a1_pravoka' || d.basin === 'ocean'); }));
    expect(msgs).toContain('TRAVEL T2 cannot reach elf_elfheim');
  });

  it('the dock rule (2.6): a dock that is not allowed, or in the wrong basin', () => {
    const msgs = run((w) => editMap(w, 'overworld', (m) => {
      m.docks = [...(m.docks ?? []).map((d) => (d.id === 'ert_melmond' ? { ...d, basin: 'aldi' } : d)), { id: 'rogue', x: 20, y: 8, basin: 'aldi' }];
    }));
    expect(msgs).toEqual(expect.arrayContaining(['DOCK overworld (36,13) ert_melmond basin aldi not allowed',
      'DOCK overworld (20,8) rogue basin aldi not allowed']));
  });
});

describe('travelMatrix: the plan\'s rows (WORLD 6.2) and the repository', () => {
  it('T0-T10 with T6b, plus the two basin rows', () => {
    expect(DEFAULT_TRAVEL_ROWS.map((r) => r.id)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T6b', 'T7', 'T8', 'T9',
      'T10', 'B1', 'B2']);
    const t6 = DEFAULT_TRAVEL_ROWS.find((r) => r.id === 'T6')!;
    expect(t6).toMatchObject({ start: 'fir_desert', landing: true });
    expect(DEFAULT_TRAVEL_ROWS.find((r) => r.id === 'B2')!.docks).toHaveLength(5);
  });

  it('the repository: T0 holds on the act-1 map, the other rows wait for their regions (failures with --strict)', () => {
    const ctx = createQuestContext(loadQuestWorld());
    const r = proofTravel(ctx);
    expect(r.failures).toEqual([]);
    expect(r.line).toMatch(/^\(h\) travel matrix: OK {2}\(12 rows, 2 basin rows; \d+ checked, \d+ pending\)$/);
    expect(travelRow(ctx, DEFAULT_TRAVEL_ROWS, DEFAULT_TRAVEL_ROWS[0]).status).toBe('ok');
    const strict = proofTravel(createQuestContext(ctx.world, { strict: true }));
    expect(strict.failures.some((f) => /^TRAVEL T1 pending: /.test(f.message))).toBe(true);
  });
});
