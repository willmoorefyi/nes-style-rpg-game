/**
 * WAT-T walk (docs/WORLD_PLAN.md 6.4): S20's `walk` in quest.yaml replays through the verifier's model in assume mode
 * (`--stage`), from the stage's `entry` (on foot at Cornelia's south gate, the airship beside it): the party flies to
 * Onrac's meadow and walks in through the icon's door. The town entry `onrac` is built and opens after S17.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';

const world = loadQuestWorld({ root: process.cwd() });

describe('WAT-T: the S20 walk', () => {
  it('S20: the walk replays and proofs (a)-(c) hold in assume mode', () => {
    const s = world.stages.get('S20')!;
    expect(s.status).toBe('built');
    expect(s.walk).toEqual(['overworld:warp:onrac']);
    const ctx = createQuestContext(world, { stage: 'S20' });
    const res = runCoreProofs(ctx, new Set(['a', 'b', 'c']));
    for (const r of res) expect(r.failures.map((f) => f.message), `S20 (${r.proof})`).toEqual([]);
  });

  it('the town onrac is built and opens after S17', () => {
    const t = world.quest.towns.find((x) => x.id === 'onrac')!;
    expect(t.status).toBe('built');
    expect(t.opensAfter).toEqual(['S17']);
  });
});
