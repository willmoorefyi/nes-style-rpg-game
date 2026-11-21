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
import { NW2_CASES, nw2States } from '../../src/progression/questResetNw2.js';

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

  it('NW2 (12): the v4 saves the fix relocates: S10 in dwarf-hall, S16 in ice-cavern-b1, S6 at the keep, each ship at its dock', () => {
    const got = nw2States(model);
    expect(got.map((g) => g.stage)).toEqual(NW2_CASES.map((c) => c.stage));
    for (const [i, g] of got.entries()) {
      const c = NW2_CASES[i];
      expect(g.problem, g.label).toBeNull();
      expect(g.state.place.map, g.label).toBe(c.map === 'overworld' ? world.worldMap : c.map);
      const d = world.maps.get(world.worldMap)!.docks!.find((x) => x.id === c.dock)!;
      expect(g.state.vehicles.filter((v) => v.type === 'ship'), g.label).toEqual([{ type: 'ship', map: world.worldMap, x: d.x, y: d.y }]);
    }
  });
});
