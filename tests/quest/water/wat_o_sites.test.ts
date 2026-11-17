/**
 * WAT-O's sites and stages (docs/WORLD_PLAN.md 4.0.1, 4.6, 6.4; WAT-O): the waterfall cave's automaton gives the cube
 * and plays `wat_cube_given` once, the caravan camp's five people and its `takeGold` trader, and the model walks of
 * S21 and S22 replayed in assume mode (`--stage`, from Cornelia with the airship): each ends with its grants, and
 * neither is reached without its requirements (proof (b)).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../../src/types/index.js';
import { loadQuestWorld } from '../../../src/progression/questData.js';
import { createQuestContext, proofOrder } from '../../../src/progression/questProofs.js';
import { proofSkips } from '../../../src/progression/questChecks.js';

const map = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const cutscenes = parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{
  id: string; steps: Array<{ type: string; flag?: string; text?: string }>;
}>;

describe('WAT-O: the waterfall cave', () => {
  const cave = map('waterfall-cave');

  it('is one floor of 28x20 or more, left on foot to wat_waterfall, EXIT to the same place', () => {
    expect(cave.width).toBeGreaterThanOrEqual(28);
    expect(cave.height).toBeGreaterThanOrEqual(20);
    expect(cave.transitions.every((t) => t.targetMap === 'overworld' && t.targetEntrance === 'wat_waterfall')).toBe(true);
    expect(cave.exit).toEqual({ map: 'overworld', entrance: 'wat_waterfall' });
  });

  it('the automaton gives the cube (CUBE_GIVEN) and then plays wat_cube_given once', () => {
    const a = cave.npcs.find((n) => n.id === 'automaton')!;
    expect(a).toMatchObject({ giftItem: 'cube', giftFlag: 'CUBE_GIVEN' });
    expect(a.cutscene).toEqual({ id: 'wat_cube_given', requiredFlag: 'CUBE_GIVEN', onceFlag: 'WAT_O_TWIN_TOLD' });
    const script = cutscenes.find((c) => c.id === 'wat_cube_given')!;
    expect(script.steps.some((s) => s.type === 'set_flag' && s.flag === 'WAT_O_TWIN_TOLD')).toBe(true);
    expect(script.steps.some((s) => /twin/i.test(s.text ?? ''))).toBe(true);
  });

  it('its two chests hold consumables only (no key item)', () => {
    const chests = cave.npcs.filter((n) => n.chestItem);
    expect(chests.map((c) => c.chestItem).sort()).toEqual(['ether', 'hi_potion']);
  });
});

describe('WAT-O: the caravan camp', () => {
  const camp = map('caravan-camp');

  it('holds five people, the trader among them, and is left on foot to wat_caravan', () => {
    expect(camp.npcs.length).toBe(5);
    expect(camp.transitions.every((t) => t.targetMap === 'overworld' && t.targetEntrance === 'wat_caravan')).toBe(true);
  });

  it('the trader sells the bottle for gold (takeGold, GAP-15; 4.6 default 5000)', () => {
    expect(camp.npcs.find((n) => n.id === 'trader')).toMatchObject({
      takeGold: 5000, giftItem: 'fairy_bottle', giftFlag: 'WAT_O_BOTTLE_BOUGHT',
    });
  });
});

// The model walks (6.4) in assume mode, as quest.yaml declares them.
const WALKS: Record<string, string[]> = { S21: ['waterfall-cave:gift:cube'], S22: ['caravan-camp:gift:fairy_bottle'] };

describe.each(Object.entries(WALKS))('WAT-O: the %s walk (assume mode)', (id, walk) => {
  const world = loadQuestWorld();
  const stage = world.stages.get(id)!;
  expect(stage.walk).toEqual(walk);
  const ctx = createQuestContext(world, { stage: id });

  it('replays to the stage\'s grants (proof (a), walk included)', () => {
    const r = proofOrder(ctx);
    expect(r.failures).toEqual([]);
  }, 120_000);

  it('is not reached without its requirements (proof (b))', () => {
    const r = proofSkips(ctx);
    expect(r.failures).toEqual([]);
  }, 120_000);
});
