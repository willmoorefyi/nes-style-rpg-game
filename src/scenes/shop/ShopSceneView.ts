import { Container, BitmapText } from 'pixi.js';
import { Window } from '../../ui/Window.js';
import type { Menu, MenuItem } from '../../ui/Menu.js';
import type { QuantitySelectorUI } from '../../ui/QuantitySelector.js';
import { HelpWindow } from '../../ui/HelpWindow.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import { ShopDetailPanel, DETAIL_RECT, type ShopRect } from './ShopDetailPanel.js';
import { CHOICE_RECT, GOLD_RECT, listRect } from './shopLayout.js';
import type { EquipNowPrompt } from './EquipNowPrompt.js';

/**
 * The equipment and item shop's windows and the read-only view tests use (extracted from `ShopScene`, U revision 13).
 * The gold window shows the gold only; the result of a deal ("Bought 2 Potion.", "You can't carry another Potion.")
 * is shown on the help bar until the next input (U9).
 */
export abstract class ShopSceneView {
  readonly container = new Container();
  /** The town stays visible around the windows (E5). */
  readonly transparent = true;
  protected readonly choiceWindow = new Window({ ...CHOICE_RECT });
  protected readonly goldWindow = new Window({ ...GOLD_RECT });
  protected itemRect: ShopRect = listRect(false);
  protected readonly itemWindow = new Window({ ...this.itemRect });
  protected readonly detail = new ShopDetailPanel();
  protected readonly help = new HelpWindow();
  protected readonly goldText: BitmapText;
  protected choiceMenu!: Menu;
  protected itemMenu?: Menu;
  protected qtySelector?: QuantitySelectorUI;
  protected equipPrompt?: EquipNowPrompt;
  protected listItems: MenuItem[] = [];
  protected maxQty = 1;
  /** The result line on the help bar, or ''. */
  protected message = '';

  constructor() {
    this.itemWindow.visible = false;
    this.goldText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.goldText.position.set(this.goldWindow.contentX, this.goldWindow.contentY);
    this.goldWindow.addChild(this.goldText);
    this.help.visible = false;
    this.container.addChild(this.choiceWindow, this.goldWindow, this.itemWindow, this.detail.window, this.help);
  }

  /** The item list's rectangle (narrowed while the comparison panel is shown). */
  get itemWindowRect(): ShopRect { return { ...this.itemRect }; }
  /** The comparison panel's rectangle. */
  get detailWindowRect(): ShopRect { return { ...DETAIL_RECT }; }
  /** Whether the comparison panel is shown. */
  get detailVisible(): boolean { return this.detail.visible; }
  /** The comparison panel's lines, with their top y inside the panel. */
  get detailLines(): Array<{ text: string; y: number }> { return this.detail.lines; }
  /** The help bar's text, or '' while it is hidden. */
  get helpText(): string { return this.help.visible ? this.help.text : ''; }
  /** The result line on the help bar ("Bought 2 Potion."), or ''. */
  get resultMessage(): string { return this.message; }
  /** The gold window's lines (the gold only, U9). */
  get goldLines(): string[] {
    return this.goldWindow.children.filter((c): c is BitmapText => c instanceof BitmapText).map((t) => t.text);
  }
  /** The item list's cursor, or -1 when the list is closed. */
  get itemIndex(): number { return this.itemMenu?.selectedIndex ?? -1; }
  /** The item list's row labels, or [] while it is closed. */
  get itemLabels(): string[] { return this.itemMenu ? this.listItems.map((i) => i.label) : []; }
  /** Whether the Buy/Sell/Exit menu has the focus (white cursor). */
  get choiceActive(): boolean { return this.choiceMenu.isActive; }
  /** The quantity picker's maximum, or 0 while it is closed. */
  get quantityMax(): number { return this.qtySelector ? this.maxQty : 0; }
  /** The "Equip it now?" rows while the prompt is open, else []. */
  get equipPromptRows(): Array<{ label: string; enabled: boolean }> { return this.equipPrompt?.labels ?? []; }

  /** Show `text` on the help bar until the next input. */
  protected showMessage(text: string): void {
    this.message = text;
    this.help.visible = true;
    this.help.setText(text);
  }

  protected setDetailVisible(visible: boolean): void {
    this.detail.visible = visible;
    const width = listRect(visible).width;
    if (width !== this.itemRect.width) {
      this.itemRect = { ...this.itemRect, width };
      this.itemWindow.resize(width, this.itemRect.height);
    }
  }
}
