/**
 * The late field spells (W1-G hand-off, W1-B): EXIT goes to `MapData.exit`, WARP back one floor (the map behind the
 * stair back, at its `arrival`), both from the field menu whatever their school; LIF2 revives in full and CUR4 heals
 * in full in the field.
 */
import { describe, it, expect, vi } from 'vitest';
import type { MapData, SpellData } from '../../src/types/index.js';
import { castFieldSpell, isFieldSpell, isTravelSpell } from '../../src/systems/FieldSpellEffects.js';
import { exitTarget, stairBack, travelTarget, travelTo, warpTarget } from '../../src/systems/fieldTravel.js';
import { createMapData } from '../helpers/testUtils.js';
import { member } from '../helpers/npcActions.js';

const spell = (over: Partial<SpellData>): SpellData => ({
  id: 'x', name: 'X', level: 1, type: 'white', effect: 'heal', targeting: 'single_ally', power: 0, element: 'none',
  ...over,
} as SpellData);

const b1 = createMapData({ id: 'cave-b1', entrances: { arrival: [1, 1], down: [6, 6] },
  transitions: [{ x: 1, y: 0, targetMap: 'overworld', targetX: 40, targetY: 50 }, { x: 6, y: 7, targetMap: 'cave-b2', targetEntrance: 'arrival' }],
  exit: { map: 'overworld', entrance: 'cave' } });
const b2 = createMapData({ id: 'cave-b2', entrances: { arrival: [2, 2] },
  transitions: [{ x: 2, y: 1, targetMap: 'cave-b1', targetEntrance: 'down' }], exit: { map: 'overworld', entrance: 'cave' } });
const maps = new Map<string, MapData>([['cave-b1', b1], ['cave-b2', b2], ['overworld', createMapData({ id: 'overworld' })]]);
const load = async (id: string): Promise<MapData> => {
  const m = maps.get(id);
  if (!m) throw new Error(`no map ${id}`);
  return m;
};

describe('field travel: EXIT and WARP', () => {
  it('both are field spells, white and black alike', () => {
    expect(isTravelSpell({ effect: 'field_exit' })).toBe(true);
    expect(isFieldSpell(spell({ id: 'exit', effect: 'field_exit', targeting: 'self' }))).toBe(true);
    expect(isFieldSpell(spell({ id: 'warp', type: 'black', effect: 'field_warp', targeting: 'self' }))).toBe(true);
    expect(isFieldSpell(spell({ type: 'black', effect: 'damage' }))).toBe(false);
  });

  it('EXIT: the map\'s exit, or no effect without one', async () => {
    expect(exitTarget(b2)).toEqual({ map: 'overworld', entrance: 'cave' });
    expect(await travelTarget('field_exit', 'cave-b2', load)).toEqual({ map: 'overworld', entrance: 'cave' });
    expect(await travelTarget('field_exit', 'overworld', load)).toBeNull();
  });

  it('WARP: the floor behind the stair back, at its arrival', async () => {
    expect(stairBack(b2)?.targetMap).toBe('cave-b1');
    expect(warpTarget(b2, b1)).toEqual({ map: 'cave-b1', entrance: 'arrival' });
    expect(await travelTarget('field_warp', 'cave-b2', load)).toEqual({ map: 'cave-b1', entrance: 'arrival' });
  });

  it('WARP on the first floor leads outside, where its stair arrives; no stair back, no effect', async () => {
    expect(await travelTarget('field_warp', 'cave-b1', load)).toEqual({ map: 'overworld', x: 40, y: 50 });
    expect(await travelTarget('field_warp', 'overworld', load)).toBeNull();
    const far = createMapData({ id: 'far', entrances: { arrival: [0, 0] }, transitions: [{ x: 7, y: 7, targetMap: 'cave-b1', targetEntrance: 'down' }] });
    expect(stairBack(far)).toBeNull();
  });

  it('travelTo re-enters the field on the target', async () => {
    const game = { currentMapId: 'cave-b2', pendingEntrance: null as string | null, playerPosition: { x: 0, y: 0 },
      scenes: { switchTo: vi.fn().mockResolvedValue(undefined) } };
    await travelTo(game as never, { map: 'cave-b1', entrance: 'arrival' });
    expect(game).toMatchObject({ currentMapId: 'cave-b1', pendingEntrance: 'arrival' });
    await travelTo(game as never, { map: 'overworld', x: 40, y: 50 });
    expect(game).toMatchObject({ currentMapId: 'overworld', pendingEntrance: null, playerPosition: { x: 40, y: 50 } });
    expect(game.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });
});

describe('field LIF2 and CUR4', () => {
  it('LIF2 (revive, power 100) revives in full; LIFE (power 0) at 1 HP', () => {
    const a = member('A', 5, 0);
    const b = member('B', 5, 0);
    castFieldSpell(spell({ id: 'lif2', effect: 'revive', power: 100 }), a, [a]);
    castFieldSpell(spell({ id: 'life', effect: 'revive', power: 0 }), b, [b]);
    expect(a.currentHp).toBe(a.maxHp);
    expect(b.currentHp).toBe(1);
  });

  it('CUR4 (heal_full) is a field spell: full HP and every status but death; no effect on the fallen or the well', () => {
    const cur4 = spell({ id: 'cur4', level: 7, effect: 'heal_full' });
    expect(isFieldSpell(cur4)).toBe(true);
    const a = member('A', 5, 3);
    a.statusTracker.apply('poison');
    a.statusTracker.apply('stone');
    const r = castFieldSpell(cur4, a, [a]);
    expect(r.used).toBe(true);
    expect(a.currentHp).toBe(a.maxHp);
    expect(a.statusTracker.has('poison') || a.statusTracker.has('stone')).toBe(false);
    expect(castFieldSpell(cur4, a, [a])).toEqual({ used: false, messages: ['No effect.'] });
    const fallen = member('F', 5, 0);
    expect(castFieldSpell(cur4, fallen, [fallen]).used).toBe(false);
  });
});
