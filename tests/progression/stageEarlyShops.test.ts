/**
 * INT-W2a: proof (e) in `--stage` mode on the merged world (docs/WORLD_PLAN.md 6.0 (e), G5).
 * - The place cache must not depend on the order of the proofs: (b)'s runs with the ship parked at Pravoka once left a
 *   cached `step ...:ship` exit that (e)'s ship-less run reused (`EARLY dwarf talkable before S2` from S3 and S7).
 * - Before an ancestor P of the checked stage, the stages after P are withdrawn too and the party starts at the new
 *   game's place (S10's entry at the hall mouth, S6's on Elfland's moor, are past S2).
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../src/progression/questData.js';
import { createQuestContext } from '../../src/progression/questProofs.js';
import { proofSkips } from '../../src/progression/questChecks.js';
import { proofEarlyShops, withdrawn } from '../../src/progression/questShops.js';

const world = loadQuestWorld();

describe('proof (e) in --stage mode', () => {
  it('S3: (e) gives the same answer after (b) as on its own', () => {
    const alone = proofEarlyShops(createQuestContext(world, { stage: 'S3' }));
    const ctx = createQuestContext(world, { stage: 'S3' });
    proofSkips(ctx);
    expect(proofEarlyShops(ctx).failures).toEqual(alone.failures);
    expect(alone.failures).toEqual([]);
  });

  it('S6 and S10: the dwarves (opensAfter S2) are not talkable before S2 from the stage entry', () => {
    for (const stage of ['S6', 'S10']) {
      expect(proofEarlyShops(createQuestContext(world, { stage })).failures, stage).toEqual([]);
    }
  });

  it('withdrawn: S2 and every ancestor of S10 after it; full mode withdraws only the stage', () => {
    const s2 = world.stages.get('S2')!;
    expect(withdrawn(createQuestContext(world, { stage: 'S10' }), s2).map((s) => s.id).sort())
      .toEqual(['S2', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'].filter((id) => world.stages.get(id)).sort());
    expect(withdrawn(createQuestContext(world), s2).map((s) => s.id)).toEqual(['S2']);
  });
});
