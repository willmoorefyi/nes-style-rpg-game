import { Container, BitmapText } from 'pixi.js';
import type { Scene, SpellData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu } from '../ui/Menu.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { ShopRegistry } from '../data/ShopRegistry.js';
import type { Character } from '../entities/Character.js';
import { NES_FONT } from '../ui/NESFont.js';
import { HelpWindow } from '../ui/HelpWindow.js';
import { canLearn } from './shop/spellLearners.js';
import { SpellLearnPanel, memberRows, spellRows } from './shop/SpellLearnPanel.js';
import { CHOICE_RECT, GOLD_RECT, listRect, type ShopRect } from './shop/shopLayout.js';
import { buySpell, spellPrice } from '../systems/SpellPurchase.js';
import { FONT_SIZE } from '../core/LayoutConstants.js';

type State = 'spells' | 'character';

const INPUT_ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel'] as const;

/**
 * The magic shop, laid out like the item shop (E4): the spell list on the left, who can learn the highlighted spell
 * on the right. Choosing a spell, then a member, buys it; spells fill their level in order (FF1), so there is no
 * slot step.
 */
export class MagicShopScene implements Scene {
  readonly container = new Container();
  /** The town stays visible around the windows (E5). */
  readonly transparent = true;
  private state: State = 'spells';
  private spells: SpellData[] = [];
  private selectedSpell: SpellData | null = null;
  private eligibleMembers: Character[] = [];

  private readonly nameWindow = new Window({ ...CHOICE_RECT });
  private readonly goldWindow = new Window({ ...GOLD_RECT });
  private readonly listWindow = new Window({ ...listRect(true) });
  private readonly panel = new SpellLearnPanel();
  private readonly help = new HelpWindow();
  private readonly goldText: BitmapText;
  private readonly messageText: BitmapText;
  private readonly nameText: BitmapText;
  private spellMenu?: Menu;
  private charMenu?: Menu;

  constructor(private readonly game: Game, private readonly shopId: string) {
    const line = (w: Window, dy: number): BitmapText => {
      const t = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
      t.position.set(w.contentX, w.contentY + dy);
      return w.addChild(t);
    };
    this.nameText = line(this.nameWindow, 0);
    this.goldText = line(this.goldWindow, 0);
    this.messageText = line(this.goldWindow, FONT_SIZE + 4);
    this.container.addChild(this.nameWindow, this.goldWindow, this.listWindow, this.panel.window, this.help);
  }

  enter(): void {
    const shop = ShopRegistry.getShop(this.shopId);
    if (!shop) {
      console.error(`MagicShopScene: unknown shop ${this.shopId}`);
      return;
    }
    this.nameText.text = shop.name;
    this.spells = shop.inventory
      .map(id => SpellRegistry.getSpell(id))
      .filter((s): s is SpellData => !!s);
    this.messageText.text = '';
    this.updateGold();
    this.showSpellMenu();
  }

  /** The current step: choosing a spell, or the member who learns it. */
  get phase(): State { return this.state; }
  /** The help bar's text (the highlighted spell's description). */
  get helpText(): string { return this.help.text; }
  /** The learners line ("Learn: WHM RDM") and whether it is greyed (nobody in the party can learn the spell). */
  get learners(): { text: string; greyed: boolean } { return this.panel.learners; }
  /** The panel's per-member lines (`W.MAG  knows`), while choosing a spell. */
  get panelLines(): string[] { return this.panel.lines; }
  /** The spell list's rectangle (the same as the item shop's while its panel is shown). */
  get listRect(): ShopRect { return listRect(true); }
  /** The rows of the menu that has the focus. */
  get menuItems(): Array<{ label: string; enabled: boolean }> {
    const items = this.state === 'spells' ? spellRows(this.spells, this.game.party.all, this.game.party.gold)
      : memberRows(this.selectedSpell!, this.eligibleMembers);
    return items.map((i) => ({ label: i.label, enabled: i.enabled !== false }));
  }
  /** The result line under the gold. */
  get message(): string { return this.messageText.text; }

