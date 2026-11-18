/**
 * Vehicles (docs/QUEST_PLAN.md 3.3 and 4.2, docs/WORLD_PLAN.md 2.6 and 5.2 W1-A): the ship sails Water only, boards
 * by a walking step onto it and disembarks only from a dock onto the adjacent land, staying parked there; the canoe
 * is an ability on River and Lake; the airship flies anywhere, takes off and lands on confirm, on free grass only.
 * The rules are fieldRules / fieldRulesVehicles; the field side is FieldVehicles with a real PlayerController on the
 * test-dock fixture (the browser scenario w1a_ship_dock).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Texture } from 'pixi.js';
import { TerrainType, type FieldMode, type MapData, type VehicleState } from '../../src/types/index.js';
import { canLand, fieldStep, modeAfterStep, type FieldState } from '../../src/systems/fieldRules.js';
import { vehiclesAfterStep, vehicleTerrainAllows } from '../../src/systems/fieldRulesVehicles.js';
import { parkedVehicles } from '../../src/systems/VehicleManager.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { PlayerController } from '../../src/entities/PlayerController.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { FieldVehicles, CANT_LAND, NO_CANOE_HINT, fieldModeOf } from '../../src/scenes/exploration/FieldVehicles.js';
import type { Game } from '../../src/core/Game.js';
import type { Direction } from '../../src/rendering/SpriteAnimation.js';
import { createMapData } from '../helpers/testUtils.js';

const dock = (): MapData => validateMapData(parse(readFileSync('assets/maps/test-dock.yaml', 'utf-8')));

const state = (mode: FieldMode = 'walking', items: string[] = [], vehicles: VehicleState[] = []): FieldState =>
  ({ flags: new Set(), items: new Set(items), mode, vehicles });
const SHIP: VehicleState = { type: 'ship', map: 'test-dock', x: 10, y: 6 };

describe('vehicles: the rules on the test-dock fixture', () => {
  const map = dock();

  it('has the jetty dock with the ship spawn (no flag), an island dock, a lake and a river', () => {
    expect(map.docks?.map((d) => [d.id, d.x, d.y])).toEqual([['jetty', 10, 6], ['island', 14, 8]]);
    expect(map.vehicles).toEqual([{ type: 'ship', x: 10, y: 6 }]);
    const col = new CollisionMap(map);
    expect(col.getTerrainType(2, 2)).toBe(TerrainType.Lake);
    expect(col.getTerrainType(3, 5)).toBe(TerrainType.River);
    expect(col.getTerrainType(10, 6)).toBe(TerrainType.Water);
  });

  it('a walking step from the jetty tip onto the parked ship boards it; without the ship the sea refuses', () => {
    expect(fieldStep(map, { x: 9, y: 6 }, { x: 10, y: 6 }, state('walking', [], [SHIP])))
      .toEqual({ ok: true, mode: 'ship', setFlags: [] });
    expect(fieldStep(map, { x: 9, y: 6 }, { x: 10, y: 6 }, state()).ok).toBe(false);
    expect(fieldStep(map, { x: 9, y: 6 }, { x: 9, y: 5 }, state('walking', [], [SHIP])).ok).toBe(false);
  });

  it('the ship sails Water only (not River or Lake) and keeps its mode', () => {
    expect(fieldStep(map, { x: 10, y: 6 }, { x: 11, y: 6 }, state('ship'))).toEqual({ ok: true, mode: 'ship', setFlags: [] });
    expect(fieldStep(map, { x: 8, y: 9 }, { x: 8, y: 10 }, state('ship')).mode).toBe('ship');
    expect(fieldStep(map, { x: 8, y: 10 }, { x: 7, y: 10 }, state('ship')).ok).toBe(false);   // the river mouth
    for (const t of [TerrainType.River, TerrainType.Lake, TerrainType.Grass]) expect(vehicleTerrainAllows('ship', t)).toBe(false);
  });

  it('disembarks only from a dock onto its land cell; any other shore refuses', () => {
    expect(fieldStep(map, { x: 10, y: 6 }, { x: 9, y: 6 }, state('ship'))).toEqual({ ok: true, mode: 'walking', setFlags: [] });
    expect(fieldStep(map, { x: 14, y: 8 }, { x: 15, y: 8 }, state('ship')).mode).toBe('walking');
    expect(fieldStep(map, { x: 14, y: 7 }, { x: 15, y: 7 }, state('ship')).ok).toBe(false);
    expect(fieldStep(map, { x: 8, y: 5 }, { x: 7, y: 5 }, state('ship')).ok).toBe(false);
  });

  it('the canoe item launches onto River and Lake, never the sea, and lands on any bank', () => {
    expect(fieldStep(map, { x: 4, y: 5 }, { x: 3, y: 5 }, state()).ok).toBe(false);
    expect(fieldStep(map, { x: 4, y: 5 }, { x: 3, y: 5 }, state('walking', ['canoe'])).mode).toBe('canoe');
    expect(fieldStep(map, { x: 3, y: 4 }, { x: 3, y: 3 }, state('canoe', ['canoe'])).mode).toBe('canoe');  // the lake
    expect(fieldStep(map, { x: 7, y: 10 }, { x: 8, y: 10 }, state('canoe', ['canoe'])).ok).toBe(false);    // the sea
    expect(fieldStep(map, { x: 7, y: 7 }, { x: 8, y: 7 }, state('walking', ['canoe'])).ok).toBe(false);   // the sea on foot
    expect(fieldStep(map, { x: 3, y: 5 }, { x: 2, y: 5 }, state('canoe', ['canoe'])).mode).toBe('walking');
  });

  it('the airship flies over every cell, ignores transitions and lands on free grass only', () => {
    const m = { ...map, transitions: [{ x: 16, y: 2, targetMap: 'x', targetX: 0, targetY: 0 }],
      keyItemGates: [{ x: 17, y: 2, message: 'Shut.', requiredItem: 'mystic_key' }],
      npcs: [{ id: 'n', x: 18, y: 2, sprite: 'merchant', dialog: ['Hi.'] }] } as MapData;
    expect(fieldStep(m, { x: 15, y: 2 }, { x: 16, y: 2 }, state('airship'))).toEqual({ ok: true, mode: 'airship', setFlags: [] });
    expect(fieldStep(m, { x: 0, y: 0 }, { x: 0, y: 1 }, state('airship')).ok).toBe(true);           // a mountain
    const fly = state('airship');
    expect(canLand(m, { x: 15, y: 2 }, fly)).toBe(true);
    expect(canLand(m, { x: 16, y: 3 }, fly)).toBe(false);   // forest
    expect(canLand(m, { x: 11, y: 4 }, fly)).toBe(false);   // sea
    expect(canLand(m, { x: 16, y: 2 }, fly)).toBe(false);   // a transition
    expect(canLand(m, { x: 17, y: 2 }, fly)).toBe(false);   // a gate
    expect(canLand(m, { x: 18, y: 2 }, fly)).toBe(false);   // an NPC
    expect(canLand(m, { x: 15, y: 2 }, state())).toBe(false); // not flying
  });

  it('a static NPC blocks every mode but the airship', () => {
    const m = createMapData({ width: 3, height: 1, collision: [2, 2, 2],
      npcs: [{ id: 'n', x: 1, y: 0, sprite: 'merchant', dialog: ['Hi.'] }] });
    expect(modeAfterStep(m, { x: 0, y: 0 }, { x: 1, y: 0 }, state('ship'))).toBeNull();
    expect(modeAfterStep(m, { x: 0, y: 0 }, { x: 1, y: 0 }, state('airship'))).toBe('airship');
  });
});

describe('vehicles: parking', () => {
  it('a vehicle left is parked where the step began; a boarded one is parked nowhere; the canoe item leaves none', () => {
    const at = (x: number, y: number) => ({ x, y });
    expect(vehiclesAfterStep([], 'm', 'ship', 'walking', at(10, 6), at(9, 6), false))
      .toEqual([{ type: 'ship', map: 'm', x: 10, y: 6 }]);
    expect(vehiclesAfterStep([{ type: 'ship', map: 'm', x: 10, y: 6 }], 'm', 'walking', 'ship', at(9, 6), at(10, 6), false))
      .toEqual([]);
    expect(vehiclesAfterStep([], 'm', 'canoe', 'walking', at(3, 5), at(4, 5), true)).toEqual([]);
    expect(vehiclesAfterStep([], 'm', 'airship', 'walking', at(5, 2), at(5, 2), false))
      .toEqual([{ type: 'airship', map: 'm', x: 5, y: 2 }]);
  });

  it('a known position wins over the spawn, on any map; the ridden vehicle and shut spawns are parked nowhere', () => {
    const spawns = [{ type: 'ship' as const, x: 1, y: 1, requiredFlag: 'BIKKE_DEFEATED' }, { type: 'canoe' as const, x: 2, y: 2 }];
    const has = (f: string) => f === 'BIKKE_DEFEATED';
    expect(parkedVehicles('ow', spawns, [], has)).toEqual([
      { type: 'ship', map: 'ow', x: 1, y: 1 }, { type: 'canoe', map: 'ow', x: 2, y: 2 }]);
    expect(parkedVehicles('ow', spawns, [], () => false)).toEqual([{ type: 'canoe', map: 'ow', x: 2, y: 2 }]);
    expect(parkedVehicles('ow', spawns, [{ type: 'ship', map: 'ow', x: 9, y: 9 }], has)[0]).toEqual({ type: 'ship', map: 'ow', x: 9, y: 9 });
    expect(parkedVehicles('ow', spawns, [{ type: 'ship', map: 'town', x: 9, y: 9 }], has).map((v) => v.type)).toEqual(['canoe']);
    expect(parkedVehicles('ow', spawns, [], has, 'ship').map((v) => v.type)).toEqual(['canoe']);
  });
});

/** A game double with what FieldVehicles reads, and a hero on the fixture driven by held directions. */
function field(opts: { vehicles?: VehicleState[]; items?: string[]; mode?: FieldMode } = {}) {
  const map = dock();
  let held: Direction | null = null;
  let confirm = false;
  const inventory = new Inventory();
  for (const i of opts.items ?? []) inventory.add(i, 1);
  const game = {
    gameFlags: new GameFlags(), inventory, fieldMode: opts.mode ?? 'walking', vehicles: opts.vehicles ?? [],
    input: { isPressed: (a: string) => a === held, isJustPressed: (a: string) => a === 'confirm' && confirm },
    events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  };
  const fv = new FieldVehicles(game as unknown as Game);
  fv.rebind();
  fv.setMap(map);
  const col = new CollisionMap(map);
  const player = new PlayerController({ startX: 6, startY: 6, texture: Texture.WHITE, collisionMap: col,
    input: game.input as unknown as Game['input'], events: game.events as unknown as Game['events'] });
  /** One frame as ExplorationScene runs it: the vehicles, the hero's move, then the field rules for a finished step. */
  const frame = (): void => {
    if (fv.tryBoard(player)) return;
    const was = player.isMoving;
    const from = { x: player.gridX, y: player.gridY };
    player.update(1000);
    if (!was && player.isMoving) {
      player.update(1000);
      const step = fieldStep(map, from, { x: player.gridX, y: player.gridY }, fv.fieldState(fieldModeOf(player.currentMode)));
      if (!step.ok) player.setPosition(from.x, from.y);
      else fv.afterStep(player, from, step);
    }
  };
  const walk = (dir: Direction, n = 1): void => {
    for (let i = 0; i < n; i++) { held = dir; frame(); held = null; frame(); }
  };
  const press = (): void => { confirm = true; frame(); confirm = false; };
  return { game, fv, player, walk, press, at: () => [player.gridX, player.gridY] };
}

