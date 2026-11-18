/**
 * WND-D2 walk (docs/WORLD_PLAN.md 6.4): S28's `walk` in quest.yaml replays through the verifier's model in assume mode
 * (`--stage S28`) from its `entry` on sky-castle-1f's south berth (where `mirage_ascent` sets the party down): proof
 * (a) replays the walk and fails on a step that is not available or a walk that ends without the grants; proof (b)
 * withholds each requirement. The negative half withholds SKY_FORTRESS_OPEN (the berth's ward stays shut).
 *
 * Proof (c) is not asserted here: leaving the castle (EXIT, or the berth's beam to mirage-3f) needs a way back up,
 * which is WND-D1's console (mirage-1f..3f, `mirage_ascent`); until it is built every state outside the castle is a
 * SOFTLOCK in assume mode. The castle's own soft-lock check is in wnd_d2_sites.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';
import { eventsGranting, saturate } from '../../../src/progression/questSaturate.js';

const world = loadQuestWorld({ root: process.cwd() });

describe('WND-D2: the S28 walk', () => {
  it('S28: the walk replays and proofs (a) and (b) hold in assume mode', () => {
    const s = world.stages.get('S28')!;
    expect(s.status).toBe('built');
    expect(s.walk[s.walk.length - 1]).toBe('sky-castle-5f:battle:hollow_seraph');
    expect(s.walk).toContain('sky-castle-3f:chest:chest_adamant');
    const ctx = createQuestContext(world, { stage: 'S28' });
    const res = runCoreProofs(ctx, new Set(['a', 'b']));
    for (const r of res) expect(r.failures.map((f) => f.message), `S28 (${r.proof})`).toEqual([]);
  });

  it('S28 grants WIND_CRYSTAL_LIT only with SKY_FORTRESS_OPEN; its 3F chest holds the adamant, which is S31\'s, not a grant', () => {
    const ctx = createQuestContext(world, { stage: 'S28' });
    expect(world.stages.get('S28')!.grants.items).toEqual([]);
    const sat = closure(ctx).view(ctx.start.place);
    expect(sat.flags.has('WIND_CRYSTAL_LIT')).toBe(true);
    expect(sat.items.has('adamant')).toBe(true);
    const flags = new Set([...ctx.start.flags].filter((f) => f !== 'SKY_FORTRESS_OPEN'));
    const bare = createQuestContext(world, { stage: 'S28' });
    // S27's console (cube and chime still held) would raise the fortress again: its grant stays withheld (INT-W2c)
    const shut = saturate(bare, { ...bare.start, flags }, { disabled: eventsGranting(bare, { flags: ['SKY_FORTRESS_OPEN'] }) });
    expect(shut.view(bare.start.place).flags.has('WIND_CRYSTAL_LIT')).toBe(false);
  });
});
