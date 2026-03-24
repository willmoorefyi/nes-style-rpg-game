import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import type { EquipmentSlot } from '../types/index.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { WIDTH } from '../core/Game.js';

const SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'shield', 'helmet'];
const SLOT_TO_TYPE: Record<EquipmentSlot, string> = { weapon: 'weapon', armor: 'armor', shield: 'armor', helmet: 'armor' };

type Phase = 'selectMember' | 'selectSlot' | 'selectItem';

export class EquipScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private memberWindow: Window;
  private slotWindow: Window;
  private itemWindow: Window;
  private statsWindow: Window;
  private memberMenu!: Menu;
  private slotMenu!: Menu;
  private itemMenu!: Menu;
  private statsText: TextRenderer;
  private phase: Phase = 'selectMember';
  private memberIdx = 0;
  private selectedSlot: EquipmentSlot = 'weapon';

  constructor(game: Game) {
    this.game = game;
    this.memberWindow = new Window({ x: 8, y: 8, width: 80, height: 64 });
    this.slotWindow = new Window({ x: 96, y: 8, width: 80, height: 64 });
    this.itemWindow = new Window({ x: 8, y: 80, width: WIDTH - 16, height: 100 });
    this.statsWindow = new Window({ x: 184, y: 8, width: 64, height: 64 });
    this.slotWindow.visible = false;
    this.itemWindow.visible = false;
    this.statsText = new TextRenderer({ width: this.statsWindow.contentWidth });
    this.statsText.position.set(this.statsWindow.contentX, this.statsWindow.contentY);
    this.statsWindow.addChild(this.statsText);
    this.container.addChild(this.memberWindow, this.slotWindow, this.itemWindow, this.statsWindow);
  }

  enter(): void {
    this.phase = 'selectMember';
    this.slotWindow.visible = false;
    this.itemWindow.visible = false;
    this.buildMemberMenu();
    this.updateStats();
  }

  private buildMemberMenu(): void {
    if (this.memberMenu) this.memberWindow.removeChild(this.memberMenu);
    const items: MenuItem[] = this.game.party.all.map((c, i) => ({ label: c.name, value: String(i) }));
    this.memberMenu = new Menu({
      items,
      x: this.memberWindow.contentX,
      y: this.memberWindow.contentY,
      onSelect: (item) => { this.memberIdx = Number(item.value); this.phase = 'selectSlot'; this.slotWindow.visible = true; this.buildSlotMenu(); },
      onCancel: () => this.game.scenes.pop(),
    });
    this.memberWindow.addChild(this.memberMenu);
  }

  private buildSlotMenu(): void {
    if (this.slotMenu) this.slotWindow.removeChild(this.slotMenu);
    const char = this.game.party.get(this.memberIdx)!;
    const items: MenuItem[] = SLOTS.map(s => {
      const eq = char.getEquipped(s);
      return { label: `${s}: ${eq?.name ?? '-'}`, value: s };
    });
    this.slotMenu = new Menu({
      items,
      x: this.slotWindow.contentX,
      y: this.slotWindow.contentY,
      onSelect: (item) => { this.selectedSlot = item.value as EquipmentSlot; this.phase = 'selectItem'; this.itemWindow.visible = true; this.buildItemMenu(); },
      onCancel: () => { this.phase = 'selectMember'; this.slotWindow.visible = false; },
    });
    this.slotWindow.addChild(this.slotMenu);
  }

  private buildItemMenu(): void {
    if (this.itemMenu) this.itemWindow.removeChild(this.itemMenu);
    const char = this.game.party.get(this.memberIdx)!;
    const type = SLOT_TO_TYPE[this.selectedSlot];
    const compatible = ItemRegistry.getAllByType(type as 'weapon' | 'armor').filter(i => char.canEquip(i));
    const items: MenuItem[] = [{ label: '(Unequip)', value: '' }];
    for (const i of compatible) {
      if (this.game.inventory.has(i.id)) items.push({ label: i.name, value: i.id });
    }
    this.itemMenu = new Menu({
      items,
      x: this.itemWindow.contentX,
      y: this.itemWindow.contentY,
      maxVisible: 7,
      onSelect: (item) => this.onEquipSelect(item),
      onCancel: () => { this.phase = 'selectSlot'; this.itemWindow.visible = false; },
    });
    this.itemWindow.addChild(this.itemMenu);
  }

  private onEquipSelect(item: MenuItem): void {
    const char = this.game.party.get(this.memberIdx)!;
    const prev = char.unequip(this.selectedSlot);
    if (prev) this.game.inventory.add(prev.id);
    if (item.value) {
      const newItem = ItemRegistry.getItem(item.value);
      if (newItem) { char.equip(this.selectedSlot, newItem); this.game.inventory.remove(item.value); }
    }
    this.phase = 'selectSlot';
    this.itemWindow.visible = false;
    this.buildSlotMenu();
    this.updateStats();
  }

  update(_dt: number): void {
    if (this.phase === 'selectMember') {
      const prev = this.memberMenu.selectedIndex;
      this.memberMenu.update(this.game.input);
      if (this.memberMenu.selectedIndex !== prev) { this.memberIdx = this.memberMenu.selectedIndex; this.updateStats(); }
    } else if (this.phase === 'selectSlot') {
      this.slotMenu.update(this.game.input);
    } else {
      this.itemMenu.update(this.game.input);
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}

  private updateStats(): void {
    const char = this.game.party.get(this.memberIdx);
    if (!char) { this.statsText.setText('', true); return; }
    const s = char.stats;
    this.statsText.setText(`ATK:${s.attack}\nDEF:${s.defense}`, true);
  }
}
