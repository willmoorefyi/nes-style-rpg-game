/**
 * T4d formation attrition and spell numbers on the real engine (docs/FIX_PLAN_PENINSULA.md T4 §4.4, §4.5): a fresh
 * Lv1 party with the 400 G kit, Fight only, over the §1.6 tables of the compiled maps (T4e); FIRE and CURE in a real battle.
 */
import { describe, it, expect } from 'vitest';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { encounterStepFilter } from '../../src/scenes/exploration/FieldTiles.js';
import type { MapData } from '../../src/types/index.js';
import { runBattle, mulberry32 } from '../helpers/battlePolicies.js';
import {
  makeParty, makeMember, rollFormation, enemyCopy, SPELLS, START_KIT, ZONE_TABLES, OVERWORLD, TEMPLE, type Zone,
} from '../helpers/balanceData.js';

const N = 1000;

function freshWinRate(zone: Zone, level: number): number {
  let won = 0;
  for (let s = 1; s <= N; s++) {
    const rng = mulberry32(s * 31 + level);
    const r = runBattle(makeParty(level, 'start', false), rollFormation(zone, rng), SPELLS, 'careless', rng);
    if (r.outcome === 'victory') won++;
  }
  return won / N;
}

describe('T4d formations at Lv1 (fresh 400 G kit, Fight only)', () => {
  it('the fields are won >= 98 % of the time', () => {
    expect(freshWinRate('fields', 1)).toBeGreaterThanOrEqual(0.98);
  });

  it('the temple is won >= 97 % of the time (B9: smaller packs)', () => {
    expect(freshWinRate('temple', 1)).toBeGreaterThanOrEqual(0.97);
  });
});

/** Mean enemies per formation of a zone's table, from 2000 rolls of the real EncounterTable. */
function meanFormation(zone: Zone): number {
  const rng = mulberry32(7);
  let n = 0;
  for (let i = 0; i < 2000; i++) n += rollFormation(zone, rng).length;
  return n / 2000;
}

describe('B9: the temple table (docs/FIX_PLAN_PENINSULA.md R4b)', () => {
  it('rolls 2.3-2.8 enemies on average (old 3.26), never more than 4 skeletons or 5 enemies', () => {
    const mean = meanFormation('temple');
    expect(mean).toBeGreaterThanOrEqual(2.3);
    expect(mean).toBeLessThanOrEqual(2.8);
    for (const e of ZONE_TABLES.temple) {
      const most = (id?: string) => e.groups!.filter((g) => !id || g.id === id).reduce((s, g) => s + (g.max ?? g.min), 0);
      expect(most('skeleton')).toBeLessThanOrEqual(4);
      expect(most()).toBeLessThanOrEqual(5);
    }
  });

  it('a Lv2 party (400 G kit, sensible) survives 3 temple fights in a row: <= 1 % wipes, >= 85 % HP left', () => {
    const N3 = 400;
    let wipes = 0, left = 0;
    for (let s = 1; s <= N3; s++) {
      const rng = mulberry32(s * 97 + 3);
      const party = makeParty(2, 'start', true);
      let wiped = false;
      for (let b = 0; b < 3 && !wiped; b++) {
        wiped = runBattle(party, rollFormation('temple', rng), SPELLS, 'sensible', rng).outcome !== 'victory';
      }
      if (wiped) wipes++;
      else left += party.reduce((h, c) => h + Math.max(0, c.currentHp), 0) / party.reduce((h, c) => h + c.maxHp, 0);
    }
    expect(wipes / N3).toBeLessThanOrEqual(0.01);
    expect(left / N3).toBeGreaterThanOrEqual(0.85);
  });
});

/** Species a zone's table can roll. */
const species = (zone: Zone): Set<string> => new Set(ZONE_TABLES[zone].flatMap((e) => (e.groups ?? []).map((g) => g.id)));

