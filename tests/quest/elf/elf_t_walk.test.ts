/**
 * ELF-T's stage walks (docs/WORLD_PLAN.md 6.4; S4, S8, S9) replayed through the progression model: S4 boards the
 * brig at Pravoka, lands at elf_port and walks into Elfheim; S8 wakes the prince with the herb; S9 opens the vault and
 * takes the TNT. Proofs (a)-(c) hold in assume mode, and without the herb (or the Mystic Key) the grant is out of reach.
 */
import { describe, expect, it } from 'vitest';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { closure, createQuestContext } from '../../../src/progression/questProofs.js';
import { runCoreProofs } from '../../../src/progression/questReport.js';

const world = loadQuestWorld({ root: process.cwd() });

describe('ELF-T: the stage walks', () => {
  for (const id of ['S4', 'S8', 'S9']) {
    it(`${id}: built, the walk replays and proofs (a)-(c) hold in assume mode`, () => {
      const s = world.stages.get(id)!;
      expect(s.status).toBe('built');
      expect(s.walk.length).toBeGreaterThan(0);
      const ctx = createQuestContext(world, { stage: id });
      for (const r of runCoreProofs(ctx, new Set(['a', 'b', 'c']))) {
        expect(r.failures.map((f) => f.message), `${id} (${r.proof})`).toEqual([]);
      }
    });
  }

  it('S8 grants PRINCE_AWAKE only with the herb; S9 grants the TNT only with the Mystic Key', () => {
    for (const [id, item, grant, isItem] of [['S8', 'herb', 'PRINCE_AWAKE', false], ['S9', 'mystic_key', 'tnt', true]] as const) {
      const ctx = createQuestContext(world, { stage: id });
      const has = (v: ReturnType<ReturnType<typeof closure>['view']>): boolean => (isItem ? v.items.has(grant) : v.flags.has(grant));
      expect(has(closure(ctx).view(ctx.start.place)), `${id} with ${item}`).toBe(true);
      const items = new Set([...ctx.start.items].filter((i) => i !== item));
      const bare = createQuestContext(world, { stage: id });
      expect(has(closure({ ...bare, start: { ...bare.start, items } }).view(bare.start.place)), `${id} without ${item}`).toBe(false);
    }
  });

  it('the town entry is built, opens after S2; its gold rule is measured at S6 (user ruling, INT-W2c)', () => {
    expect(world.quest.towns.find((t) => t.id === 'elfheim')).toMatchObject({ status: 'built', opensAfter: ['S2'],
      bandStage: 'S6', kit: 'w_elfheim' });
  });
});
