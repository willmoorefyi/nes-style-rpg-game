import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import type { EquipmentSlot, ItemData } from '../types/index.js';
import type { Character } from '../entities/Character.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { HelpWindow, HELP_RECT } from '../ui/HelpWindow.js';
import { SLOT_LABELS } from '../ui/labels.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { partyAbsorb, partyAttack, withEquipped, type MemberView } from '../battle/CombatStats.js';
import { GAME_WIDTH, SCREEN_MARGIN } from '../core/LayoutConstants.js';

const SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'shield', 'helmet'];
const TOP_HEIGHT = 300;
const ITEM_Y = SCREEN_MARGIN + TOP_HEIGHT + SCREEN_MARGIN;

type Phase = 'selectMember' | 'selectSlot' | 'selectItem';

/** `ATK 12` / `DEF 4`, or with a preview `ATK 12 -> 19  +7` (the battle numbers: `partyAttack`, `partyAbsorb`). */
export function equipPreview(c: MemberView, slot?: EquipmentSlot, item?: ItemData | null): string {
  const row = (label: string, stat: (v: MemberView) => number): string => {
    const now = stat(c);
    if (slot === undefined || item === undefined) return `${label} ${now}`;
    const next = stat(withEquipped(c, slot, item));
    const diff = next - now;
    return `${label} ${now} -> ${next}${diff === 0 ? '' : `  ${diff > 0 ? '+' : ''}${diff}`}`;
  };
  return `${row('ATK', partyAttack)}\n${row('DEF', partyAbsorb)}`;
}

export class EquipScene implements Scene {
  readonly container = new Container();
  private memberWindow: Window;
  private slotWindow: Window;
  private itemWindow: Window;
  private statsWindow: Window;
  private help = new HelpWindow();
  private memberMenu!: Menu;
  private slotMenu!: Menu;
  private itemMenu!: Menu;
  private statsText: TextRenderer;
  private phase: Phase = 'selectMember';
  private memberIdx = 0;
  private selectedSlot: EquipmentSlot = 'weapon';

  constructor(private readonly game: Game) {
    this.memberWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 400, height: TOP_HEIGHT });
    // wide enough for "Helmet: Mythril Helm"
    this.slotWindow = new Window({ x: 448, y: SCREEN_MARGIN, width: 560, height: TOP_HEIGHT });
    // ends 24 px above the help bar (y 900)
    this.itemWindow = new Window({ x: SCREEN_MARGIN, y: ITEM_Y, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: HELP_RECT.y - SCREEN_MARGIN - ITEM_Y });
    this.statsWindow = new Window({ x: 1032, y: SCREEN_MARGIN, width: GAME_WIDTH - SCREEN_MARGIN - 1032, height: TOP_HEIGHT });
    this.slotWindow.visible = false;
    this.itemWindow.visible = false;
    this.statsText = new TextRenderer({ width: this.statsWindow.contentWidth });
    this.statsText.position.set(this.statsWindow.contentX, this.statsWindow.contentY);
    this.statsWindow.addChild(this.statsText);
    this.container.addChild(this.memberWindow, this.slotWindow, this.itemWindow, this.statsWindow, this.help);
  }

  /** The stats window's text: ATK / DEF, with the preview while browsing items. */
  get statsLines(): string { return this.statsText.text; }
  /** The help bar's text (the highlighted item's description). */
  get helpText(): string { return this.help.text; }

  enter(): void {
    this.phase = 'selectMember';
    this.slotWindow.visible = false;
    this.itemWindow.visible = false;
    this.buildMemberMenu();
    this.updateStats();
  }

  private get member(): Character | undefined { return this.game.party.get(this.memberIdx) ?? undefined; }

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
    const char = this.member!;
    const items: MenuItem[] = SLOTS.map(s => {
      const eq = char.getEquipped(s);
      return { label: `${SLOT_LABELS[s]}: ${eq?.name ?? '-'}`, value: s };
    });
    this.slotMenu = new Menu({
      items,
      x: this.slotWindow.contentX,
      y: this.slotWindow.contentY,
      onSelect: (item) => { this.selectedSlot = item.value as EquipmentSlot; this.phase = 'selectItem'; this.itemWindow.visible = true; this.buildItemMenu(); },
      onCancel: () => { this.phase = 'selectMember'; this.slotWindow.visible = false; this.help.setText(''); },
    });
    this.slotWindow.addChild(this.slotMenu);
    this.showSlotHelp();
  }

  private buildItemMenu(): void {
    if (this.itemMenu) this.itemWindow.removeChild(this.itemMenu);
    const char = this.member!;
    const type = this.selectedSlot === 'weapon' ? 'weapon' : 'armor';
    // only items that fit the slot being edited (no chain mail in the shield slot)
    const compatible = ItemRegistry.getAllByType(type).filter(i => char.canEquipIn(this.selectedSlot, i));
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
      onCancel: () => { this.phase = 'selectSlot'; this.itemWindow.visible = false; this.updateStats(); this.showSlotHelp(); },
    });
    this.itemWindow.addChild(this.itemMenu);
    this.previewSelected();
  }

  private onEquipSelect(item: MenuItem): void {
    const char = this.member!;
    const newItem = item.value ? ItemRegistry.getItem(item.value) : null;
    // check before unequipping, so a refused item never costs the member what they wore
    if (item.value && (!newItem || !char.canEquipIn(this.selectedSlot, newItem))) {
      this.statsText.setText(`Can't equip\nthat there.`, true);
      return;
    }
    const prev = char.unequip(this.selectedSlot);
    if (prev) this.game.inventory.add(prev.id);
    if (newItem) {
      if (char.equip(this.selectedSlot, newItem) === false) console.error(`EquipScene: ${char.name} refused ${newItem.id}`);
      else this.game.inventory.remove(newItem.id);
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
      const prev = this.slotMenu.selectedIndex;
      this.slotMenu.update(this.game.input);
      if (this.phase === 'selectSlot' && this.slotMenu.selectedIndex !== prev) this.showSlotHelp();
    } else {
      const prev = this.itemMenu.selectedIndex;
      this.itemMenu.update(this.game.input);
      if (this.phase === 'selectItem' && this.itemMenu.selectedIndex !== prev) this.previewSelected();
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}

  /** The help bar describes what the highlighted slot holds. */
  private showSlotHelp(): void {
    const slot = SLOTS[this.slotMenu.selectedIndex];
    this.help.setText((slot && this.member?.getEquipped(slot)?.description) ?? '');
  }

  /** Live ATK/DEF preview and description for the highlighted item ('(Unequip)' previews an empty slot). */
  private previewSelected(): void {
    const char = this.member;
    if (!char) return;
    const value = this.itemMenu.selectedItem?.value;
    const item = value ? ItemRegistry.getItem(value) ?? null : null;
    this.statsText.setText(equipPreview(char, this.selectedSlot, item), true);
    this.help.setText(item?.description ?? '');
  }

  private updateStats(): void {
    const char = this.member;
    this.statsText.setText(char ? equipPreview(char) : '', true);
  }
}
