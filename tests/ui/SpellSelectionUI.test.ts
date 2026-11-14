/**
 * U13 (docs/FIX_PLAN_PENINSULA.md): Magic skips the spell-level step when only one level is usable. The spell menu
 * opens at once with the level's charges after each name, and its cancel goes straight back to the caller.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { BitmapText } from 'pixi.js';
import { SpellSelectionUI, type SpellSelectionConfig } from '../../src/ui/SpellSelectionUI.js';
import { Menu } from '../../src/ui/Menu.js';
import { makeMember, SPELLS } from '../helpers/balanceData.js';
import type { Character } from '../../src/entities/Character.js';
import type { InputManager } from '../../src/core/InputManager.js';
import type { DebugScenario } from '../../src/systems/DebugScenarioLoader.js';

const press = (action: string) => ({ isJustPressed: (a: string) => a === action, isPressed: () => false }) as unknown as InputManager;

function open(character: Character) {
  const onCancel = vi.fn();
  const onSelect = vi.fn();
  const config: SpellSelectionConfig = {
    character, actorId: 'party_0', spells: SPELLS, enemies: [{ id: 'enemy_0', name: 'Goblin' }],
    partyMembers: [{ name: 'W.MAG', id: 'party_0', hp: 20 }], contentX: 0, contentY: 0, onSelect, onCancel,
    onNeedTarget: vi.fn(),
  };
  return { ui: new SpellSelectionUI(config), onCancel, onSelect };
}

/** The row labels of the menu the player sees (the cursor glyph left out). */
function visibleLabels(ui: SpellSelectionUI): string[] {
  const menus = ui.children.filter((c): c is Menu => c instanceof Menu && c.visible);
  expect(menus).toHaveLength(1);
  return menus[0].children.filter((c): c is BitmapText => c instanceof BitmapText && c.text !== '▶').map(t => t.text);
}

/** A member of the `u_cmd_menu` scenario, built from its YAML entry. */
function scenarioMember(name: string): Character {
  const scenarios = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
  const m = scenarios.find(s => s.id === 'u_cmd_menu')!.party.find(p => p.name === name)!;
  const c = makeMember(m.class, m.level, { gear: m.equipment, spells: [] });
  for (const s of m.spells) c.learnSpell(s.id, s.level);
  c.restoreAllCharges();
  return c;
}

describe('U13: Magic with one usable spell level', () => {
  it('a Lv1 W.MAG with only CURE opens on the spell list ("CURE  2"), not the level list (old: "Lv1 (2)")', () => {
    const mage = makeMember('white_mage', 1, { gear: ['hammer', 'cloth'], spells: ['cure'] });
    expect(mage.getSpellCharges(1)).toBe(2);
    const { ui } = open(mage);
    expect(visibleLabels(ui)).toEqual(['CURE  2']);
  });

  it('cancel on that list calls onCancel once (back to the commands, no hidden level step)', () => {
    const { ui, onCancel } = open(makeMember('white_mage', 1, { gear: ['hammer', 'cloth'], spells: ['cure'] }));
    ui.update(press('cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(ui.children.filter(c => c instanceof Menu)).toHaveLength(0);
    ui.update(press('cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirm on CURE asks for a target, as before', () => {
    const mage = makeMember('white_mage', 1, { gear: ['hammer', 'cloth'], spells: ['cure'] });
    const onNeedTarget = vi.fn();
    const ui = new SpellSelectionUI({
      character: mage, actorId: 'party_0', spells: SPELLS, enemies: [], partyMembers: [], contentX: 0, contentY: 0,
      onSelect: vi.fn(), onCancel: vi.fn(), onNeedTarget,
    });
    ui.update(press('confirm'));
    expect(onNeedTarget).toHaveBeenCalledWith('cure', 'single_ally');
  });

  it("u_cmd_menu's Lv3 W.MAG reads CURE with its 3 charges", () => {
    const { ui } = open(scenarioMember('W.MAG'));
    expect(visibleLabels(ui)).toEqual(['CURE  3']);
  });

  it("u_cmd_menu's B.MAG (FIRE at Lv1, ICE at Lv2) still opens on the level list, and cancel from a level's spells goes back to it", () => {
    const { ui, onCancel } = open(scenarioMember('B.MAG'));
    const levels = visibleLabels(ui);
    expect(levels).toHaveLength(2);
    expect(levels[0]).toMatch(/^Lv1 \(\d+\)$/);
    expect(levels[1]).toMatch(/^Lv2 \(\d+\)$/);
    ui.update(press('confirm'));
    // the Lv1 spells carry their charges too, as on a single-level list ("CURE  3")
    expect(visibleLabels(ui)).toEqual([`FIRE  ${levels[0].match(/\((\d+)\)/)![1]}`]);
    ui.update(press('cancel'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(visibleLabels(ui)).toEqual(levels);
  });
});
