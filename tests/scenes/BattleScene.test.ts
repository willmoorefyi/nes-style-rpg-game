import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setMessageSpeed } from '../../src/core/Settings.js';
import { Container } from 'pixi.js';
import { BattleScene, COMMAND_CONFIRM_GUARD_FRAMES, type BattleSceneConfig } from '../../src/scenes/BattleScene.js';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import type { EnemyData, CharacterClassData } from '../../src/types/index.js';
import type { InputAction } from '../../src/core/InputManager.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import { Character } from '../../src/entities/Character.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { ItemRegistry } from '../../src/data/ItemRegistry.js';
import { createMockBattleSceneDeps, createMockInput, type MockInput } from '../helpers/testUtils.js';
import { ACTIVE_STEP } from '../../src/scenes/battle/ActiveHeroMarker.js';
import { BATTLE_MESSAGE_FONT, BATTLE_MESSAGE_HEIGHT, FLOAT_FONT, ENEMY_WINDOW, STRIP_Y } from '../../src/scenes/battle/BattleSceneTypes.js';
import { WINDOW_PADDING } from '../../src/core/LayoutConstants.js';
import { ItemSelectionUI } from '../../src/ui/ItemSelectionUI.js';
import { Window } from '../../src/ui/Window.js';
import { Menu } from '../../src/ui/Menu.js';
import { BitmapText } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { classOf, item, ITEMS, SPELLS } from '../helpers/balanceData.js';
import { slotOf } from '../../src/entities/EquipmentRules.js';
import type { DebugScenario } from '../../src/systems/DebugScenarioLoader.js';

const mockClassData: CharacterClassData = {
  id: 'fighter',
  name: 'Fighter',
  baseStats: { hp: 30, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 1, vitality: 2, luck: 1 },
  usableEquipment: ['sword', 'armor'],
  spellLevels: { white: 0, black: 0 },
};

const mockEnemy: EnemyData = {
  id: 'goblin',
  name: 'Goblin',
  stats: { hp: 10, strength: 5, agility: 4, intelligence: 2, vitality: 3, luck: 2, attack: 5, defense: 2, magicDefense: 1 },
  xpReward: 10,
  goldReward: 5,
  sprite: 'goblin.png',
};

function createConfig(): BattleSceneConfig {
  return {
    party: [new Character({ name: 'Hero', classData: mockClassData })],
    enemies: [mockEnemy],
  };
}

describe('BattleScene', () => {
  let deps: ReturnType<typeof createMockBattleSceneDeps>;
  let scene: BattleScene;

  beforeEach(() => {
    deps = createMockBattleSceneDeps();
    scene = new BattleScene(deps, createConfig());
  });

  it('has a container', () => {
    expect(scene.container).toBeInstanceOf(Container);
  });

  it('initializes battle on enter', () => {
    scene.enter();
    expect(scene.container.children.length).toBeGreaterThan(0);
  });

  it('updates without error in intro state', () => {
    scene.enter();
    expect(() => scene.update(1)).not.toThrow();
  });

  it('advances from intro on confirm press', () => {
    scene.enter();
    (deps.input.isJustPressed as ReturnType<typeof import('vitest').vi.fn>).mockReturnValue(true);
    scene.update(1);
    expect(() => scene.update(1)).not.toThrow();
  });

  it('cleans up on exit', () => {
    scene.enter();
    scene.exit();
    expect(scene.container.children.length).toBe(0);
  });
});

/** One frame with an optional key press. */
function tick(scene: BattleScene, input: MockInput, action?: InputAction): void {
  if (action) input.press(action);
  scene.update(1);
  input.clear();
}

function toCommandMenu(scene: BattleScene, input: MockInput): void {
  tick(scene, input, 'confirm'); // skip the intro
  expect(scene.uiPhase).toBe('command');
  for (let i = 0; i < COMMAND_CONFIRM_GUARD_FRAMES; i++) tick(scene, input);
}

const sturdy: CharacterClassData = { ...mockClassData, baseStats: { ...mockClassData.baseStats, hp: 100 } };
const harmless: EnemyData = { ...mockEnemy, stats: { ...mockEnemy.stats, hp: 500, attack: 1, agility: 1 } };