describe('W5: each region has its own enemies', () => {
  it('no wolves in the temple; skeletons and no goblins on the temple approach', () => {
    expect(species('temple').has('wolf')).toBe(false);
    expect(species('approach').has('skeleton')).toBe(true);
    expect(species('approach').has('goblin')).toBe(false);
  });

  it('every region\'s species set differs from its neighbour\'s', () => {
    const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));
    for (const [a, b] of [['fields', 'approach'], ['approach', 'temple'], ['fields', 'east']] as Array<[Zone, Zone]>) {
      expect(same(species(a), species(b)), `${a} vs ${b}`).toBe(false);
    }
  });
});

type Cell = [number, number];
/** A BFS-shortest walk (the cells stepped on, not `from`) on the compiled collision; NPCs and scripted, gate and
 *  warp cells block except as the goal. */
function route(map: MapData, from: Cell, ...via: Cell[]): Cell[] {
  const col = new CollisionMap(map);
  const walk = new WalkingMode();
  const k = (x: number, y: number) => `${x},${y}`;
  const closed = new Set([...(map.npcs ?? []), ...(map.scriptedEncounters ?? []), ...(map.keyItemGates ?? []),
    ...map.transitions].map((c) => k(c.x, c.y)));
  const out: Cell[] = [];
  let at = from;
  for (const to of via) {
    const prev = new Map<string, Cell | null>([[k(...at), null]]);
    const queue: Cell[] = [at];
    while (queue.length && !prev.has(k(...to))) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n: Cell = [x + dx, y + dy];
        const goal = n[0] === to[0] && n[1] === to[1];
        if (prev.has(k(...n)) || (!goal && closed.has(k(...n))) || !col.isWalkable(n[0], n[1], walk)) continue;
        prev.set(k(...n), [x, y]);
        queue.push(n);
      }
    }
    if (!prev.has(k(...to))) throw new Error(`${map.id}: no route ${at} -> ${to}`);
    const seg: Cell[] = [];
    for (let c: Cell | null = to; c && k(...c) !== k(...at); c = prev.get(k(...c))!) seg.unshift(c);
    out.push(...seg);
    at = to;
  }
  return out;
}

/** Battles per trip along `steps` on the real EncounterSystem (fresh per trip, its countdown rolled by setRate). */
function battlesPerTrip(map: MapData, steps: Cell[], seeds = 2000): number[] {
  return Array.from({ length: seeds }, (_, i) => {
    const bus = new EventBus();
    const sys = new EncounterSystem(bus, mulberry32(i * 7919 + 1));
    sys.setStepFilter(encounterStepFilter(map));
    if (map.encounterRate) sys.setRate(map.encounterRate);
    sys.setEncounters(map.encounters ?? []);
    sys.setZones(map.encounterZones ?? []);
    let n = 0;
    sys.setOnEncounter(() => { n++; });
    sys.start();
    for (const [x, y] of steps) bus.emit('playerMove', { x, y });
    sys.stop();
    return n;
  });
}
const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;

describe('W4: route encounters (overworld rate {10, 22})', () => {
  const entrance = (id: string): Cell => OVERWORLD.entrances![id] as Cell;
  const temple = OVERWORLD.transitions.find((t) => t.targetMap === 'temple-of-fiends')!;

  it('W gate -> temple: at least one battle on >= 45 % of trips (old 12 %)', () => {
    const trips = battlesPerTrip(OVERWORLD, route(OVERWORLD, entrance('cornelia_west'), [temple.x, temple.y]));
    expect(trips.filter((n) => n >= 1).length / trips.length).toBeGreaterThanOrEqual(0.45);
  });

  it('S gate -> temple: 1.0-1.7 battles per trip (old 0.94)', () => {
    const m = mean(battlesPerTrip(OVERWORLD, route(OVERWORLD, entrance('cornelia'), [temple.x, temple.y])));
    expect(m).toBeGreaterThanOrEqual(1.0);
    expect(m).toBeLessThanOrEqual(1.7);
  });
});

