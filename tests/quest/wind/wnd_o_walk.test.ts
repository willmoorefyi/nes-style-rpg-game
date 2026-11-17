/**
 * WND-O: the S26 model walk (docs/WORLD_PLAN.md 6.4) and its no-skip rows (6.3 GT-29, GT-30), on the real world in
 * assume mode (`--stage S26`; S25 and the airship's S17 are other tranches' and assumed). The walk is quest.yaml's
 * `walk`: from Cornelia, fly to the mesa, talk to the elder. Its grants hold afterwards, and nothing of a later stage
 * (the Mirage's SKY_FORTRESS_OPEN) is reached; without LUFENIAN_LEARNED or without the airship the chime is out of
 * reach, and no Lufenian keeper is talkable before S25.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext, proofOrder } from '../../../src/progression/questProofs.js';
import { proofSkips } from '../../../src/progression/questChecks.js';
import { saturate } from '../../../src/progression/questSaturate.js';
import { withheld } from '../../../src/progression/questStates.js';
import { proofEarlyShops } from '../../../src/progression/questShops.js';
import { attachLate, loadLateData } from '../../../src/progression/questLateData.js';

const world = loadQuestWorld();
const ctx = attachLate(createQuestContext(world, { stage: 'S26' }), loadLateData());
const s26 = world.stages.get('S26')!;

describe('WND-O S26: the walk and the language gate', () => {
  it('S26 is built, its walk is the elder, and (a) replays it with no failure', () => {
    expect(s26.status).toBe('built');
    expect(s26.walk).toEqual(['lufenia-house-elder:npc:lufenia_elder']);
    expect(proofOrder(ctx).failures).toEqual([]);
  });

  it('after the walk the chime and CHIME_GIVEN hold, and SKY_FORTRESS_OPEN (S27) only by S27\'s assumed grant', () => {
    expect(closure(ctx).items.has('chime')).toBe(true);
    const later = new Set(['S27', 'S28', 'S29', 'S30', 'S31'].map((s) => `quest:stage:${s}`));
    const sat = saturate(ctx, ctx.start, { disabled: later });
    expect(sat.items.has('chime')).toBe(true);
    expect(sat.flags.has('CHIME_GIVEN')).toBe(true);
    expect(sat.flags.has('SKY_FORTRESS_OPEN')).toBe(false);
  });

  it('(b): without LUFENIAN_LEARNED, or without the airship, the chime is out of reach', () => {
    expect(proofSkips(ctx).failures).toEqual([]);
    const flags = new Set(ctx.start.flags);
    flags.delete('LUFENIAN_LEARNED');
    const sat = saturate(ctx, { ...ctx.start, flags }, { withhold: withheld({ flags: ['LUFENIAN_LEARNED'] }) });
    expect(sat.items.has('chime')).toBe(false);
    const grounded = saturate(ctx, { ...ctx.start, vehicles: ctx.start.vehicles.filter((v) => v.type !== 'airship') },
      { withhold: withheld({ vehicles: ['airship'] }) });
    expect(grounded.items.has('chime')).toBe(false);
  });

  it('(e): no Lufenian keeper is talkable before S25 (the keepers\' showIf)', () => {
    expect(proofEarlyShops(ctx).failures).toEqual([]);
  });
});
