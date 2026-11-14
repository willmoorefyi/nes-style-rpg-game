import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { Texture } from 'pixi.js';
import { NPC, type NPCData } from '../../src/entities/NPC.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { validateMapData } from '../../src/core/schemaValidation.js';
import {
  WANDER_RADIUS, canWanderTo, manhattan, noWanderTiles, playerTooClose, updateWanderers, type WanderWorld,
} from '../../src/scenes/exploration/NpcWander.js';
import { tileKey } from '../../src/scenes/exploration/FieldTiles.js';
import { TerrainType, type MapData } from '../../src/types/index.js';
import { createMapData } from '../helpers/testUtils.js';

const walking = new WalkingMode();
const open: WanderWorld = { isWalkable: () => true, forbidden: new Set(), playerTiles: [], isOccupied: () => false };
const spawn = { x: 10, y: 10 };

/** Cycles through the given values, so wander timing and direction are fixed. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function wanderer(x: number, y: number, rng: () => number): NPC {
  const data: NPCData = { id: `n${x}_${y}`, x, y, sprite: 'villager', dialog: ['Hi'], wander: true };
  return new NPC(data, Texture.WHITE, undefined, rng);
}

/** Run the wander loop for `frames` frames, recording every tile each NPC stands on. */
function run(npcs: NPC[], frames: number, world: Omit<WanderWorld, 'isOccupied'>): Map<NPC, Set<string>> {
  const seen = new Map(npcs.map((n) => [n, new Set([tileKey(n.tileX, n.tileY)])]));
  for (let f = 0; f < frames; f++) {
    updateWanderers(npcs, 1, world);
    for (const n of npcs) seen.get(n)?.add(tileKey(n.tileX, n.tileY));
  }
  return seen;
}

describe('NPC wander rules (CT-2 / CT-3)', () => {
  it('stays within Manhattan radius 3 of the spawn tile', () => {
    expect(WANDER_RADIUS).toBe(3);
    expect(canWanderTo(open, spawn, 13, 10)).toBe(true);
    expect(canWanderTo(open, spawn, 12, 11)).toBe(true);
    expect(canWanderTo(open, spawn, 14, 10)).toBe(false);
    expect(canWanderTo(open, spawn, 12, 12)).toBe(false);
  });

  it('never enters unwalkable, forbidden, occupied or player tiles', () => {
    expect(canWanderTo({ ...open, isWalkable: (x) => x !== 11 }, spawn, 11, 10)).toBe(false);
    expect(canWanderTo({ ...open, forbidden: new Set(['11,10']) }, spawn, 11, 10)).toBe(false);
    expect(canWanderTo({ ...open, isOccupied: (x, y) => x === 11 && y === 10 }, spawn, 11, 10)).toBe(false);
    // the player's current tile and the tile they are stepping onto
    const player = { ...open, playerTiles: [{ x: 9, y: 10 }, { x: 11, y: 10 }] };
    expect(canWanderTo(player, spawn, 9, 10)).toBe(false);
    expect(canWanderTo(player, spawn, 11, 10)).toBe(false);
    expect(canWanderTo(player, spawn, 10, 11)).toBe(true);
  });

  it('holds still while the player is within distance 1', () => {
    expect(playerTooClose({ x: 5, y: 5 }, [{ x: 5, y: 6 }])).toBe(true);
    expect(playerTooClose({ x: 5, y: 5 }, [{ x: 6, y: 6 }])).toBe(false);
    expect(playerTooClose({ x: 5, y: 5 }, [{ x: 7, y: 5 }, { x: 6, y: 5 }])).toBe(true);   // walking up to it
  });

  it('forbids transitions, their walkable neighbours, gates, entrances, scripted encounters and noWander', () => {
    const map = createMapData({
      width: 10, height: 10,
      transitions: [{ x: 5, y: 0, targetMap: 'overworld', targetX: 0, targetY: 0 }],
      keyItemGates: [{ x: 2, y: 2, requiredFlag: 'BRIDGE_BUILT', message: 'Out.', permanent: false }],
      entrances: { door: [7, 7] },
      scriptedEncounters: [{ x: 8, y: 8, enemyIds: ['garland'], flag: 'G', isBoss: true }],
      noWander: [[1, 9]],
    });
    // inside the map, and (4,0) is a wall, so it is not a door approach
    const wall = (x: number, y: number) => x >= 0 && y >= 0 && x < 10 && y < 10 && !(x === 4 && y === 0);
    const tiles = noWanderTiles(map, wall);
    expect([...tiles].sort()).toEqual(['1,9', '2,2', '5,0', '5,1', '6,0', '7,7', '8,8'].sort());
  });

  it('NPC keeps its spawn tile and uses the injected RNG', () => {
    const npc = wanderer(4, 4, seq(0, 0.99));   // interval 120, then direction index 3: right
    expect(npc.spawn).toEqual({ x: 4, y: 4 });
    for (let i = 0; i < 120; i++) npc.update(1, () => true);
    expect(npc.tileX).toBe(5);
    expect(npc.spawn).toEqual({ x: 4, y: 4 });
  });

  it('NPC with hold set never starts a step', () => {
    const npc = wanderer(4, 4, seq(0.99));
    for (let i = 0; i < 1000; i++) npc.update(1, () => true, true);
    expect({ x: npc.tileX, y: npc.tileY }).toEqual({ x: 4, y: 4 });
  });
});

