/**
 * WND-D1: the S27 model walk (docs/WORLD_PLAN.md 6.4) and its no-skip rows (6.3 GT-31, GT-32), on the real world in
 * assume mode (`--stage S27`; S21's cube, S26's chime and S17's airship are other tranches' and assumed). The walk is
 * quest.yaml's `walk`: fly to the sands, through the chime door, up the spiral and over the bridge, the console. Its
 * grant SKY_FORTRESS_OPEN holds afterwards (and the party stands in the sky castle), nothing of S28 is reached, and
 * without the chime or without the cube the flag is out of reach.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext, outOfScopeEvents, proofOrder } from '../../../src/progression/questProofs.js';
import { proofSkips } from '../../../src/progression/questChecks.js';
import { saturate } from '../../../src/progression/questSaturate.js';
import { withheld } from '../../../src/progression/questStates.js';
import { attachLate, loadLateData } from '../../../src/progression/questLateData.js';

const world = loadQuestWorld();
const ctx = attachLate(createQuestContext(world, { stage: 'S27' }), loadLateData());
const s27 = world.stages.get('S27')!;
// the later stages' events (S28 is built since WND-D2: its own events, not only its synthetic grant; INT-W2c)
const LATER = new Set([...['S28', 'S29', 'S30', 'S31'].map((s) => `quest:stage:${s}`), ...outOfScopeEvents(ctx, 'S27')]);

describe('WND-D1 S27: the walk, the chime door and the console', () => {
  it('S27 is built, its walk climbs to the console, and (a) replays it with no failure', () => {
    expect(s27.status).toBe('built');
    expect(s27.walk[s27.walk.length - 1]).toBe('mirage-3f:npc:mirage_console');
    expect(proofOrder(ctx).failures).toEqual([]);
  });

  it('after the walk SKY_FORTRESS_OPEN holds and the sky castle is reached; WIND_CRYSTAL_LIT (S28) is not', () => {
    expect(closure(ctx).flags.has('SKY_FORTRESS_OPEN')).toBe(true);
    const sat = saturate(ctx, ctx.start, { disabled: LATER });
    expect(sat.flags.has('SKY_FORTRESS_OPEN')).toBe(true);
    expect(sat.reachedMaps.has('sky-castle-1f')).toBe(true);
    expect(sat.flags.has('WIND_CRYSTAL_LIT')).toBe(false);
  });

  it('(b): without the chime, or without the cube, SKY_FORTRESS_OPEN is out of reach', () => {
    expect(proofSkips(ctx).failures).toEqual([]);
    for (const item of ['chime', 'cube']) {
      const items = new Set(ctx.start.items);
      items.delete(item);
      const sat = saturate(ctx, { ...ctx.start, items }, { disabled: LATER, withhold: withheld({ items: [item] }) });
      expect(sat.flags.has('SKY_FORTRESS_OPEN'), item).toBe(false);
      expect(sat.reachedMaps.has('mirage-1f'), `${item}: the vestibule is still reached`).toBe(true);
      expect(sat.reachedMaps.has('mirage-3f'), `${item}: the console room`).toBe(item === 'cube');
    }
  });
});