describe('B9: temple routes (rate {12, 22})', () => {
  const entry = TEMPLE.entrances!.entry as Cell;
  const garland = TEMPLE.npcs!.find((n) => n.id === 'garland')!;
  const front: Cell = [garland.x, garland.y + 1];
  /** The cell beside each chest, on the hall side (the order a player sweeps them: west pair, then east pair). */
  const stands = TEMPLE.npcs!.filter((n) => n.chestItem).map((n): Cell => [n.x < 12 ? n.x + 1 : n.x - 1, n.y])
    .sort((a, b) => a[0] - b[0] || (a[0] < 12 ? a[1] - b[1] : b[1] - a[1]));

  it('entry -> the 4 chests -> Garland: 2-3 battles on average (old 4.0)', () => {
    expect(stands.length).toBe(4);
    const m = mean(battlesPerTrip(TEMPLE, route(TEMPLE, entry, ...stands, front)));
    expect(m).toBeGreaterThanOrEqual(2);
    expect(m).toBeLessThanOrEqual(3);
  });

  it('entry -> Garland: at most 0.35 battles on average (old 0.76)', () => {
    expect(mean(battlesPerTrip(TEMPLE, route(TEMPLE, entry, front)))).toBeLessThanOrEqual(0.35);
  });
});

describe('T4d spells in battle (real data)', () => {
  /** One round in which the Lv1 Black Mage casts `spellId` at enemy 0 or the White Mage cures member 0. */
  function castOnce(seed: number, enemyId: string, spellId: 'fire' | 'cure'): { dealt: number; healed: number } {
    const rng = mulberry32(seed);
    const party = ['warrior', 'thief', 'white_mage', 'black_mage'].map((c, i) => makeMember(c, 1, START_KIT[c], i));
    party[0].currentHp = 1; // the Warrior (35 HP) has room for any CURE
    const enemy = enemyCopy(enemyId);
    enemy.stats.hp = 999; // survives the spell, so the HP lost is the whole damage
    const bsm = new BattleStateMachine({ party, enemies: [enemy], spells: SPELLS, canRun: false }, rng);
    bsm.startBattle();
    bsm.advanceFromIntro();
    bsm.allEnemies[0].status.apply('sleep'); // it loses this round's turn, so only the spell changes any HP
    while (bsm.state === 'command_select') {
      const actorId = bsm.currentCommandActorId!;
      const actor = bsm.currentCommandActor!;
      if (spellId === 'fire' && actor === party[3]) bsm.submitCommand({ type: 'magic', actorId, targetId: 'enemy_0', spellId });
      else if (spellId === 'cure' && actor === party[2]) bsm.submitCommand({ type: 'magic', actorId, targetId: 'party_0', spellId });
      else bsm.submitCommand({ type: 'run', actorId });
    }
    bsm.prepareRound();
    let dealt = 0, healed = 0;
    while (bsm.actionQueueLength > 0 && !bsm.isOver) {
      const next = bsm.peekNextAction();
      const enemyHp = bsm.allEnemies[0].currentHp;
      const memberHp = party[0].currentHp;
      bsm.executeNextAction();
      if (next?.spellName) {
        dealt += enemyHp - bsm.allEnemies[0].currentHp;
        healed += party[0].currentHp - memberHp;
      }
    }
    return { dealt, healed };
  }

  it('a Lv1 Black Mage\'s FIRE does 15-60 to a Goblin (weak to fire), never more (EB-4)', () => {
    const dealt = Array.from({ length: 400 }, (_, i) => castOnce(i + 1, 'goblin', 'fire').dealt);
    expect(Math.max(...dealt)).toBeLessThanOrEqual(60);
    expect(Math.min(...dealt)).toBeGreaterThanOrEqual(15);
  });

  it('CURE heals 16-32 in battle', () => {
    const healed = Array.from({ length: 400 }, (_, i) => castOnce(i + 1, 'goblin', 'cure').healed);
    expect(Math.min(...healed)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...healed)).toBeLessThanOrEqual(32);
    expect(new Set(healed).size).toBeGreaterThan(5); // it varies
  });
});
