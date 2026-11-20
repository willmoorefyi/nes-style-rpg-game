/**
 * FIR-T's stage walk (docs/WORLD_PLAN.md 6.4; S14) replayed through the progression model on the repository: from
 * Melmond's harbour (the entry; the ship moored at the ert_melmond dock), aboard the ship to Crescent, over the
 * causeway to the Circle, and the elder's canoe. Proof (a) holds for S14 in assume mode, and the full run puts S14
 * after S13 and before S15 and S16.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { createQuestContext, proofOrder } from '../../../src/progression/questProofs.js';

const world = loadQuestWorld();

describe('FIR-T stage walk (WORLD_PLAN 6.4)', () => {
  it('S14 is built, its walk sails to Crescent and meets the elder, and proof (a) holds in assume mode', () => {
    const s = world.stages.get('S14')!;
    expect(s.status).toBe('built');
    expect(s.walk).toEqual(['overworld:board:ship', 'overworld:warp:crescent', 'crescent:warp:crescent-circle',
      'crescent-circle:npc:sage_elder']);
    const [ex, ey] = world.maps.get('overworld')!.spots!.ert_s_melmond.at;   // Melmond's harbour (NW-5: by its spot)
    expect(s.entry).toMatchObject({ map: 'overworld', x: ex, y: ey, mode: 'walking' });
    const r = proofOrder(createQuestContext(world, { stage: 'S14' }));
    expect(r.failures.map((f) => f.message)).toEqual([]);
  });

  it('the town entry is built, opens after S10 and serves S14', () => {
    const t = world.quest.towns.find((x) => x.id === 'crescent')!;
    expect(t).toMatchObject({ status: 'built', opensAfter: ['S10'], bandStage: 'S14', kit: 'w_crescent' });
  });

  it('the full run plays S13 before S14, and S14 before S15 and S16: no failure of (a)', () => {
    const r = proofOrder(createQuestContext(world, {}));
    expect(r.failures.map((f) => f.message)).toEqual([]);
    // S15 and S16 run in parallel (WORLD 3.2): either may come first once both are built (INT-W2c)
    expect(r.line).toMatch(/S13 S14 .*S15/);
    expect(r.line).toMatch(/S13 S14 .*S16/);
  });
});
