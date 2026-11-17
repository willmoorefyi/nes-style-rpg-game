/**
 * ERT-T walk (docs/WORLD_PLAN.md 6.4): S25's `walk` in quest.yaml replays through the verifier's model in assume mode
 * (`--stage`), from the stage's `entry`: proof (a) replays the walk and fails on a step that is not available or a
 * walk that ends without the stage's grants. The negative half withholds the slab (GT-28's element).
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';

const world = loadQuestWorld({ root: process.cwd() });

describe('ERT-T: the S25 walk', () => {
  it('S25: the walk replays and proofs (a)-(c) hold in assume mode', () => {
    const s = world.stages.get('S25')!;
    expect(s.status).toBe('built');
    expect(s.walk).toEqual(['overworld:warp:melmond', 'melmond:warp:melmond-house-unne', 'melmond-house-unne:npc:ert_unne']);
    const ctx = createQuestContext(world, { stage: 'S25' });
    const res = runCoreProofs(ctx, new Set(['a', 'b', 'c']));
    for (const r of res) expect(r.failures.map((f) => f.message), `S25 (${r.proof})`).toEqual([]);
  });

  it('S25 grants LUFENIAN_LEARNED only with the slab', () => {
    const ctx = createQuestContext(world, { stage: 'S25' });
    expect(closure(ctx).view(ctx.start.place).flags.has('LUFENIAN_LEARNED'), 'with the slab').toBe(true);
    const items = new Set([...ctx.start.items].filter((i) => i !== 'slab'));
    const bare = createQuestContext(world, { stage: 'S25' });
    const sat = closure({ ...bare, start: { ...bare.start, items } });
    expect(sat.view(bare.start.place).flags.has('LUFENIAN_LEARNED'), 'without the slab').toBe(false);
  });

  it('the town melmond is built and opens after S10', () => {
    const t = world.quest.towns.find((x) => x.id === 'melmond')!;
    expect(t.status).toBe('built');
    expect(t.opensAfter).toEqual(['S10']);
  });
});