describe('BattleScene: a boss phase line (ST-6)', () => {
  it('shows before the first announcement and then auto-advances into the actions', () => {
    const input = createMockInput();
    const deps = createMockBattleSceneDeps(input);
    const boss: EnemyData = { ...harmless, name: 'Garland', bossPhases: [{ hpThreshold: 1, patternId: 'aggressive', message: "Garland's attacks grow fiercer!" }] };
    const scene = new BattleScene(deps, { party: [new Character({ name: 'Hero', classData: sturdy })], enemies: [boss], rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    tick(scene, input, 'confirm'); // Fight
    tick(scene, input, 'confirm'); // the target: the round starts
    expect(scene.uiPhase).toBe('message');
    expect(scene.messageLine).toBe("Garland's attacks grow fiercer!");
    // no input: the message timer moves on to the first action's announcement
    const lines: string[] = [];
    for (let i = 0; i < 120 && scene.uiPhase !== 'executing'; i++) tick(scene, input);
    expect(scene.uiPhase).toBe('executing');
    for (let i = 0; i < 5; i++) { tick(scene, input); lines.push(scene.messageLine); }
    expect(lines.some(l => /attacks/.test(l))).toBe(true);
  });
});

describe('BattleScene: message speed (pass F item 6)', () => {
  function intro() {
    const input = createMockInput();
    const scene = new BattleScene(createMockBattleSceneDeps(input), { party: [new Character({ name: 'Hero', classData: sturdy })], enemies: [harmless], rng: () => 0.5 });
    scene.enter();
    expect(scene.uiPhase).toBe('message');   // "A Goblin appears!"
    return { scene, input };
  }
  afterEach(() => { setMessageSpeed(3); });

  it('the intro line holds 90 frames at speed 3 (old 45) and 50 at speed 5', () => {
    for (const [speed, frames] of [[3, 90], [5, 50]] as const) {
      setMessageSpeed(speed);
      const { scene, input } = intro();
      for (let i = 0; i < frames - 1; i++) tick(scene, input);
      expect(scene.uiPhase, `speed ${speed}`).toBe('message');
      tick(scene, input);
      expect(scene.uiPhase, `speed ${speed}`).toBe('command');
    }
  });

  it('confirm still skips the intro line at once', () => {
    setMessageSpeed(1);
    const { scene, input } = intro();
    tick(scene, input, 'confirm');
    expect(scene.uiPhase).toBe('command');
  });

});

describe('BattleScene: Phoenix Down from Item (BA-5)', () => {
  beforeEach(async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => [
      { id: 'phoenix_down', name: 'Phoenix Down', type: 'consumable' as const, stats: {}, price: 500, usableBy: [] },
      { id: 'tent', name: 'Tent', type: 'consumable' as const, stats: {}, price: 75, usableBy: [] },
    ] } as Pick<DataLoader, 'loadItems'> as DataLoader);
  });

  it('targets the KO\'d member, and the member stands up with 1 HP', () => {
    const input = createMockInput();
    const deps = createMockBattleSceneDeps(input);
    const hero = new Character({ name: 'Hero', classData: sturdy });
    const fallen = new Character({ name: 'Ally', classData: sturdy, currentHp: 0 });
    const inventory = new Inventory();
    inventory.add('tent');
    inventory.add('phoenix_down');
    const submit = vi.spyOn(BattleStateMachine.prototype, 'submitCommand');
    const scene = new BattleScene(deps, { party: [hero, fallen], enemies: [harmless], inventory, rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    tick(scene, input, 'down');
    tick(scene, input, 'down');
    tick(scene, input, 'confirm'); // Item
    expect(scene.uiPhase).toBe('item_ui');
    tick(scene, input, 'confirm'); // the first listed item: Phoenix Down (the Tent is not listed in battle)
    expect(scene.uiPhase).toBe('target');
    tick(scene, input, 'confirm'); // the only target: the fallen member
    expect(submit).toHaveBeenCalledWith({ type: 'item', actorId: 'party_0', targetId: 'party_1', itemId: 'phoenix_down' });
    for (let i = 0; i < 400 && scene.uiPhase !== 'command'; i++) tick(scene, input, i % 10 === 0 ? 'confirm' : undefined);
    expect(fallen.currentHp).toBe(1);
    expect(inventory.has('phoenix_down')).toBe(false);
    expect(inventory.has('tent')).toBe(true);
    submit.mockRestore();
  });

  it('with nobody fallen, Phoenix Down says "No one to revive." instead of silently backing out', () => {
    const input = createMockInput();
    const deps = createMockBattleSceneDeps(input);
    const inventory = new Inventory();
    inventory.add('phoenix_down');
    const scene = new BattleScene(deps, { party: [new Character({ name: 'Hero', classData: sturdy })], enemies: [harmless], inventory, rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    tick(scene, input, 'down');
    tick(scene, input, 'down');
    tick(scene, input, 'confirm'); // Item
    tick(scene, input, 'confirm'); // Phoenix Down
    expect(scene.uiPhase).toBe('notice');
    expect(scene.messageLine).toBe('No one to revive.');
    expect(inventory.has('phoenix_down')).toBe(true);
  });
});

describe('BattleScene: readability (BA-8)', () => {
  const party = () => ['KNIGHT', 'THIEF'].map(name => new Character({ name, classData: sturdy }));

  it('the active hero stays fully visible for 200 frames of its turn, stepped forward and tinted', () => {
    const input = createMockInput();
    const scene = new BattleScene(createMockBattleSceneDeps(input), { party: party(), enemies: [harmless], rng: () => 0.5 });
    scene.enter();
    const home = scene.partySprites[0].x;
    const otherHome = scene.partySprites[1].x;
    toCommandMenu(scene, input);
    const sprite = scene.partySprites[0];
    const tints = new Set<number>();
    for (let i = 0; i < 200; i++) {
      tick(scene, input);
      expect(sprite.alpha, `frame ${i}`).toBe(1);
      tints.add(sprite.tint);
    }
    expect(sprite.x).toBe(home - ACTIVE_STEP);
    expect(tints.size).toBeGreaterThan(2);
    expect(scene.partyPanel.activeIndex).toBe(0);
    expect(scene.partySprites[1].x).toBe(otherHome);
  });

  it('the hero steps back into line when its command is chosen', () => {
    const input = createMockInput();
    const scene = new BattleScene(createMockBattleSceneDeps(input), { party: party(), enemies: [harmless], rng: () => 0.5 });
    scene.enter();
    const home = scene.partySprites[0].x;
    toCommandMenu(scene, input);
    tick(scene, input, 'confirm'); // Fight
    tick(scene, input, 'confirm'); // the target: the next member's turn
    expect(scene.partySprites[0].x).toBe(home);
    expect(scene.partySprites[0].tint).toBe(0xffffff);
    expect(scene.partyPanel.activeIndex).toBe(1);
  });

  it('the message text is 32 px with 36 px lines, and two lines fit the 120 px window', () => {
    const scene = new BattleScene(createMockBattleSceneDeps(), { party: party(), enemies: [harmless] });
    scene.enter();
    const text = scene.messageRenderer;
    expect(text.fontSize).toBe(BATTLE_MESSAGE_FONT);
    expect(BATTLE_MESSAGE_FONT).toBe(32);
    expect(text.lineHeight).toBe(36);
    expect(WINDOW_PADDING + 2 * text.lineHeight).toBeLessThanOrEqual(BATTLE_MESSAGE_HEIGHT - WINDOW_PADDING);
    expect(FLOAT_FONT).toBeGreaterThanOrEqual(48);
  });

  it('9 enemies of two species give two list lines', () => {
    const wolf: EnemyData = { ...harmless, id: 'wolf', name: 'Wolf' };
    const enemies = [...Array.from({ length: 6 }, () => harmless), ...Array.from({ length: 3 }, () => wolf)];
    const scene = new BattleScene(createMockBattleSceneDeps(), { party: party(), enemies });
    scene.enter();
    expect(scene.enemyListLines).toEqual(['6x Goblin', '3x Wolf']);
  });

  it('the item list opens in the left (enemy-list) window, not the command window', async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => [
      { id: 'potion', name: 'Potion', type: 'consumable' as const, stats: {}, price: 60, usableBy: [] },
    ] } as Pick<DataLoader, 'loadItems'> as DataLoader);
    const input = createMockInput();
    const inventory = new Inventory();
    inventory.add('potion');
    const scene = new BattleScene(createMockBattleSceneDeps(input), { party: party(), enemies: [harmless], inventory, rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    tick(scene, input, 'down');
    tick(scene, input, 'down');
    tick(scene, input, 'confirm'); // Item
    expect(scene.uiPhase).toBe('item_ui');
    const ui = findDescendant(scene.container, (c): c is ItemSelectionUI => c instanceof ItemSelectionUI);
    expect(ui).not.toBeNull();
    expect(ui!.parent).toBeInstanceOf(Window);
    expect(ui!.parent!.x).toBe(ENEMY_WINDOW.x);
    expect(ui!.parent!.y).toBe(STRIP_Y);
  });
});

describe('BattleScene: R2 command menus (B5, B8, I3)', () => {
  const potionData = [{ id: 'potion', name: 'Potion', type: 'consumable' as const, stats: { hp: 30 }, price: 60, usableBy: [] }];
  const mageClass: CharacterClassData = { ...sturdy, id: 'black_mage', spellLevels: { white: 0, black: 8 } };
  const fire = { id: 'fire', name: 'FIRE', level: 1, type: 'black' as const, effect: 'damage', targeting: 'single' as const,
    description: '', power: 10, element: 'fire' };

  beforeEach(async () => {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => potionData } as Pick<DataLoader, 'loadItems'> as DataLoader);
  });

  /** Command menu -> Item (two downs), from the current member's turn. */
  const openItems = (scene: BattleScene, input: MockInput) => {
    tick(scene, input, 'down');
    tick(scene, input, 'down');
    tick(scene, input, 'confirm');
  };

  it('B5 / U14: with 1 Potion queued by member 0, member 1\'s Item is greyed and picking it does nothing; after undo it is offered again', () => {
    const input = createMockInput();
    const inventory = new Inventory();
    inventory.add('potion', 1);
    const a = new Character({ name: 'FGHTR', classData: sturdy });
    const b = new Character({ name: 'THIEF', classData: sturdy });
    a.currentHp = 10;
    const scene = new BattleScene(createMockBattleSceneDeps(input), { party: [a, b], enemies: [harmless], inventory, rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    openItems(scene, input);
    expect(scene.itemListIds).toEqual(['potion']);
    tick(scene, input, 'confirm'); // Potion
    expect(scene.uiPhase).toBe('target');
    tick(scene, input, 'confirm'); // the cursor starts on the most hurt member: FGHTR
    expect(scene.partyPanel.activeIndex).toBe(1); // THIEF's turn
    for (let i = 0; i < COMMAND_CONFIRM_GUARD_FRAMES; i++) tick(scene, input);
    expect(commandRows(scene).Item).toBe(false);
    openItems(scene, input);
    expect(scene.uiPhase).toBe('command'); // a greyed row cannot be picked
    tick(scene, input, 'up');
    tick(scene, input, 'up');
    tick(scene, input, 'cancel'); // back to FGHTR: the Potion is released
    expect(scene.partyPanel.activeIndex).toBe(0);
    for (let i = 0; i < COMMAND_CONFIRM_GUARD_FRAMES; i++) tick(scene, input);
    openItems(scene, input);
    expect(scene.uiPhase).toBe('item_ui');
    expect(scene.itemListIds).toEqual(['potion']);
  });

  it('I3: picking FIRE emits no spellCast; executing it emits exactly one', () => {
    const input = createMockInput();
    const deps = createMockBattleSceneDeps(input);
    const mage = new Character({ name: 'B.MAG', classData: mageClass });
    mage.learnSpell('fire', 1);
    mage.setSpellCharges(1, 2);
    const scene = new BattleScene(deps, { party: [mage], enemies: [harmless], spells: [fire], rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    const casts = () => (deps.events.emit as ReturnType<typeof vi.fn>).mock.calls.filter(c => c[0] === 'spellCast').length;
    tick(scene, input, 'down');
    tick(scene, input, 'confirm'); // Magic
    expect(scene.uiPhase).toBe('spell_ui');
    for (let i = 0; i < 6 && scene.uiPhase !== 'executing'; i++) tick(scene, input, 'confirm'); // level, FIRE, the goblin
    expect(scene.uiPhase).toBe('executing');
    expect(casts()).toBe(0);
    for (let i = 0; i < 300 && scene.uiPhase === 'executing'; i++) tick(scene, input);
    expect(casts()).toBe(1);
  });

  it("B8: a silenced member's Magic shows \"Silenced.\" and spends nothing", () => {
    const input = createMockInput();
    const mage = new Character({ name: 'B.MAG', classData: mageClass });
    mage.learnSpell('fire', 1);
    mage.setSpellCharges(1, 2);
    mage.statusTracker.apply('silence');
    const scene = new BattleScene(createMockBattleSceneDeps(input), { party: [mage], enemies: [harmless], spells: [fire], rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    tick(scene, input, 'down');
    tick(scene, input, 'confirm'); // Magic
    expect(scene.uiPhase).toBe('notice');
    expect(scene.messageLine).toBe('Silenced.');
    expect(mage.getSpellCharges(1)).toBe(2);
  });
});

/** The command menu's rows (Fight, Magic, Item, Run) and whether each is enabled (white) or greyed. */
function commandRows(scene: BattleScene): Record<string, boolean> {
  const menu = findDescendant(scene.container, (c): c is Menu => c instanceof Menu && c.children.some(t => t instanceof BitmapText && t.text === 'Fight'));
  expect(menu).not.toBeNull();
  const rows = menu!.children.filter((t): t is BitmapText => t instanceof BitmapText && t.text !== '▶');
  return Object.fromEntries(rows.map(t => [t.text, t.style.fill !== 0x808080]));
}

describe('BattleScene: Magic and Item greyed per member (U14)', () => {
  /** The `u_cmd_menu` party, from its YAML entry, with the real items and spells. */
  async function cmdMenuScene() {
    ItemRegistry.reset();
    await ItemRegistry.init({ loadItems: async () => ITEMS } as Pick<DataLoader, 'loadItems'> as DataLoader);
    const scenarios = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
    const sc = scenarios.find(x => x.id === 'u_cmd_menu')!;
    const party = sc.party.map((m) => {
      const c = new Character({ name: m.name, classData: classOf(m.class), level: m.level });
      for (const id of m.equipment) expect(c.equip(slotOf(item(id))!, item(id)), `${m.name} ${id}`).not.toBe(false);
      for (const sp of m.spells) c.learnSpell(sp.id, sp.level);
      c.restoreAllCharges();
      return c;
    });
    const inventory = new Inventory();
    for (const [id, n] of Object.entries(sc.items)) inventory.add(id, n);
    const input = createMockInput();
    const scene = new BattleScene(createMockBattleSceneDeps(input), { party, enemies: [harmless], inventory, spells: SPELLS, rng: () => 0.5 });
    scene.enter();
    toCommandMenu(scene, input);
    return { scene, input, inventory, party };
  }

  /** Fight the first enemy, then wait out the next member's confirm guard. */
  function fight(scene: BattleScene, input: MockInput): void {
    tick(scene, input, 'confirm');
    tick(scene, input, 'confirm');
    for (let i = 0; i < COMMAND_CONFIRM_GUARD_FRAMES; i++) tick(scene, input);
  }

  it('with only a lute in the bag, Item is grey for every member and Magic for FGHTR and THIEF (old: always enabled)', async () => {
    const { scene, input, party } = await cmdMenuScene();
    expect(party.map(c => c.name)).toEqual(['FGHTR', 'THIEF', 'W.MAG', 'B.MAG']);
    const seen: Array<Record<string, boolean>> = [];
    for (let m = 0; m < 4; m++) {
      expect(scene.partyPanel.activeIndex).toBe(m);
      seen.push(commandRows(scene));
      fight(scene, input);
    }
    expect(seen.map(r => r.Item)).toEqual([false, false, false, false]);
    expect(seen.map(r => r.Magic)).toEqual([false, false, true, true]);
    expect(seen.map(r => r.Fight)).toEqual([true, true, true, true]);
  });

  it('after a Potion is added, Item is enabled on the next command phase', async () => {
    const { scene, input, inventory } = await cmdMenuScene();
    expect(commandRows(scene).Item).toBe(false);
    inventory.add('potion');
    fight(scene, input);
    expect(scene.partyPanel.activeIndex).toBe(1);
    expect(commandRows(scene).Item).toBe(true);
  });

  it('a greyed Magic pick does nothing; a silenced mage keeps Magic enabled and still hears "Silenced."', async () => {
    const { scene, input, party } = await cmdMenuScene();
    tick(scene, input, 'down');
    tick(scene, input, 'confirm'); // FGHTR's greyed Magic
    expect(scene.uiPhase).toBe('command');
    tick(scene, input, 'up');
    fight(scene, input); // FGHTR
    party[2].statusTracker.apply('silence'); // before W.MAG's turn starts
    fight(scene, input); // THIEF
    expect(scene.partyPanel.activeIndex).toBe(2);
    expect(commandRows(scene).Magic).toBe(true);
    tick(scene, input, 'down');
    tick(scene, input, 'confirm');
    expect(scene.uiPhase).toBe('notice');
    expect(scene.messageLine).toBe('Silenced.');
  });
});

function findDescendant<T extends Container>(root: Container, test: (c: Container) => c is T): T | null {
  for (const child of root.children) {
    if (test(child)) return child;
    const found = findDescendant(child, test);
    if (found) return found;
  }
  return null;
}
