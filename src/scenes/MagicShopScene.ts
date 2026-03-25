import { Container, BitmapText } from 'pixi.js';
import type { Scene, SpellData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { ShopRegistry } from '../data/ShopRegistry.js';
import type { Character } from '../entities/Character.js';
import { NES_FONT } from '../ui/NESFont.js';
import { GAME_WIDTH, FONT_SIZE, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type State = 'spells' | 'character' | 'slot';

const SPELL_PRICE_BASE = 100;

export class MagicShopScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private shopId: string;
  private state: State = 'spells';
  private spells: SpellData[] = [];
  private selectedSpell: SpellData | null = null;
  private eligibleMembers: Character[] = [];
  private selectedMember: Character | null = null;
  
  private mainWindow!: Window;
  private goldWindow!: Window;
  private goldText!: BitmapText;
  private spellMenu!: Menu;
  private charMenu!: Menu;
  private slotMenu!: Menu;
  private messageText!: BitmapText;

  constructor(game: Game, shopId: string) {
    this.game = game;
    this.shopId = shopId;
  }

  enter(): void {
    const shop = ShopRegistry.getShop(this.shopId);
    if (!shop) return;

    this.spells = shop.inventory
      .map(id => SpellRegistry.getSpell(id))
      .filter((s): s is SpellData => !!s);

    this.mainWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 800 });
    this.container.addChild(this.mainWindow);

    this.goldWindow = new Window({ x: SCREEN_MARGIN, y: 848, width: 500, height: 100 });
    this.container.addChild(this.goldWindow);
    this.goldText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.goldText.position.set(this.goldWindow.contentX, this.goldWindow.contentY);
    this.goldWindow.addChild(this.goldText);
    this.updateGold();

    this.messageText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.messageText.position.set(600, 880);
    this.container.addChild(this.messageText);

    this.showSpellMenu();
  }

  private updateGold(): void {
    this.goldText.text = `Gold: ${this.game.party.gold}`;
  }

  private getSpellPrice(spell: SpellData): number {
    return SPELL_PRICE_BASE * spell.level;
  }

  private showSpellMenu(): void {
    this.state = 'spells';
    this.clearMenus();

    const items: MenuItem[] = this.spells.map(s => ({
      label: `${s.name} L${s.level} ${this.getSpellPrice(s)}G`,
      value: s.id,
      enabled: this.game.party.gold >= this.getSpellPrice(s)
    }));

    this.spellMenu = new Menu({
      items,
      x: this.mainWindow.contentX + 8,
      y: this.mainWindow.contentY + 8,
      maxVisible: 12,
      eventBus: this.game.events,
      onSelect: (item) => this.onSpellSelect(item.value),
      onCancel: () => this.exitScene()
    });
    this.mainWindow.addChild(this.spellMenu);
  }

  private onSpellSelect(spellId: string): void {
    const spell = SpellRegistry.getSpell(spellId);
    if (!spell) return;
    this.selectedSpell = spell;

    this.eligibleMembers = this.game.party.all.filter(c => {
      const maxLevel = c.classData.spellLevels[spell.type];
      return maxLevel >= spell.level;
    });

    if (this.eligibleMembers.length === 0) {
      this.showMessage('No one can learn this.');
      return;
    }

    this.showCharacterMenu();
  }

  private showCharacterMenu(): void {
    this.state = 'character';
    this.clearMenus();

    const items: MenuItem[] = this.eligibleMembers.map(c => {
      const knows = c.getLearnedSpells().some(s => s.spellId === this.selectedSpell!.id);
      return {
        label: knows ? `${c.name} (known)` : c.name,
        value: c.name,
        enabled: !knows
      };
    });

    this.charMenu = new Menu({
      items,
      x: this.mainWindow.contentX + 8,
      y: this.mainWindow.contentY + 8,
      maxVisible: 4,
      eventBus: this.game.events,
      onSelect: (_, idx) => this.onCharSelect(idx),
      onCancel: () => this.showSpellMenu()
    });
    this.mainWindow.addChild(this.charMenu);
  }

  private onCharSelect(idx: number): void {
    this.selectedMember = this.eligibleMembers[idx];
    this.showSlotMenu();
  }

  private showSlotMenu(): void {
    this.state = 'slot';
    this.clearMenus();

    const level = this.selectedSpell!.level;
    const knownAtLevel = this.selectedMember!.getSpellsAtLevel(level);
    const maxSlots = 3;

    const items: MenuItem[] = [];
    for (let i = 0; i < maxSlots; i++) {
      const spellId = knownAtLevel[i];
      const spell = spellId ? SpellRegistry.getSpell(spellId) : null;
      items.push({
        label: spell ? spell.name : '---',
        value: String(i),
        enabled: !spell
      });
    }

    this.slotMenu = new Menu({
      items,
      x: this.mainWindow.contentX + 8,
      y: this.mainWindow.contentY + 8,
      maxVisible: 3,
      eventBus: this.game.events,
      onSelect: () => this.confirmPurchase(),
      onCancel: () => this.showCharacterMenu()
    });
    this.mainWindow.addChild(this.slotMenu);
  }

  private confirmPurchase(): void {
    const price = this.getSpellPrice(this.selectedSpell!);
    if (!this.game.party.spendGold(price)) {
      this.showMessage('Not enough gold.');
      return;
    }

    this.selectedMember!.learnSpell(this.selectedSpell!.id, this.selectedSpell!.level);
    this.updateGold();
    this.showMessage(`${this.selectedMember!.name} learned ${this.selectedSpell!.name}!`);
    this.showSpellMenu();
  }

  private showMessage(msg: string): void {
    this.messageText.text = msg;
  }

  private clearMenus(): void {
    this.messageText.text = '';
    if (this.spellMenu) { this.mainWindow.removeChild(this.spellMenu); }
    if (this.charMenu) { this.mainWindow.removeChild(this.charMenu); }
    if (this.slotMenu) { this.mainWindow.removeChild(this.slotMenu); }
  }

  update(_dt: number): void {
    const input = this.game.input;
    if (this.state === 'spells' && this.spellMenu) this.spellMenu.update(input);
    else if (this.state === 'character' && this.charMenu) this.charMenu.update(input);
    else if (this.state === 'slot' && this.slotMenu) this.slotMenu.update(input);
  }

  private exitScene(): void {
    this.game.scenes.pop();
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}
}
