/**
 * The Citadel of Trials and Bahamut's cave and lair on the compiled maps (docs/WORLD_PLAN.md 4.0.2, 4.5; ORD-O): the
 * chests per floor, EXIT, the throne's arch (ORD_O_THRONE), the pad lattice (2 of 6 pads lead on, the north hall
 * only by pad), the trial hall's guardian (west of the arrival, inside the statues, the seal from its cutscene), the
 * one-way stair back to 1F, and Bahamut's trade (the seal for CLASS_UPGRADED, then the class change).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { DataLoader } from '../../../src/core/DataLoader.js';
import { ClassRegistry } from '../../../src/data/ClassRegistry.js';
import { Character } from '../../../src/entities/Character.js';
import { baseTerrain, terrainAllows } from '../../../src/systems/fieldRules.js';
import type { MapData, MapNPC } from '../../../src/types/index.js';
import { CLASSES, classOf } from '../../helpers/balanceData.js';
import { npcHost } from '../../helpers/npcActions.js';

const map = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const cutscene = (id: string): Array<Record<string, unknown>> =>
  (parse(readFileSync('assets/data/cutscenes.yaml', 'utf-8')) as Array<{ id: string; steps: Array<Record<string, unknown>> }>)
    .find((c) => c.id === id)!.steps;
const [f1, f2, f3, cave, lair] = ['citadel-1f', 'citadel-2f', 'citadel-3f', 'bahamut-cave', 'bahamut-lair'].map(map);

/** Cells reached on foot from `from` (gate cells in `closed` blocked), not stepping onto any transition. */
function walk(m: MapData, from: [number, number], closed: Set<string> = new Set()): Set<string> {
  const trans = new Set(m.transitions.map((t) => `${t.x},${t.y}`));
  const seen = new Set([`${from[0]},${from[1]}`]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(k) || closed.has(k)) continue;
      if (!terrainAllows('walking', baseTerrain(m, nx, ny))) continue;
      seen.add(k);
      if (!trans.has(k)) q.push([nx, ny]);
    }
  }
  return seen;
}
const at = (m: MapData, e: string): [number, number] => m.entrances![e];
const chests = (m: MapData): MapNPC[] => m.npcs.filter((n) => n.chestItem);
const stairTo = (m: MapData, target: string): string[] =>
  m.transitions.filter((t) => t.targetMap === target).map((t) => `${t.x},${t.y}`);

