/**
 * NW-5 (docs/NATURAL_WORLD_PLAN.md 5.3): the cheap half of `--from-reset`, on the real data. Each stage's reset
 * state (its entry state at Cornelia on foot, the vehicles at their milestone spots: `relocate`) reaches every one of
 * the stage's required entrances (prewalk's, 3.8) that the stage's own quest.yaml entry reaches, with the stage's
 * vehicles and no event fired. The full proof (c) from every reset state is `npm run quest -- --strict --from-reset`.
 */
import { describe, it, expect } from 'vitest';
import { loadQuestWorld, stageOrder } from '../../src/progression/questData.js';
import { buildCatalog } from '../../src/progression/questCatalog.js';
import { assumedState, createModel } from '../../src/progression/questSearch.js';
import { reachedEntrances, relocate, requiredEntrances, resetPlace } from '../../src/progression/questReset.js';

const world = loadQuestWorld();
const model = createModel(world, buildCatalog(world));
const stages = stageOrder(world.quest);

describe('resetStates: every stage\'s reset state reaches its required entrances', () => {
  it('the reset place is Cornelia\'s arrival on the world map, on foot', () => {
    const p = resetPlace(model);
    expect(p).toEqual({ map: world.worldMap, x: world.maps.get(world.worldMap)!.entrances!.cornelia[0],
      y: world.maps.get(world.worldMap)!.entrances!.cornelia[1], mode: 'walking' });
  });

  it.each(stages)('%s', (id) => {
    const entry = assumedState(model, id);
    const reset = relocate(model, entry);
    expect(reset.place).toEqual(resetPlace(model));
    // the vehicles a reset gives stand on the world map at cells
    for (const v of reset.vehicles.filter((x) => x.map === world.worldMap)) expect(v.x >= 0 && v.y >= 0, v.type).toBe(true);
    const need = requiredEntrances(model, id);
    const fromEntry = reachedEntrances(model, entry, need);
    const fromReset = reachedEntrances(model, reset, need);
    expect([...fromEntry].filter((e) => !fromReset.has(e)), `${id}: reached from its entry, not after a reset`).toEqual([]);
  });

  it('a stage on the world map has its required entrances reachable from the reset state (from S2 on: the ship)', () => {
    const lost: string[] = [];
    for (const id of stages) {
      const need = requiredEntrances(model, id);
      const got = reachedEntrances(model, relocate(model, assumedState(model, id)), need);
      if (need.length && !got.size) lost.push(id);
    }
    expect(lost).toEqual([]);
  });
});
