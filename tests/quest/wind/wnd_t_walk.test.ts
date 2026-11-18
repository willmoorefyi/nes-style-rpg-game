/**
 * WND-T walk (docs/WORLD_PLAN.md 6.4): S23's `walk` in quest.yaml replays through the verifier's model in assume mode
 * (`--stage`), from the stage's `entry` (Gaia's land gate, the airship on the bowl's floor): proof (a) replays the
 * walk and fails on a step that is not available or a walk that ends without the stage's grants. The negative half
 * withholds the fairy bottle (GT-26's element). Proof (c) runs in the CLI (`npm run quest -- --stage S23`; about
 * 243000 states, too slow for the unit suite).
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';

const world = loadQuestWorld({ root: process.cwd() });

describe('WND-T: the S23 walk', () => {
  it('S23: the walk replays and proofs (a) and (b) hold in assume mode', () => {
    const s = world.stages.get('S23')!;
    expect(s.status).toBe('built');
    expect(s.walk).toEqual(['overworld:warp:gaia', 'gaia:warp:gaia-spring', 'gaia-spring:npc:gaia_spring_warden']);
    const ctx = createQuestContext(world, { stage: 'S23' });
    const res = runCoreProofs(ctx, new Set(['a', 'b']));
    for (const r of res) expect(r.failures.map((f) => f.message), `S23 (${r.proof})`).toEqual([]);
  });

  it('S23 grants FAIRY_FREED and the Oxyale only with the bottle', () => {
    const ctx = createQuestContext(world, { stage: 'S23' });
    expect(ctx.start.items.has('fairy_bottle'), 'the start holds the bottle (S22)').toBe(true);
    const sat = closure(ctx).view(ctx.start.place);
    expect(sat.flags.has('FAIRY_FREED'), 'with the bottle').toBe(true);
    expect(sat.items.has('oxyale'), 'with the bottle').toBe(true);
    // without it, and with the caravan's trader (S22, the only other source of a bottle) gone from the camp
    const camp = world.maps.get('caravan-camp')!;
    const noTrader = { ...world, maps: new Map(world.maps).set('caravan-camp', { ...camp, npcs: [] }) };
    const items = new Set([...ctx.start.items].filter((i) => i !== 'fairy_bottle'));
    const bare = createQuestContext(noTrader, { stage: 'S23' });
    const view = closure({ ...bare, start: { ...bare.start, items } }).view(bare.start.place);
    expect(view.flags.has('FAIRY_FREED'), 'without the bottle').toBe(false);
    expect(view.items.has('oxyale'), 'without the bottle').toBe(false);
  });

  it('the town gaia is built, opens after S17 and serves S23\'s band with the w_gaia kit', () => {
    const t = world.quest.towns.find((x) => x.id === 'gaia')!;
    expect(t.status).toBe('built');
    expect(t.opensAfter).toEqual(['S17']);
    expect(t.bandStage).toBe('S23');
    expect(t.kit).toBe('w_gaia');
  });
});
