/**
 * ERT-D walks (docs/WORLD_PLAN.md 6.4, 6.3 GT-17 / GT-18): S11's and S13's `walk` in quest.yaml replay through the
 * verifier's model in assume mode (`--stage`), from each stage's `entry` (S11 where S10 ends, beyond the canal; S13 at
 * the cavern's mouth): proofs (a)-(c) hold. Without CANAL_OPEN the ship never reaches the cavern's coast; without the rod in hand the seal holds (GT-17's gate); the
 * milestones come in their declared order (GT-18 is the verifier's milestone run).
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';
import { gateCheck, type FieldState } from '../../../src/systems/fieldRules.js';

const world = loadQuestWorld({ root: process.cwd() });

function grantsWithout(id: string, drop: { item?: string; flag?: string }): ReadonlySet<string> {
  const bare = createQuestContext(world, { stage: id });
  const items = new Set([...bare.start.items].filter((i) => i !== drop.item));
  // the TNT came out of the Elfheim vault (S9) and Nerrick took it (S10): the chest is open, else the closure re-opens
  // it and re-buys the canal (as ert_o_walk.test.ts does; INT-W2c)
  const flags = new Set([...bare.start.flags, 'CHEST_ELF_T_TNT'].filter((f) => f !== drop.flag));
  return closure({ ...bare, start: { ...bare.start, items, flags } }).view(bare.start.place).flags;
}

describe('ERT-D: the stage walks', () => {
  for (const id of ['S11', 'S13']) {
    it(`${id}: the walk replays and proofs (a)-(c) hold in assume mode`, () => {
      const s = world.stages.get(id)!;
      expect(s.status).toBe('built');
      expect(s.walk.length).toBeGreaterThan(1);
      const ctx = createQuestContext(world, { stage: id });
      for (const r of runCoreProofs(ctx, new Set(['a', 'b', 'c']))) expect(r.failures.map((f) => f.message), `${id} (${r.proof})`).toEqual([]);
    });
  }

  it('S11 grants VAMPIRE_DEFEATED only with CANAL_OPEN; S13 reaches its milestones, and the seal opens only with the rod', () => {
    const ctx = createQuestContext(world, { stage: 'S11' });
    expect(closure(ctx).view(ctx.start.place).flags.has('VAMPIRE_DEFEATED')).toBe(true);
    expect(grantsWithout('S11', { flag: 'CANAL_OPEN' }).has('VAMPIRE_DEFEATED')).toBe(false);
    const all = grantsWithout('S13', {});
    for (const f of ['EARTH_SEAL_BROKEN', 'EARTH_CAVE_COMPLETE', 'EARTH_CRYSTAL_LIT']) expect(all.has(f), f).toBe(true);
    // the rod is S12's (Sarda), so the closure finds it again; the seal itself opens only with it in hand
    const gate = world.maps.get('cavern-earth-b3')!.keyItemGates!.find((g) => g.flag === 'EARTH_SEAL_BROKEN')!;
    const fs = (items: string[]): FieldState => ({ flags: new Set<string>(), items: new Set(items), vehicles: [], mode: 'walking' } as FieldState);
    expect(gateCheck(gate, fs([])).open).toBe(false);
    expect(gateCheck(gate, fs(['rod'])).setFlags).toEqual(['EARTH_SEAL_BROKEN']);
  });

  it('S13 declares its milestones in the 3.2 order, and its walk sets them in that order', () => {
    const s = world.stages.get('S13')!;
    expect(s.milestones).toEqual(['EARTH_SEAL_BROKEN', 'EARTH_CAVE_COMPLETE', 'EARTH_CRYSTAL_LIT']);
    expect(s.walk).toEqual(['cavern-earth-b3:gate:EARTH_SEAL_BROKEN', 'cavern-earth-b5:battle:EARTH_CAVE_COMPLETE',
      'cavern-earth-b5:npc:ert_d_altar_shade']);
  });
});