describe('ORD-O: the Citadel of Trials and Bahamut (S18, S19)', () => {
  it('chests 3 / 4 / 3 in the citadel and 1 / 0 below the isle, each flag CHEST_ORD_O_; EXIT to the anchors', () => {
    expect([f1, f2, f3, cave, lair].map((m) => chests(m).length)).toEqual([3, 4, 3, 1, 0]);
    for (const m of [f1, f2, f3, cave]) for (const c of chests(m)) expect(c.chestFlag, c.id).toMatch(/^CHEST_ORD_O_/);
    for (const m of [f1, f2, f3]) expect(m.exit).toEqual({ map: 'overworld', entrance: 'ord_citadel' });
    for (const m of [cave, lair]) expect(m.exit).toEqual({ map: 'overworld', entrance: 'ord_bahamut' });
    expect(f3.canSave).toBe(false);
  });

  it('1F: the arch to the west wing is shut until the throne is taken (ORD_O_THRONE, its cutscene)', () => {
    const gates = (f1.keyItemGates ?? []).map((g) => `${g.x},${g.y}`);
    expect((f1.keyItemGates ?? []).every((g) => g.requiredFlag === 'ORD_O_THRONE')).toBe(true);
    const up = stairTo(f1, 'citadel-2f');
    expect(up.some((k) => walk(f1, at(f1, 'arrival'), new Set(gates)).has(k))).toBe(false);
    expect(up.some((k) => walk(f1, at(f1, 'arrival')).has(k))).toBe(true);
    const steward = f1.npcs.find((n) => n.id === 'stone_steward')!;
    expect(steward.cutscene).toEqual({ id: 'ord_throne_wakes', onceFlag: 'ORD_O_THRONE' });
    expect(cutscene('ord_throne_wakes')).toContainEqual({ type: 'set_flag', flag: 'ORD_O_THRONE' });
  });

  it('2F: six pads in the lattice, two lead into the north hall; the hall and its stair are reached only by pad', () => {
    const own = f2.transitions.filter((t) => t.targetMap === 'citadel-2f');
    const hall = walk(f2, at(f2, 'hall_west'));
    const lattice = own.filter((t) => !hall.has(`${t.x},${t.y}`));
    expect(lattice).toHaveLength(6);
    expect(lattice.filter((t) => t.targetEntrance === 'ring')).toHaveLength(4);
    expect(lattice.filter((t) => t.targetEntrance !== 'ring').map((t) => t.targetEntrance).sort()).toEqual(['hall_east', 'hall_west']);
    const ring = walk(f2, at(f2, 'arrival'));
    for (const t of lattice) expect(ring.has(`${t.x},${t.y}`), `pad ${t.x},${t.y}`).toBe(true);
    const up = stairTo(f2, 'citadel-3f');
    expect(up.some((k) => ring.has(k))).toBe(false);
    expect(up.some((k) => hall.has(k))).toBe(true);
    expect(walk(f2, at(f2, 'hall_east')).has(at(f2, 'up').join(','))).toBe(true);
  });

  it('3F: the guardian and its keepers west of the arrival, inside the statues; the seal comes from its cutscene', () => {
    const boss = (f3.scriptedEncounters ?? []).find((e) => e.isBoss)!;
    expect(boss).toMatchObject({ npc: 'trial_guardian', flag: 'ORDEALS_GUARD_DEFEATED', postVictoryCutscene: 'ord_seal_won',
      enemyIds: ['dragon_zombie', 'king_mummy', 'king_mummy', 'king_mummy'] });
    expect(boss.x).toBeLessThan(at(f3, 'arrival')[0] - 15);
    expect(Math.abs(boss.y - at(f3, 'arrival')[1])).toBeLessThanOrEqual(2);
    expect(walk(f3, at(f3, 'arrival')).has(at(f3, 'boss').join(','))).toBe(true);
    const steps = cutscene('ord_seal_won');
    expect(steps).toContainEqual({ type: 'give_item', item: 'ordeal_seal' });
    expect(steps).toContainEqual({ type: 'set_flag', flag: 'ORDEALS_GUARD_DEFEATED' });
  });

  it('the stair behind the dais goes one way, down to 1F\'s court, once the guardian has fallen', () => {
    const chute = f3.transitions.filter((t) => t.targetMap === 'citadel-1f');
    expect(chute.length).toBeGreaterThan(0);
    for (const t of chute) expect(t).toMatchObject({ targetEntrance: 'chute', requiredFlag: 'ORDEALS_GUARD_DEFEATED' });
    expect(f1.transitions.some((t) => t.targetMap === 'citadel-3f')).toBe(false);
    expect(walk(f1, at(f1, 'chute')).has(at(f1, 'arrival').join(','))).toBe(true);
  });

  it('the cave leads down to the lair, where six dragons and Bahamut wait', () => {
    expect(stairTo(cave, 'bahamut-lair').some((k) => walk(cave, at(cave, 'arrival')).has(k))).toBe(true);
    const dragons = lair.npcs.filter((n) => n.id.startsWith('dragon_'));
    expect(dragons).toHaveLength(6);
    const bahamut = lair.npcs.find((n) => n.id === 'bahamut')!;
    expect(bahamut).toMatchObject({ requiredItem: 'ordeal_seal', action: 'classUpgrade', actionFlag: 'CLASS_UPGRADED',
      cutscene: { id: 'ord_bahamut_trial', onceFlag: 'CLASS_UPGRADED' }, hideIf: 'CLASS_UPGRADED' });
    const steps = cutscene('ord_bahamut_trial');
    expect(steps).toContainEqual({ type: 'take_item', item: 'ordeal_seal' });
    expect(steps).toContainEqual({ type: 'set_flag', flag: 'CLASS_UPGRADED' });
  });
});

describe('ORD-O: Bahamut in the field (FieldNpcActions)', () => {
  beforeAll(async () => {
    ClassRegistry.reset();
    await ClassRegistry.init({ loadClasses: async () => CLASSES } as unknown as DataLoader);
  });

  const bahamut = (): MapNPC => lair.npcs.find((n) => n.id === 'bahamut')!;
  const party = (): Character[] => ['warrior', 'black_mage'].map((c) => new Character({ name: c.toUpperCase(), classData: classOf(c), level: 25 }));

  it('with the seal: the cutscene plays, then the party is upgraded in the same talk', async () => {
    const h = npcHost([bahamut()], { party: party() });
    h.game.inventory.add('ordeal_seal', 1);
    h.actions.talk(h.entity('bahamut'));
    expect(h.lines[0].join(' ')).toContain('Lay it here');
    expect(h.actions.runPending()).toBe(true);
    // the (mocked) cutscene's own steps: it takes the seal and sets the flag before it resolves
    h.game.inventory.remove('ordeal_seal', 1);
    h.game.gameFlags.set('CLASS_UPGRADED');
    await vi.waitFor(() => expect(h.game.party.all.map((c) => c.classData.id)).toEqual(['knight', 'black_wizard']));
    expect(h.lines[h.lines.length - 1].every((l: string) => l.includes(' became '))).toBe(true);
  });

  it('without the seal: his line asks for it, and nothing changes', () => {
    const h = npcHost([bahamut()], { party: party() });
    h.actions.talk(h.entity('bahamut'));
    expect(h.lines[0].join(' ')).toContain('Bring me its seal');
    h.actions.runPending();
    expect(h.game.party.all.map((c) => c.classData.id)).toEqual(['warrior', 'black_mage']);
  });
});
