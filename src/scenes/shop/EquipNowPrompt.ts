import { BitmapText } from 'pixi.js';
import type { ItemData } from '../../types/index.js';
import type { Character } from '../../entities/Character.js';
import type { Inventory } from '../../entities/Inventory.js';
import type { InputManager } from '../../core/InputManager.js';
import type { EventBus } from '../../core/EventBus.js';
import { Window } from '../../ui/Window.js';
import { Menu, type MenuItem } from '../../ui/Menu.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { equipFromBag, slotOf } from '../../entities/EquipmentRules.js';
import { compareEquip } from '../shopComparison.js';
import { FONT_SIZE, LINE_HEIGHT, MENU_LINE_HEIGHT, WINDOW_PADDING } from '../../core/LayoutConstants.js';

export const EQUIP_NOW_TITLE = 'Equip it now?';
export const NOT_NOW = 'Not now';
const PROMPT_X = 320;
const PROMPT_Y = 300;
const PROMPT_WIDTH = 860;

export interface EquipNowConfig {
  item: ItemData;
  /** How many copies were just bought: the prompt asks again while one is left for another member. */
  copies: number;
  party: readonly Character[];
  inventory: Inventory;
  eventBus?: EventBus;
  /** Called once when the prompt closes, with the refusal to show (a full bag for the worn item), if any. */
  onDone: (message?: string) => void;
}

/** A member can take the item now: the class and slot fit, and they don't already wear one. */
export function canTakeNow(c: Character, item: ItemData): boolean {
  const slot = slotOf(item);
  return slot !== null && c.canEquipIn(slot, item) && c.getEquipped(slot)?.id !== item.id;
}

/** Whether buying `item` should offer "Equip it now?": it is gear and someone can take it. */
export function offersEquipNow(item: ItemData, party: readonly Character[]): boolean {
  return party.some((c) => canTakeNow(c, item));
}

/**
 * "Equip it now?" after buying gear (U11): one row per member with the change (`FGHTR  ATK 5→9`), the members who
 * can't take it greyed, and "Not now" last. A pick equips the copy from the bag (`equipFromBag`, the worn item goes
 * back to the bag); the prompt repeats while bought copies remain and another member can take one.
 */
export class EquipNowPrompt extends Window {
  private menu!: Menu;
  private rows: MenuItem[] = [];
  private copies: number;
  private done = false;

  constructor(private readonly prompt: EquipNowConfig) {
    const rowsCount = prompt.party.length + 1;
    super({
      x: PROMPT_X, y: PROMPT_Y, width: PROMPT_WIDTH,
      height: 2 * WINDOW_PADDING + LINE_HEIGHT + 16 + rowsCount * MENU_LINE_HEIGHT,
    });
    this.copies = prompt.copies;
    const title = new BitmapText({ text: EQUIP_NOW_TITLE, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    title.position.set(this.contentX, this.contentY);
    this.addChild(title);
    this.build();
  }

  /** The rows as shown, with whether each can be picked. */
  get labels(): Array<{ label: string; enabled: boolean }> {
    return this.rows.map((r) => ({ label: r.label, enabled: r.enabled !== false }));
  }

  get selectedIndex(): number { return this.menu.selectedIndex; }

  update(input: InputManager): void {
    if (!this.done) this.menu.update(input);
  }

  private build(): void {
    if (this.menu) this.removeChild(this.menu);
    const { item, party } = this.prompt;
    const slot = slotOf(item);
    const nameWidth = Math.max(0, ...party.map((c) => c.name.length));
    this.rows = party.map((c, i) => {
      const name = c.name.padEnd(nameWidth);
      if (!slot || !c.canEquipIn(slot, item)) return { label: `${name}  can't equip`, value: String(i), enabled: false };
      if (!canTakeNow(c, item)) return { label: `${name}  equipped`, value: String(i), enabled: false };
      const cmp = compareEquip(c, item, slot);
      return { label: `${name}  ${cmp.label} ${cmp.now}→${cmp.next}`, value: String(i) };
    });
    this.rows.push({ label: NOT_NOW, value: '' });
    this.menu = new Menu({
      items: this.rows,
      x: this.contentX,
      y: this.contentY + LINE_HEIGHT + 16,
      initialIndex: Math.max(0, this.rows.findIndex((r) => r.enabled !== false)),
      eventBus: this.prompt.eventBus,
      onSelect: (row) => this.pick(row.value),
      onCancel: () => this.finish(),
    });
    this.addChild(this.menu);
  }

  private pick(value: string): void {
    const { item, party, inventory } = this.prompt;
    const member = value === '' ? undefined : party[Number(value)];
    const slot = slotOf(item);
    if (!member || !slot) { this.finish(); return; }
    const result = equipFromBag(member, slot, item, inventory);
    if (!result.ok) { this.finish(result.message); return; }
    this.copies--;
    if (this.copies > 0 && inventory.has(item.id) && offersEquipNow(item, party)) this.build();
    else this.finish();
  }

  private finish(message?: string): void {
    if (this.done) return;
    this.done = true;
    this.prompt.onDone(message);
  }
}
