/**
 * FIR-D1 walk (docs/WORLD_PLAN.md 6.4): S15's `walk` in quest.yaml replays through the verifier's model in assume mode
 * (`--stage S15`) from its `entry` on Crescent's shore: proof (a) replays the walk and fails on a step that is not
 * available or a walk that ends without FIRE_CRYSTAL_LIT. The negative half withholds the canoe.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';

const world = loadQuestWorld({ root: process.cwd() });

describe('FIR-D1: the S15 walk', () => {
  it('S15: the walk replays and proofs (a)-(c) hold in assume mode', () => {
    const s = world.stages.get('S15')!;
    expect(s.status).toBe('built');
    expect(s.walk[s.walk.length - 1]).toBe('gurgu-b5:battle:ashen_queen');
    const ctx = createQuestContext(world, { stage: 'S15' });
    const res = runCoreProofs(ctx, new Set(['a', 'b', 'c']));
    for (const r of res) expect(r.failures.map((f) => f.message), `S15 (${r.proof})`).toEqual([]);
  });

  it('S15 grants FIRE_CRYSTAL_LIT only with the canoe', () => {
    const ctx = createQuestContext(world, { stage: 'S15' });
    expect(closure(ctx).view(ctx.start.place).flags.has('FIRE_CRYSTAL_LIT')).toBe(true);
    const items = new Set([...ctx.start.items].filter((i) => i !== 'canoe'));
    const bare = createQuestContext(world, { stage: 'S15' });
    const sat = closure({ ...bare, start: { ...bare.start, items } });
    expect(sat.view(bare.start.place).flags.has('FIRE_CRYSTAL_LIT')).toBe(false);
  });
});
