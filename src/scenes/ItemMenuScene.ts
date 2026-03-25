import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { ItemEffects } from '../systems/ItemEffects.js';
import { GAME_WIDTH, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type Phase = 'selectItem' | 'selectTarget';

export class ItemMenuScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private itemWindow: Window;
  private descWindow: Window;
  private targetWindow: Window;
  private itemMenu!: Menu;
  private targetMenu!: Menu;
  private descText: TextRenderer;
  private phase: Phase = 'selectItem';
  private selectedItemId = '';

  constructor(game: Game) {
    this.game = game;
    this.itemWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 700 });
    this.descWindow = new Window({ x: SCREEN_MARGIN, y: 748, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 200 });
    this.targetWindow = new Window({ x: 1200, y: SCREEN_MARGIN, width: 400, height: 300 });
    this.targetWindow.visible = false;
    this.descText = new TextRenderer({ width: this.descWindow.contentWidth });
    this.descText.position.set(this.descWindow.contentX, this.descWindow.contentY);
    this.descWindow.addChild(this.descText);
    this.container.addChild(this.itemWindow, this.descWindow, this.targetWindow);
  }

  enter(): void {
    this.phase = 'selectItem';
    this.targetWindow.visible = false;
    this.buildItemMenu();
  }

  private buildItemMenu(): void {
    if (this.itemMenu) this.itemWindow.removeChild(this.itemMenu);
    const inv = this.game.inventory.getAll();
    const items: MenuItem[] = inv.map(({ itemId, quantity }) => {
      const data = ItemRegistry.getItem(itemId);
      const name = data?.name ?? itemId;
      const isKey = data?.type === 'key';
      return { label: `${name} x${quantity}`, value: itemId, enabled: !isKey };
    });
    if (items.length === 0) items.push({ label: 'No items', value: '', enabled: false });
    this.itemMenu = new Menu({
      items,
      x: this.itemWindow.contentX,
      y: this.itemWindow.contentY,
      maxVisible: 10,
      onSelect: (item) => this.onItemSelect(item),
      onCancel: () => this.game.scenes.pop(),
    });
    this.itemWindow.addChild(this.itemMenu);
    this.updateDescription();
  }

  private buildTargetMenu(): void {
    if (this.targetMenu) this.targetWindow.removeChild(this.targetMenu);
    const items: MenuItem[] = this.game.party.all.map((c, i) => ({ label: c.name, value: String(i) }));
    this.targetMenu = new Menu({
      items,
      x: this.targetWindow.contentX,
      y: this.targetWindow.contentY,
      onSelect: (item) => this.onTargetSelect(item),
      onCancel: () => { this.phase = 'selectItem'; this.targetWindow.visible = false; },
    });
    this.targetWindow.addChild(this.targetMenu);
  }

  update(_dt: number): void {
    if (this.phase === 'selectItem') {
      const prevIdx = this.itemMenu.selectedIndex;
      this.itemMenu.update(this.game.input);
      if (this.itemMenu.selectedIndex !== prevIdx) this.updateDescription();
    } else {
      this.targetMenu.update(this.game.input);
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}

  private updateDescription(): void {
    const item = ItemRegistry.getItem(this.itemMenu.selectedItem.value);
    this.descText.setText(item ? item.name : '', true);
  }

  private onItemSelect(item: MenuItem): void {
    this.selectedItemId = item.value;
    // Party-wide items (tent/cabin) skip target selection
    if (ItemEffects.isPartyItem(item.value)) {
      const result = ItemEffects.applyPartyItemEffect(item.value, this.game.party.all, this.game.inventory);
      this.descText.setText(result.message, true);
      this.buildItemMenu();
      return;
    }
    this.phase = 'selectTarget';
    this.targetWindow.visible = true;
    this.buildTargetMenu();
  }

  private onTargetSelect(item: MenuItem): void {
    const target = this.game.party.get(Number(item.value));
    if (target) {
      const result = ItemEffects.applyItemEffect(this.selectedItemId, target, this.game.inventory);
      this.descText.setText(result.message, true);
    }
    this.phase = 'selectItem';
    this.targetWindow.visible = false;
    this.buildItemMenu();
  }
}
