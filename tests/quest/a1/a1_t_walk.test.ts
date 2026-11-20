/**
 * A1-T's stage walk (docs/WORLD_PLAN.md 6.4; S2) replayed through the progression model on the repository: from the
 * bridge's south stub (the entry; BRIDGE_BUILT is the way north), Bikke's fight in Pravoka, the brig's spawn at the
 * a1_pravoka dock, and boarding it from the land gate. Proof (a) holds for S2 in assume mode, and the full run puts
 * S2 after S1.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { createQuestContext, proofOrder } from '../../../src/progression/questProofs.js';

const world = loadQuestWorld();

describe('A1-T stage walk (WORLD_PLAN 6.4)', () => {
  it('S2 is built, its walk fights Bikke and boards the brig, and proof (a) holds in assume mode', () => {
    const s = world.stages.get('S2')!;
    expect(s.status).toBe('built');
    expect(s.walk).toEqual(['pravoka:battle:bikke', 'overworld:vehicle:ship', 'overworld:board:ship']);
    const [ex, ey] = world.maps.get('overworld')!.spots!.a1_s_bridge_foot.at;   // the bridge's south stub (NW-5: by its spot)
    expect(s.entry).toMatchObject({ map: 'overworld', x: ex, y: ey, mode: 'walking' });
    const r = proofOrder(createQuestContext(world, { stage: 'S2' }));
    expect(r.failures.map((f) => f.message)).toEqual([]);
  });

  it('the town entry is built, opens after S1 and serves S2', () => {
    const t = world.quest.towns.find((x) => x.id === 'pravoka')!;
    expect(t).toMatchObject({ status: 'built', opensAfter: ['S1'], bandStage: 'S2', kit: 'w_pravoka' });
  });

  it('the full run plays S1 before S2: no failure of (a)', () => {
    const r = proofOrder(createQuestContext(world, {}));
    expect(r.failures.map((f) => f.message)).toEqual([]);
    expect(r.line).toMatch(/S0 S1 (S3 )?S2/);
  });
});