  private updateGold(): void {
    this.goldText.text = `Gold: ${this.game.party.gold}G`;
  }

  private showSpellMenu(keepIndex = false): void {
    this.state = 'spells';
    const initialIndex = keepIndex ? this.spellMenu?.selectedIndex : undefined;
    this.clearMenus();
    this.spellMenu = new Menu({
      items: spellRows(this.spells, this.game.party.all, this.game.party.gold),
      x: this.listWindow.contentX,
      y: this.listWindow.contentY,
      maxVisible: 12,
      initialIndex,
      eventBus: this.game.events,
      onSelect: (item) => this.onSpellSelect(item.value),
      onCancel: () => this.game.scenes.pop(),
    });
    this.listWindow.addChild(this.spellMenu);
    this.showSpellInfo();
  }

  /** Description and learners of the spell under the cursor. */
  private showSpellInfo(): void {
    const spell = SpellRegistry.getSpell(this.spellMenu?.selectedItem?.value ?? '');
    this.help.setText(spell?.description ?? '');
    this.panel.show(spell, this.game.party.all, this.state === 'spells');
  }

  private onSpellSelect(spellId: string): void {
    const spell = SpellRegistry.getSpell(spellId);
    if (!spell) return;
    this.selectedSpell = spell;
    this.eligibleMembers = this.game.party.all.filter((c) => canLearn(c, spell));
    if (this.eligibleMembers.length === 0) {
      this.messageText.text = 'No one can learn this.';
      return;
    }
    this.showCharacterMenu();
  }

  /** The members who could learn the spell, in the panel; the spell list keeps its place with a grey cursor. */
  private showCharacterMenu(): void {
    this.state = 'character';
    this.spellMenu?.setActive(false);
    this.panel.show(this.selectedSpell!, this.game.party.all, false);
    this.charMenu = new Menu({
      items: memberRows(this.selectedSpell!, this.eligibleMembers),
      x: this.panel.window.contentX,
      y: this.panel.memberY,
      eventBus: this.game.events,
      onSelect: (_, idx) => this.confirmPurchase(this.eligibleMembers[idx]),
      onCancel: () => this.closeCharacterMenu(),
    });
    this.panel.window.addChild(this.charMenu);
  }

  private closeCharacterMenu(): void {
    if (this.charMenu) this.panel.window.removeChild(this.charMenu);
    this.charMenu = undefined;
    this.state = 'spells';
    this.spellMenu?.setActive(true);
    this.showSpellInfo();
  }

  private confirmPurchase(member: Character): void {
    const spell = this.selectedSpell!;
    // gold is taken only after learnSpell succeeds
    const result = buySpell(this.game.party, member, spell, spellPrice(spell));
    this.updateGold();
    this.showSpellMenu(true);
    this.messageText.text = result.message;
  }

  private clearMenus(): void {
    if (this.spellMenu) this.listWindow.removeChild(this.spellMenu);
    if (this.charMenu) this.panel.window.removeChild(this.charMenu);
    this.spellMenu = undefined;
    this.charMenu = undefined;
  }

  update(_dt: number): void {
    const input = this.game.input;
    // the result line stays until the next input
    if (this.messageText.text && INPUT_ACTIONS.some((a) => input.isJustPressed(a))) this.messageText.text = '';
    if (this.state === 'spells' && this.spellMenu) {
      const prev = this.spellMenu.selectedIndex;
      this.spellMenu.update(input);
      if (this.state === 'spells' && this.spellMenu && this.spellMenu.selectedIndex !== prev) this.showSpellInfo();
    } else if (this.state === 'character' && this.charMenu) {
      this.charMenu.update(input);
    }
  }

  onPause(): void {}
  onResume(): void {}
  exit(): void {}
}
