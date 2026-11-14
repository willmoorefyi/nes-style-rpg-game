import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { slotOf } from '../../src/entities/EquipmentRules.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { EquipScene } from '../../src/scenes/EquipScene.js';
import { DebugScenarioLoader } from '../../src/systems/DebugScenarioLoader.js';
import type { Game } from '../../src/core/Game.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

const item = (id: string) => ItemRegistry.getItem(id)!;
const warrior = () => new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });

describe('MS-1: equipment slots', () => {
  it('slotOf: explicit slot, else weapon or body armour; consumables fit nothing', () => {
    expect(slotOf(item('rapier'))).toBe('weapon');
    expect(slotOf(item('chain_mail'))).toBe('armor');
    expect(slotOf(item('wooden_shield'))).toBe('shield');
    expect(slotOf(item('cap'))).toBe('helmet');
    expect(slotOf(item('potion'))).toBeNull();
  });

  it('chain mail cannot go in the shield or helmet slot, and a cap cannot go in the body slot', () => {
    const w = warrior();
    expect(w.equip('shield', item('chain_mail'))).toBe(false);
    expect(w.equip('helmet', item('chain_mail'))).toBe(false);
    expect(w.equip('armor', item('cap'))).toBe(false);
    expect(w.getEquipped('shield')).toBeNull();
    expect(w.getEquipped('helmet')).toBeNull();
    expect(w.getEquipped('armor')).toBeNull();
    expect(w.stats.defense).toBe(0);
    expect(w.equip('armor', item('chain_mail'))).toBeNull();
    expect(w.canEquipIn('helmet', item('cap'))).toBe(true);
  });

  it('EquipScene lists only items whose slot matches the slot being edited', () => {
    const w = warrior();
    const inventory = new Inventory();
    for (const id of ['chain_mail', 'wooden_shield', 'cap', 'rapier']) inventory.add(id);
    const input = tapInput();
    const game = {
      input, inventory,
      party: { all: [w], get: (i: number) => (i === 0 ? w : undefined) },
      scenes: { pop: vi.fn() },
    };
    const scene = new EquipScene(game as unknown as Game);
    scene.enter();
    const step = () => scene.update(1);
    input.tap('confirm', step);               // member
    input.tap('down', step);                  // weapon -> armor
    input.tap('down', step);                  // armor -> shield
    input.tap('confirm', step);               // edit shield
    const labels = visibleLabels(scene.container);
    expect(labels).toContain('Wooden Shield');
    expect(labels).not.toContain('Chain Mail');
    expect(labels).not.toContain('Cap');
  });

  it('DebugScenarioLoader equips weapons and body armour, not just slotted items', async () => {
    const added: Character[] = [];
    const game = {
      resetState: vi.fn(),
      party: { add: (c: Character) => { added.push(c); return true; }, setGold: vi.fn() },
      inventory: new Inventory(),
      scenes: { switchTo: vi.fn() },
      currentMapId: '', playerPosition: { x: 0, y: 0 }, pendingEntrance: null,
    };
    await new DebugScenarioLoader(game as unknown as Game).run({
      id: 't', name: 't', mode: 'field', map: 'cornelia', spawn: [1, 1], items: {}, gold: 0, enemies: [],
      party: [{ class: 'warrior', name: 'W', level: 1, equipment: ['rapier', 'chain_mail', 'wooden_shield', 'cap'], spells: [] }],
    });
    const w = added[0];
    expect(w.getEquipped('weapon')?.id).toBe('rapier');
    expect(w.getEquipped('armor')?.id).toBe('chain_mail');
    expect(w.getEquipped('shield')?.id).toBe('wooden_shield');
    expect(w.getEquipped('helmet')?.id).toBe('cap');
  });
});
