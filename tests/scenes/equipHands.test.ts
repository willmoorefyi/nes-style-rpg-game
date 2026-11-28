/**
 * Pass EQ T1 (docs/EQUIP_FF1_PLAN.md D-EQ1, 8): the fifth slot on the Equip and Status screens and in the shop
 * comparison. The hand items arrive with T2; until then a fixture pair of gloves stands in.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { EquipScene } from '../../src/scenes/EquipScene.js';
import { equipmentLines } from '../../src/scenes/status/statusLines.js';
import { compareEquip } from '../../src/scenes/shopComparison.js';
import { CHAR_WIDTH, MENU_LINE_HEIGHT, WINDOW_PADDING } from '../../src/core/LayoutConstants.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { Game } from '../../src/core/Game.js';
import type { ItemData } from '../../src/types/index.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

const FIXTURE: ItemData = { id: 'eq_test_gloves', name: 'Test Gloves', type: 'armor', slot: 'hands', stats: { defense: 1 },
  weight: 1, price: 60, usableBy: ['warrior', 'knight'], description: 'Test gloves. DEF 1, evade -1.' };

async function registries(): Promise<void> {
  await loadRealRegistries();
  const items = [...(parse(readFileSync('assets/data/items.yaml', 'utf-8')) as ItemData[]), FIXTURE];
  ItemRegistry.reset();
  await ItemRegistry.init({ loadItems: async () => items } as unknown as DataLoader);
}

async function open(inv: string[]) {
  await registries();
  const w = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
  const inventory = new Inventory();
  for (const id of inv) inventory.add(id);
  const input = tapInput();
  const game = { input, inventory, party: { all: [w], get: (i: number) => (i === 0 ? w : undefined) }, scenes: { pop: () => undefined } };
  const scene = new EquipScene(game as unknown as Game);
  scene.enter();
  const tap = (a: Parameters<typeof input.tap>[0]): void => input.tap(a, () => scene.update(1));
  return { scene, tap, w };
}

describe('EQ T1: five slots on the Equip and Status screens', () => {
  it('the Equip slot list has five rows in order, ending "Hands: -"', async () => {
    const { scene, tap } = await open([]);
    tap('confirm'); // the member
    const labels = visibleLabels(scene.container).filter((l) => /^(Weapon|Body|Shield|Helmet|Hands): -$/.test(l));
    expect(labels).toEqual(['Weapon: -', 'Body: -', 'Shield: -', 'Helmet: -', 'Hands: -']);
  });

  it('the Hands row previews DEF and equips the gloves from the bag', async () => {
    const { scene, tap, w } = await open(['eq_test_gloves']);
    tap('confirm'); // member
    for (let i = 0; i < 4; i++) tap('down');
    tap('confirm'); // Hands: empty, so the cursor opens on the gloves
    expect(scene.statsLines.split('\n')[1]).toBe('DEF 0 -> 1  +1');
    tap('confirm');
    expect(w.getEquipped('hands')?.id).toBe('eq_test_gloves');
  });

  it('Status lists the hands slot', async () => {
    await registries();
    const w = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    w.equip('hands', ItemRegistry.getItem('eq_test_gloves')!);
    const lines = equipmentLines(w);
    expect(lines).toHaveLength(5);
    expect(lines[4]).toBe('Hands:  Test Gloves');
  });

  it('the shop comparison shows the gloves\' DEF gain', async () => {
    await registries();
    const w = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! });
    expect(compareEquip(w, ItemRegistry.getItem('eq_test_gloves')!, 'hands')).toMatchObject({ label: 'DEF', diff: 1 });
  });

  it('the widest hands label, "Hands: Silver Gauntlet", fits the slot window (560 px)', () => {
    expect('Hands: Silver Gauntlet'.length * CHAR_WIDTH + MENU_LINE_HEIGHT).toBeLessThanOrEqual(560 - 2 * WINDOW_PADDING);
  });
});
