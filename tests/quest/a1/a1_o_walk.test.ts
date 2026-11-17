/**
 * A1-O's stage walks (docs/WORLD_PLAN.md 6.4; S1, S3, S7) replayed through the progression model on the repository:
 * each stage's `walk` (quest.yaml) is available in order from the state where its `after` stages are done, ends with
 * the stage's grants, and proof (a) holds for the stage in assume mode (`--stage`). S3 grants nothing: it is done
 * once the party stands in matoya-cave, reached from the mainland's north shore.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { createQuestContext, proofOrder } from '../../../src/progression/questProofs.js';

const world = loadQuestWorld();

describe('A1-O stage walks (WORLD_PLAN 6.4)', () => {
  it.each([
    ['S1', ['overworld:npc:bridge_worker_w']],
    ['S3', []],
    ['S7', ['matoya-cave:npc:matoya']],
  ])('%s is built, its walk is %j, and proof (a) holds in assume mode', (id, walk) => {
    const s = world.stages.get(id)!;
    expect(s.status).toBe('built');
    expect(s.walk).toEqual(walk);
    const r = proofOrder(createQuestContext(world, { stage: id }));
    expect(r.failures.map((f) => f.message)).toEqual([]);
  });

  it('the full run plays act 1, then the span, then Matoya: no failure of (a)', () => {
    const r = proofOrder(createQuestContext(world, {}));
    expect(r.failures.map((f) => f.message)).toEqual([]);
    expect(r.line).toMatch(/S0 S1 S3/);
  });
});
