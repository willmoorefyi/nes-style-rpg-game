import { BitmapText } from 'pixi.js';
import type { ItemData } from '../../types/index.js';
import type { Character } from '../../entities/Character.js';
import { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { slotOf } from '../../entities/EquipmentRules.js';
import { compareEquip, hitsSuffix } from '../shopComparison.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import { DETAIL_RECT } from './shopLayout.js';

export { DETAIL_RECT, type ShopRect } from './shopLayout.js';
const LINE_STEP = FONT_SIZE + 8;

/**
 * The equipment shop's detail panel: the item and its stat, and one comparison line per member (MS-5). The item's
 * description is shown once, in the shop's help bar, not here.
 */
export class ShopDetailPanel {
  readonly window = new Window({ ...DETAIL_RECT });
  private texts: BitmapText[] = [];

  constructor() {
    this.window.visible = false;
  }

  get visible(): boolean { return this.window.visible; }
  set visible(v: boolean) { this.window.visible = v; }

  /** The comparison lines (item, then one per member), with their top y inside the panel. */
  get lines(): Array<{ text: string; y: number }> {
    return this.texts.map((t) => ({ text: t.text, y: t.position.y }));
  }

  /** Clear the panel. */
  clear(): void {
    for (const t of this.texts) this.window.removeChild(t);
    this.texts = [];
  }

  /** Draw `item` against each member of `party` (nothing for items that fit no slot). */
  show(item: ItemData | undefined, party: readonly Character[]): void {
    this.clear();
    if (!item) return;
    const slot = slotOf(item);
    if (!slot) return;
    const isWeapon = item.type === 'weapon';
    const statLabel = isWeapon ? 'ATK' : 'DEF';
    const newStat = (isWeapon ? item.stats.attack : item.stats.defense) ?? 0;

    const cx = this.window.contentX;
    let y = this.window.contentY;
    const addLine = (text: string, color: number = 0xffffff): void => {
      const bt = new BitmapText({ text, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: color } });
      bt.position.set(cx, y);
      this.window.addChild(bt);
      this.texts.push(bt);
      y += LINE_STEP;
    };

    addLine(`${item.name}  ${statLabel}: ${newStat}`);
    y += 8;

    // One line per member: `NAME  ATK cur->new  +d` (MS-5), so four members fit the panel.
    const nameWidth = Math.max(0, ...party.map((c) => c.name.length));
    for (const char of party) {
      const name = char.name.padEnd(nameWidth);
      // same rule as EquipScene: members whose class can't use the item get no +/- value
      if (!char.canEquip(item)) {
        addLine(`${name}  n/a`, 0x808080);
        continue;
      }
      // the battle numbers with the item and without it (a Monk's bare hands can beat a weapon: negative)
      const cmp = compareEquip(char, item, slot);
      const diff = cmp.diff;
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      const diffColor = diff > 0 ? 0x00ff00 : diff < 0 ? 0xff0000 : 0xffffff;
      const now = `${cmp.now}${hitsSuffix(cmp, cmp.nowHits)}`;
      const next = `${cmp.next}${hitsSuffix(cmp, cmp.nextHits)}`;
      addLine(`${name}  ${cmp.label} ${now}->${next}  ${diffStr}`, diffColor);
    }
  }
}