describe('wandering on a real collision map', () => {
  it('stays on foot-walkable ground (WalkingMode): no water and no counters', () => {
    // a 7x7 pond with one grass cross in the middle; legacy walkability (anything but Wall) let NPCs swim
    const width = 7;
    const collision = Array(width * width).fill(TerrainType.Water);
    for (let i = 1; i < 6; i++) { collision[3 * width + i] = TerrainType.Grass; collision[i * width + 3] = TerrainType.Grass; }
    collision[3 * width + 5] = 10;   // a shop counter
    const cm = new CollisionMap(createMapData({ width, height: width, collision }));
    const npc = wanderer(3, 3, seq(0.1, 0.3, 0.6, 0.9, 0.2, 0.7));
    const seen = run([npc], 20000, {
      isWalkable: (x, y) => cm.isWalkable(x, y, walking), forbidden: new Set(), playerTiles: [],
    });
    for (const k of seen.get(npc) ?? []) {
      const [x, y] = k.split(',').map(Number);
      expect(cm.getTerrainType(x, y)).toBe(TerrainType.Grass);
    }
    expect(seen.get(npc)?.size).toBeGreaterThan(1);
  });

  it('two NPCs never share a tile and never leave their radius', () => {
    const a = wanderer(10, 10, seq(0.15, 0.85, 0.4, 0.65, 0.05));
    const b = wanderer(11, 10, seq(0.55, 0.25, 0.95, 0.35));
    const world = { isWalkable: () => true, forbidden: new Set<string>(), playerTiles: [] };
    for (let f = 0; f < 20000; f++) {
      updateWanderers([a, b], 1, world);
      expect(a.tileX === b.tileX && a.tileY === b.tileY).toBe(false);
      expect(manhattan(a.spawn, { x: a.tileX, y: a.tileY })).toBeLessThanOrEqual(WANDER_RADIUS);
      expect(manhattan(b.spawn, { x: b.tileX, y: b.tileY })).toBeLessThanOrEqual(WANDER_RADIUS);
    }
  });

  it('does not move while the player stands beside it', () => {
    const npc = wanderer(10, 10, seq(0.15, 0.85, 0.4, 0.65));
    run([npc], 5000, { isWalkable: () => true, forbidden: new Set(), playerTiles: [{ x: 10, y: 11 }] });
    expect({ x: npc.tileX, y: npc.tileY }).toEqual({ x: 10, y: 10 });
  });
});

describe('Cornelia wanderers (compiled map)', () => {
  const raw = parse(readFileSync(join(__dirname, '../../assets/maps/ai/cornelia.yaml'), 'utf-8'));
  const map: MapData = validateMapData(raw);
  const cm = new CollisionMap(map);
  const isWalkable = (x: number, y: number) => cm.isWalkable(x, y, walking);
  const forbidden = noWanderTiles(map, isWalkable);

  /** Every tile a wanderer can reach from its spawn under the rules (other NPCs and the player ignored). */
  function reach(n: { x: number; y: number }): Set<string> {
    const world: WanderWorld = { isWalkable, forbidden, playerTiles: [], isOccupied: () => false };
    const seen = new Set([tileKey(n.x, n.y)]);
    const todo = [{ x: n.x, y: n.y }];
    while (todo.length) {
      const p = todo.pop()!;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (seen.has(tileKey(q.x, q.y)) || !canWanderTo(world, n, q.x, q.y)) continue;
        seen.add(tileKey(q.x, q.y));
        todo.push(q);
      }
    }
    return seen;
  }

  it('keeps the north-postern route (8,17)-(11,25) clear, through noWander', () => {
    for (let x = 8; x <= 11; x++) for (let y = 17; y <= 25; y++) expect(forbidden.has(tileKey(x, y))).toBe(true);
    const gardener = map.npcs.find((n) => n.id === 'gardener');
    expect(gardener?.wander).toBe(true);
    const tiles = reach(gardener!);
    for (const k of tiles) {
      const [x, y] = k.split(',').map(Number);
      expect(x >= 8 && x <= 11 && y >= 17 && y <= 25).toBe(false);
    }
  });

  it('no wanderer can reach water, a door, a door approach or an entrance', () => {
    const doors = new Set(map.transitions.map((t) => tileKey(t.x, t.y)));
    const entrances = new Set(Object.values(map.entrances ?? {}).map(([x, y]) => tileKey(x, y)));
    for (const npc of map.npcs.filter((n) => n.wander)) {
      for (const k of reach(npc)) {
        if (k === tileKey(npc.x, npc.y)) continue;
        const [x, y] = k.split(',').map(Number);
        expect(isWalkable(x, y)).toBe(true);
        expect(doors.has(k) || entrances.has(k)).toBe(false);
        expect(manhattan(npc, { x, y })).toBeLessThanOrEqual(WANDER_RADIUS);
      }
    }
  });
});