describe('vehicles: the field (FieldVehicles, QUEST 4.2 browser row)', () => {
  it('board, sail, dock, disembark: the ship stays parked on the island dock', () => {
    const f = field();
    f.walk('right', 3);                         // the jetty to its tip (9, 6)
    expect(f.at()).toEqual([9, 6]);
    expect(f.fv.states).toEqual([SHIP]);
    f.walk('right');                            // onto the parked ship
    expect(f.at()).toEqual([10, 6]);
    expect(f.game.fieldMode).toBe('ship');
    expect(f.fv.states).toEqual([]);
    f.walk('right', 4);                         // sail to (14, 6)
    f.walk('down', 2);                          // the island dock (14, 8)
    expect(f.at()).toEqual([14, 8]);
    f.walk('up');
    f.walk('right');                            // (15, 7) is shore but not off a dock: refused
    expect(f.at()).toEqual([14, 7]);
    expect(f.game.fieldMode).toBe('ship');
    f.walk('down');
    f.walk('right');                            // disembark at the dock
    expect(f.at()).toEqual([15, 8]);
    expect(f.game.fieldMode).toBe('walking');
    expect(f.game.vehicles).toEqual([{ type: 'ship', map: 'test-dock', x: 14, y: 8 }]);
    expect(f.fv.states).toEqual([{ type: 'ship', map: 'test-dock', x: 14, y: 8 }]);
    f.walk('left');                             // and boards again from the land
    expect(f.game.fieldMode).toBe('ship');
  });

  it('the canoe item launches on the river and comes ashore on foot', () => {
    const f = field({ items: ['canoe'] });
    f.walk('left', 2);                          // (4, 6), the river is at x 3
    f.walk('left');
    expect(f.at()).toEqual([3, 6]);
    expect(f.game.fieldMode).toBe('canoe');
    f.walk('up', 2);                            // up the river to (3, 4), below the lake
    expect(f.game.fieldMode).toBe('canoe');
    f.walk('left');                             // the bank (2, 4)
    expect(f.game.fieldMode).toBe('walking');
    expect(f.game.vehicles).toEqual([]);
  });

  it('P3-11: pressing toward the river without a canoe gives the hint; with a canoe, or elsewhere, nothing', () => {
    const pressed = (f: ReturnType<typeof field>, dir: string | null): void => {
      f.game.input.isJustPressed = (a: string) => a === dir;
    };
    const f = field();
    f.walk('left', 2);                          // (4, 6), the river is at x 3
    expect(f.at()).toEqual([4, 6]);
    pressed(f, 'left');
    expect(f.fv.bankHint(f.player)).toBe(NO_CANOE_HINT);
    pressed(f, 'up');                           // dry land ahead: no line
    expect(f.fv.bankHint(f.player)).toBeNull();
    pressed(f, null);                           // no fresh press (a held key does not repeat the line)
    expect(f.fv.bankHint(f.player)).toBeNull();
    const withCanoe = field({ items: ['canoe'] });
    withCanoe.walk('left', 2);
    pressed(withCanoe, 'left');
    expect(withCanoe.fv.bankHint(withCanoe.player)).toBeNull();
    const sea = field();
    sea.walk('right', 3);                       // the jetty's tip: the sea ahead is the ship's, not the canoe's
    pressed(sea, 'up');
    expect(sea.fv.bankHint(sea.player)).toBeNull();
  });

  it('confirm on the parked airship takes off; over a forest it can\'t land; over grass it lands and parks', () => {
    const f = field({ vehicles: [{ type: 'airship', map: 'test-dock', x: 6, y: 6 }] });
    f.press();
    expect(f.game.fieldMode).toBe('airship');
    expect(f.game.vehicles).toEqual([]);
    f.walk('right', 10);                        // over the sea to (16, 6)
    f.walk('up', 3);                            // (16, 3), the forest
    expect(f.at()).toEqual([16, 3]);
    f.press();
    expect(f.game.events.emit).toHaveBeenCalledWith('showDialog', expect.objectContaining({ text: CANT_LAND }));
    expect(f.game.fieldMode).toBe('airship');
    f.walk('right');
    f.press();
    expect(f.game.fieldMode).toBe('walking');
    expect(f.game.vehicles).toEqual([{ type: 'airship', map: 'test-dock', x: 17, y: 3 }]);
  });

  it('an enter puts the hero back in the saved mode where it may stand; otherwise on foot', () => {
    const sea = field({ mode: 'ship' });
    sea.player.setPosition(11, 6);
    sea.walk('right');
    expect(sea.game.fieldMode).toBe('ship');
    expect(sea.at()).toEqual([12, 6]);
    const land = field({ mode: 'ship' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    land.walk('left');
    expect(land.game.fieldMode).toBe('walking');
    expect(land.at()).toEqual([5, 6]);
  });

  it('a set_vehicle step parks the vehicle at once (the airship rising)', () => {
    const f = field();
    f.fv.setVehicle({ type: 'airship', map: 'test-dock', x: 5, y: 2 });
    expect(f.fv.states.map((v) => v.type).sort()).toEqual(['airship', 'ship']);
    expect(f.game.vehicles).toEqual([{ type: 'airship', map: 'test-dock', x: 5, y: 2 }]);
  });
});
