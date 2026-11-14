import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import type { ExplorationScene } from './ExplorationScene.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { HelpWindow, HELP_RECT } from '../ui/HelpWindow.js';
import type { Character } from '../entities/Character.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { ItemEffects } from '../systems/ItemEffects.js';
import { isFallen } from '../systems/FieldSpellEffects.js';
import { GAME_WIDTH, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type Phase = 'selectItem' | 'selectTarget';

/** A target row: `NAME  HP cur/max  STATUS` (MS-7), so the player sees who needs the item. */
export function targetLabel(c: Character, nameWidth: number): string {
  const status = isFallen(c) ? 'KO' : c.statusTracker.getAll().map((s) => s.effect.toUpperCase()).join(' ');
  const hp = `HP ${String(c.currentHp).padStart(3)}/${String(c.maxHp).padStart(3)}`;
  return `${c.name.padEnd(nameWidth)}  ${hp}${status ? `  ${status}` : ''}`;
}

export class ItemMenuScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private itemWindow: Window;
  private descWindow: HelpWindow;
  private targetWindow: Window;
  private itemMenu!: Menu;
  private targetMenu!: Menu;
  private phase: Phase = 'selectItem';
  private selectedItemId = '';

  constructor(game: Game) {
    this.game = game;
    // the list ends 24 px above the help bar at the bottom (y 900)
    this.itemWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: HELP_RECT.y - 2 * SCREEN_MARGIN });
    this.descWindow = new HelpWindow();
    this.targetWindow = new Window({ x: 1000, y: SCREEN_MARGIN, width: 896, height: 300 });
    this.targetWindow.visible = false;
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
    const party = this.game.party.all;
    const nameWidth = Math.max(0, ...party.map((c) => c.name.length));
    const items: MenuItem[] = party.map((c, i) => ({ label: targetLabel(c, nameWidth), value: String(i) }));
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

  /** The help bar's text (the highlighted item's description, or the last result). */
  get helpText(): string { return this.descWindow.text; }

  private updateDescription(): void {
    const item = ItemRegistry.getItem(this.itemMenu.selectedItem.value);
    this.descWindow.setText(item?.description ?? '');
  }

  private onItemSelect(item: MenuItem): void {
    this.selectedItemId = item.value;
    // Party-wide items (tent/cabin) skip target selection
    if (ItemEffects.isPartyItem(item.value)) {
      // MS-8: camping only where the map allows it (FF1: the world map); the item is kept
      const exploration = this.game.scenes.get<ExplorationScene>('exploration');
      if (!(exploration?.canCamp() ?? false)) {
        this.descWindow.setText("You can't camp here.");
        return;
      }
      const result = ItemEffects.applyPartyItemEffect(item.value, this.game.party.all, this.game.inventory);
      this.buildItemMenu();
      this.descWindow.setText(result.message);
      return;
    }
    this.phase = 'selectTarget';
    this.targetWindow.visible = true;
    this.buildTargetMenu();
  }

  private onTargetSelect(item: MenuItem): void {
    const target = this.game.party.get(Number(item.value));
    let result: { message: string } | undefined;
    if (target) {
      result = ItemEffects.applyItemEffect(this.selectedItemId, target, this.game.inventory);
    }
    this.phase = 'selectItem';
    this.targetWindow.visible = false;
    this.buildItemMenu();
    if (result) this.descWindow.setText(result.message);
  }
}
