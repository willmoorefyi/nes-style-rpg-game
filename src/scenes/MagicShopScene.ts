import { Container, BitmapText } from 'pixi.js';
import type { Scene, SpellData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { ShopRegistry } from '../data/ShopRegistry.js';
import type { Character } from '../entities/Character.js';
import { NES_FONT } from '../ui/NESFont.js';
import { HelpWindow, HELP_RECT } from '../ui/HelpWindow.js';
import { canLearn, learnersLine } from './shop/spellLearners.js';
import { buySpell, spellPrice } from '../systems/SpellPurchase.js';
import { GAME_WIDTH, FONT_SIZE, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type State = 'spells' | 'character' | 'slot';

const GREY = 0x808080;
const INFO_Y = 748;
const INFO_HEIGHT = HELP_RECT.y - SCREEN_MARGIN - INFO_Y;

export class MagicShopScene implements Scene {
  readonly container = new Container();
  private state: State = 'spells';
  private spells: SpellData[] = [];
  private selectedSpell: SpellData | null = null;
  private eligibleMembers: Character[] = [];
  private selectedMember: Character | null = null;
  
  private mainWindow!: Window;
  private goldWindow!: Window;
  private goldText!: BitmapText;
  private infoWindow!: Window;
  private learnText!: BitmapText;
  private help!: HelpWindow;
  private spellMenu!: Menu;
  private charMenu!: Menu;
  private slotMenu!: Menu;
  private messageText!: BitmapText;

  constructor(private readonly game: Game, private readonly shopId: string) {}

  enter(): void {
    const shop = ShopRegistry.getShop(this.shopId);
    if (!shop) return;

    this.spells = shop.inventory
      .map(id => SpellRegistry.getSpell(id))
      .filter((s): s is SpellData => !!s);

    this.mainWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: INFO_Y - 2 * SCREEN_MARGIN });
    this.container.addChild(this.mainWindow);

    // gold (left) and the learners / result lines (right) above the help bar at the bottom
    this.goldWindow = new Window({ x: SCREEN_MARGIN, y: INFO_Y, width: 500, height: INFO_HEIGHT });
    this.container.addChild(this.goldWindow);
    this.goldText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.goldText.position.set(this.goldWindow.contentX, this.goldWindow.contentY);
    this.goldWindow.addChild(this.goldText);
    this.updateGold();

    const infoX = SCREEN_MARGIN + 500 + SCREEN_MARGIN;
    this.infoWindow = new Window({ x: infoX, y: INFO_Y, width: GAME_WIDTH - SCREEN_MARGIN - infoX, height: INFO_HEIGHT });
    this.learnText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.learnText.position.set(this.infoWindow.contentX, this.infoWindow.contentY);
    this.messageText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.messageText.position.set(this.infoWindow.contentX, this.infoWindow.contentY + FONT_SIZE + 12);
    this.infoWindow.addChild(this.learnText, this.messageText);
    this.help = new HelpWindow();
    this.container.addChild(this.infoWindow, this.help);

    this.showSpellMenu();
  }

  private updateGold(): void {
    this.goldText.text = `Gold: ${this.game.party.gold}`;
  }

  private showSpellMenu(): void {
    this.state = 'spells';
    this.clearMenus();

    const items: MenuItem[] = this.spells.map(s => ({
      label: `${s.name} L${s.level} ${spellPrice(s)}G`,
      value: s.id,
      enabled: this.game.party.gold >= spellPrice(s)
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
    this.showSpellInfo();
  }

  /** The help bar's text (the highlighted spell's description). */
  get helpText(): string { return this.help?.text ?? ''; }
  /** The learners line ("Learn: WM RM") and whether it is greyed (nobody in the party can learn the spell). */
  get learners(): { text: string; greyed: boolean } {
    return { text: this.learnText?.text ?? '', greyed: this.learnText?.tint === GREY };
  }

  /** Description and learners of the spell under the cursor. */
  private showSpellInfo(): void {
    const spell = SpellRegistry.getSpell(this.spellMenu?.selectedItem?.value ?? '');
    this.help.setText(spell?.description ?? '');
    this.learnText.text = spell ? learnersLine(spell) : '';
    const anyone = spell ? this.game.party.all.some((c) => canLearn(c, spell)) : false;
    this.learnText.tint = anyone ? 0xffffff : GREY;
  }

  private onSpellSelect(spellId: string): void {
    const spell = SpellRegistry.getSpell(spellId);
    if (!spell) return;
    this.selectedSpell = spell;

    this.eligibleMembers = this.game.party.all.filter((c) => canLearn(c, spell));

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
    const spell = this.selectedSpell!;
    // gold is taken only after learnSpell succeeds
    const result = buySpell(this.game.party, this.selectedMember!, spell, spellPrice(spell));
    if (!result.ok) {
      this.showMessage(result.message);
      return;
    }
    this.updateGold();
    this.showSpellMenu();
    this.showMessage(result.message);
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
    if (this.state === 'spells' && this.spellMenu) {
      const prev = this.spellMenu.selectedIndex;
      this.spellMenu.update(input);
      if (this.state === 'spells' && this.spellMenu.selectedIndex !== prev) this.showSpellInfo();
    }
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
