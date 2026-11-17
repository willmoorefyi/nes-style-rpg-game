/**
 * ERT-O walks (docs/WORLD_PLAN.md 6.4): S10's and S12's `walk` in quest.yaml replay through the verifier's model in
 * assume mode (`--stage`), from each stage's `entry`: proof (a) replays the walk and fails on a step that is not
 * available or a walk that ends without the stage's grants. The negative halves withhold the TNT and the ruby.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';

const world = loadQuestWorld({ root: process.cwd() });

describe('ERT-O: the stage walks', () => {
  for (const id of ['S10', 'S12']) {
    it(`${id}: the walk replays and proofs (a)-(c) hold in assume mode`, () => {
      const s = world.stages.get(id)!;
      expect(s.status).toBe('built');
      expect(s.walk.length).toBeGreaterThan(1);
      const ctx = createQuestContext(world, { stage: id });
      const res = runCoreProofs(ctx, new Set(['a', 'b', 'c']));
      for (const r of res) expect(r.failures.map((f) => f.message), `${id} (${r.proof})`).toEqual([]);
    });
  }

  it('S10 grants CANAL_OPEN only with the TNT; S12 grants TITAN_FED and the rod only with the ruby', () => {
    for (const [id, item, grant] of [['S10', 'tnt', 'CANAL_OPEN'], ['S12', 'ruby', 'TITAN_FED']]) {
      const ctx = createQuestContext(world, { stage: id });
      expect(closure(ctx).view(ctx.start.place).flags.has(grant), `${id} with ${item}`).toBe(true);
      const items = new Set([...ctx.start.items].filter((i) => i !== item));
      const bare = createQuestContext(world, { stage: id });
      // ELF-T: the TNT came out of the Elfheim vault (S9), so its chest is already open; else the closure re-opens it
      const flags = new Set([...bare.start.flags, 'CHEST_ELF_T_TNT']);
      const sat = closure({ ...bare, start: { ...bare.start, items, flags } });
      expect(sat.view(bare.start.place).flags.has(grant), `${id} without ${item}`).toBe(false);
    }
  });
});
