import { Container, BitmapText } from 'pixi.js';
import type { Scene, SpellData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import type { Character } from '../entities/Character.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { NES_FONT } from '../ui/NESFont.js';
import { HelpWindow, HELP_RECT } from '../ui/HelpWindow.js';
import { castFieldSpell, isFallen, isFieldSpell } from '../systems/FieldSpellEffects.js';
import { GAME_WIDTH, SCREEN_MARGIN, FONT_SIZE } from '../core/LayoutConstants.js';

type Phase = 'selectCaster' | 'selectSpell' | 'selectTarget';
type FieldSpell = { spell: SpellData; level: number };

export class FieldMagicScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private partyWindow: Window;
  private spellWindow: Window;
  private targetWindow: Window;
  private partyMenu!: Menu;
  private spellMenu?: Menu;
  private targetMenu?: Menu;
  private messageText: BitmapText;
  private help = new HelpWindow();
  private phase: Phase = 'selectCaster';
  private selectedCasterIdx = 0;
  private spells: FieldSpell[] = [];
  private selected: FieldSpell | null = null;

  constructor(game: Game) {
    this.game = game;
    this.partyWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 500, height: 300 });
    // ends 24 px above the help bar (y 900)
    this.spellWindow = new Window({ x: SCREEN_MARGIN, y: 348, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: HELP_RECT.y - SCREEN_MARGIN - 348 });
    this.targetWindow = new Window({ x: 548, y: SCREEN_MARGIN, width: 500, height: 300 });
    this.spellWindow.visible = false;
    this.targetWindow.visible = false;
    // message line at the foot of the spell window: results, "No effect.", "No field spells."
    this.messageText = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
    this.messageText.position.set(this.spellWindow.contentX, this.spellWindow.contentY + 300);
    this.spellWindow.addChild(this.messageText);
    this.help.visible = false;
    this.container.addChild(this.partyWindow, this.spellWindow, this.targetWindow, this.help);
  }

  /** The current message line (results and notices). */
  get message(): string { return this.messageText.text; }
  /** The help bar's text while it is shown (the highlighted spell's description), else ''. */
  get helpText(): string { return this.help.visible ? this.help.text : ''; }

  enter(): void {
    this.phase = 'selectCaster';
    this.spellWindow.visible = false;
    this.targetWindow.visible = false;
    this.help.visible = false;
    this.messageText.text = '';
    this.buildPartyMenu();
  }

  private showMessage(text: string): void {
    this.messageText.text = text;
    this.spellWindow.visible = true;
  }

  private buildPartyMenu(): void {
    const prev = this.partyMenu?.selectedIndex ?? 0;
    if (this.partyMenu) this.partyWindow.removeChild(this.partyMenu);
    // the fallen can't cast
    const items: MenuItem[] = this.game.party.all.map((c, i) => ({ label: c.name, value: String(i), enabled: !isFallen(c) }));
    this.partyMenu = new Menu({
      items,
      x: this.partyWindow.contentX,
      y: this.partyWindow.contentY,
      onSelect: (item) => this.onCasterSelect(Number(item.value)),
      onCancel: () => this.game.scenes.pop(),
    });
    this.partyMenu.setIndex(prev);
    this.partyWindow.addChild(this.partyMenu);
  }

  private onCasterSelect(idx: number): void {
    this.selectedCasterIdx = idx;
    const caster = this.game.party.get(idx);
    if (!caster || isFallen(caster)) return;
    this.spells = caster.getLearnedSpells()
      .map(({ spellId, level }) => ({ spell: SpellRegistry.getSpell(spellId), level }))
      .filter((e): e is FieldSpell => e.spell != null && isFieldSpell(e.spell));
    if (this.spells.length === 0) {
      this.showMessage(`${caster.name} has no field spells.`);
      return;
    }
    this.messageText.text = '';
    this.phase = 'selectSpell';
    this.spellWindow.visible = true;
    this.dropMenus();
    this.buildSpellMenu(caster);
  }

  private buildSpellMenu(caster: Character): void {
    const prev = this.spellMenu?.selectedIndex ?? 0;
    if (this.spellMenu) this.spellWindow.removeChild(this.spellMenu);
    const items: MenuItem[] = this.spells.map(({ spell, level }) => {
      const charges = caster.getSpellCharges(level);
      return { label: `${spell.name} (${charges})`, value: spell.id, enabled: charges > 0 };
    });
    this.spellMenu = new Menu({
      items,
      x: this.spellWindow.contentX,
      y: this.spellWindow.contentY,
      maxVisible: 6,
      onSelect: (_item, i) => this.onSpellSelect(i),
      onCancel: () => { this.phase = 'selectCaster'; this.spellWindow.visible = false; this.help.visible = false; },
    });
    this.spellMenu.setIndex(Math.min(prev, items.length - 1));
    this.spellWindow.addChild(this.spellMenu);
    this.showSpellHelp();
  }

  /** The help bar describes the spell under the cursor while the spell list is open. */
  private showSpellHelp(): void {
    const spell = this.spellMenu ? this.spells[this.spellMenu.selectedIndex]?.spell : undefined;
    this.help.visible = this.phase !== 'selectCaster' && spell !== undefined;
    this.help.setText(spell?.description ?? '');
  }

  private onSpellSelect(i: number): void {
    this.selected = this.spells[i] ?? null;
    if (!this.selected) return;
    if (this.selected.spell.targeting === 'all_allies') {
      // party-wide spells need no target pick
      this.cast([...this.game.party.all]);
      return;
    }
    this.phase = 'selectTarget';
    this.targetWindow.visible = true;
    if (this.targetMenu) this.targetWindow.removeChild(this.targetMenu);
    this.targetMenu = undefined;
    this.buildTargetMenu();
  }

  /** A new caster starts at the top of fresh spell and target lists. */
  private dropMenus(): void {
    if (this.spellMenu) this.spellWindow.removeChild(this.spellMenu);
    if (this.targetMenu) this.targetWindow.removeChild(this.targetMenu);
    this.spellMenu = undefined;
    this.targetMenu = undefined;
  }

  private buildTargetMenu(): void {
    const prev = this.targetMenu?.selectedIndex ?? 0;
    if (this.targetMenu) this.targetWindow.removeChild(this.targetMenu);
    const items: MenuItem[] = this.game.party.all.map((c, i) => ({ label: `${c.name} ${c.currentHp}/${c.maxHp}`, value: String(i) }));
    this.targetMenu = new Menu({
      items,
      x: this.targetWindow.contentX,
      y: this.targetWindow.contentY,
      onSelect: (item) => {
        const target = this.game.party.get(Number(item.value));
        if (target) this.cast([target]);
      },
      onCancel: () => { this.phase = 'selectSpell'; this.targetWindow.visible = false; },
    });
    this.targetMenu.setIndex(prev);
    this.targetWindow.addChild(this.targetMenu);
  }

  private cast(targets: Character[]): void {
    const caster = this.game.party.get(this.selectedCasterIdx);
    if (!caster || !this.selected) return;
    const { spell, level } = this.selected;
    if (!caster.hasCharges(level)) { this.showMessage('No charges left.'); return; }
    const result = castFieldSpell(spell, caster, targets);
    if (result.used && !caster.useCharge(level)) console.error(`FieldMagicScene: ${caster.name} had no charge for ${spell.id}`);
    this.showMessage(result.messages.join('\n'));
    // refresh the HP and charge labels; keep picking targets while charges remain
    this.buildSpellMenu(caster);
    if (this.phase === 'selectTarget' && caster.hasCharges(level)) {
      this.buildTargetMenu();
    } else {
      this.phase = 'selectSpell';
      this.targetWindow.visible = false;
    }
    this.buildPartyMenu();
  }

  update(_dt: number): void {
    if (this.phase === 'selectCaster') this.partyMenu.update(this.game.input);
    else if (this.phase === 'selectSpell' && this.spellMenu) {
      const prev = this.spellMenu.selectedIndex;
      this.spellMenu.update(this.game.input);
      if (this.phase === 'selectSpell' && this.spellMenu.selectedIndex !== prev) this.showSpellHelp();
    }
    else if (this.phase === 'selectTarget' && this.targetMenu) this.targetMenu.update(this.game.input);
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}
}
