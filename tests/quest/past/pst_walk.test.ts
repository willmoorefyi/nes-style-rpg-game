/**
 * PST walks (docs/WORLD_PLAN.md 6.4): S29's and S30's `walk` in quest.yaml replay through the verifier's model in
 * assume mode from their `entry` (proof (a) fails on a step that is not available or a walk that ends without the
 * stage's grants). Proof (b) withholds each assumed grant and, for S30, each milestone's event (D-W12). Each crystal
 * flag and TIME_GATE_OPEN is withheld by (b) (the gate itself: pst_sites.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';

const world = loadQuestWorld({ root: process.cwd() });
const MILESTONES = ['PAST_LICH_DEFEATED', 'PAST_ASHEN_DEFEATED', 'PAST_DROWNED_DEFEATED', 'PAST_SERAPH_DEFEATED',
  'DEATH_EYE_DEFEATED', 'CHAOS_DEFEATED'];

describe('PST: the S29 and S30 walks', () => {
  it('S29: the walk replays and proofs (a) and (b) hold in assume mode', () => {
    const s = world.stages.get('S29')!;
    expect(s.status).toBe('built');
    expect(s.walk[s.walk.length - 1]).toBe('temple-of-fiends:cutscene:hour_keeper');
    const ctx = createQuestContext(world, { stage: 'S29' });
    for (const r of runCoreProofs(ctx, new Set(['a', 'b']))) expect(r.failures.map((f) => f.message), `S29 (${r.proof})`).toEqual([]);
  });

  it('S30: the walk replays, its milestones come in order, and proofs (a) and (b) hold in assume mode', () => {
    const s = world.stages.get('S30')!;
    expect(s.status).toBe('built');
    expect(s.milestones).toEqual(MILESTONES);
    expect(s.walk[s.walk.length - 1]).toBe('past-chaos:battle:past_chaos');
    const order = ['past_lich', 'past_ashen_queen', 'past_drowned_sovereign', 'past_hollow_seraph', 'past_death_eye', 'past_chaos'];
    const battles = s.walk.filter((w) => w.includes(':battle:')).map((w) => w.split(':')[2]);
    expect(battles).toEqual(order);
    const ctx = createQuestContext(world, { stage: 'S30' });
    for (const r of runCoreProofs(ctx, new Set(['a', 'b']))) expect(r.failures.map((f) => f.message), `S30 (${r.proof})`).toEqual([]);
  });

  it('S30\'s closure fights the six bosses in milestone order and ends with CHAOS_DEFEATED', () => {
    const ctx = createQuestContext(world, { stage: 'S30' });
    const sat = closure(ctx);
    expect(sat.view(ctx.start.place).flags.has('CHAOS_DEFEATED')).toBe(true);
    const fought = sat.path().filter((id) => /^past-(temple-\d|chaos):battle:/.test(id)).map((id) => id.split(':')[2]);
    expect(fought).toEqual(['past_lich', 'past_ashen_queen', 'past_drowned_sovereign', 'past_hollow_seraph',
      'past_death_eye', 'past_chaos']);
  });
});
