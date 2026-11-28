/**
 * Pass EQ 7.3 (docs/EQUIP_FF1_PLAN.md): FF1 item use. A worn item with a `battleSpell` is listed in the battle Item
 * command as "<name> (worn)" (even with no consumable in the bag), and its use casts the spell for free: no charge,
 * not stopped by silence, the item stays worn. An item in the bag but not worn is not listed.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { wornCastCommand, wornSpellItems } from '../../src/battle/itemCast.js';
import { canOpenItems } from '../../src/scenes/battle/BattleListMenus.js';
import { ItemSelectionUI } from '../../src/ui/ItemSelectionUI.js';
import type { EnemyData, SpellData } from '../../src/types/index.js';
import { loadRealRegistries, visibleLabels } from '../helpers/realData.js';
import { testEnemy } from '../helpers/testUtils.js';

let SPELLS: SpellData[];
const spell = (id: string): SpellData => SPELLS.find((s) => s.id === id)!;
const goblins = (): EnemyData[] => [testEnemy({ id: 'gob', name: 'Goblin' }), testEnemy({ id: 'gob', name: 'Goblin' })];

function knightWith(...ids: string[]): Character {
  const c = new Character({ name: 'KNGHT', classData: ClassRegistry.getClass('knight')!, level: 20 });
  for (const id of ids) {
    const it = ItemRegistry.getItem(id)!;
    expect(c.equip(it.slot ?? (it.type === 'weapon' ? 'weapon' : 'armor'), it)).not.toBe(false);
  }
  return c;
}

/** One round: the knight uses the worn item, the enemies act; returns the battle. */
function useWorn(kn: Character, itemId: string): BattleStateMachine {
  const b = new BattleStateMachine({ party: [kn], enemies: goblins(), spells: SPELLS, inventory: new Inventory() }, () => 0.5);
  b.startBattle();
  b.advanceFromIntro();
  const item = ItemRegistry.getItem(itemId)!;
  expect(b.submitCommand(wornCastCommand('party_0', item, spell(item.battleSpell!)))).toBe(true);
  b.executeRound();
  return b;
}

describe('EQ 7.3: worn items cast their spell', () => {
  beforeAll(async () => {
    await loadRealRegistries();
    SPELLS = parse(readFileSync('assets/data/spells.yaml', 'utf-8')) as SpellData[];
    expect(SpellRegistry.getSpell('lit2')).toBeDefined();
  });

  it('with no consumables, a worn Zeus Gauntlet still opens the Item command and is listed "(worn)"', () => {
    const kn = knightWith('zeus_gauntlet');
    const bag = new Inventory();
    expect(canOpenItems(bag, () => 0)).toBe(false);
    expect(canOpenItems(bag, () => 0, kn)).toBe(true);
    const onWorn = vi.fn();
    const ui = new ItemSelectionUI({ inventory: bag, partyMembers: [], contentX: 0, contentY: 0, onSelect: vi.fn(),
      onCancel: vi.fn(), worn: wornSpellItems(kn).map((i) => i.id), onWorn });
    expect(ui.hasNoItems()).toBe(false);
    expect(ui.listedItemIds).toEqual(['worn:zeus_gauntlet']);
    expect(visibleLabels(ui)).toContain('Zeus Gauntlet (worn)');
  });

  it('an item in the bag but not worn is not a worn row', () => {
    const kn = knightWith();
    expect(wornSpellItems(kn)).toEqual([]);
  });

  it('using it casts LIT2 on every enemy, spends no charge and keeps the gauntlet worn, even silenced', () => {
    const kn = knightWith('zeus_gauntlet');
    kn.statusTracker.apply('silence', 99);
    const charges = [1, 2, 3].map((l) => kn.getSpellCharges(l));
    const b = useWorn(kn, 'zeus_gauntlet');
    const text = b.currentMessages.map((m) => m.text).join(' | ');
    expect(text).toContain('KNGHT uses the Zeus Gauntlet: LIT2!');
    expect(text).not.toContain('is silenced');
    expect(b.livingEnemies.length === 0 || b.livingEnemies.every((e) => e.currentHp < e.data.stats.hp)).toBe(true);
    expect([1, 2, 3].map((l) => kn.getSpellCharges(l))).toEqual(charges);
    expect(kn.getEquipped('hands')?.id).toBe('zeus_gauntlet');
  });

  it('the Defender casts RUSE on its wearer', () => {
    const kn = knightWith('defender');
    const b = useWorn(kn, 'defender');
    expect(b.currentMessages.map((m) => m.text).join(' | ')).toContain('KNGHT uses the Defender: RUSE!');
  });

  it('a command for an item the actor no longer wears does nothing but say so', () => {
    const kn = knightWith('zeus_gauntlet');
    const b = new BattleStateMachine({ party: [kn], enemies: goblins(), spells: SPELLS, inventory: new Inventory() }, () => 0.5);
    b.startBattle();
    b.advanceFromIntro();
    b.submitCommand(wornCastCommand('party_0', ItemRegistry.getItem('zeus_gauntlet')!, spell('lit2')));
    kn.unequip('hands');
    b.executeRound();
    expect(b.currentMessages.map((m) => m.text).join(' | ')).toContain('KNGHT no longer wears the Zeus Gauntlet!');
  });
});
