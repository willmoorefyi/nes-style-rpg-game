import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { GAME_WIDTH, SCREEN_MARGIN } from '../core/LayoutConstants.js';

type Phase = 'selectCaster' | 'selectSpell' | 'selectTarget';

/** Spell effects usable from the field menu */
const FIELD_VALID_EFFECTS = ['heal', 'cure_poison', 'cure_blind', 'cure_silence', 'revive'];

export class FieldMagicScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private partyWindow: Window;
  private spellWindow: Window;
  private targetWindow: Window;
  private partyMenu!: Menu;
  private spellMenu?: Menu;
  private targetMenu?: Menu;
  private phase: Phase = 'selectCaster';
  private selectedCasterIdx = 0;
  private selectedSpellId = '';
  private selectedSpellLevel = 0;

  constructor(game: Game) {
    this.game = game;
    this.partyWindow = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 500, height: 300 });
    this.spellWindow = new Window({ x: SCREEN_MARGIN, y: 348, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 600 });
    this.targetWindow = new Window({ x: 548, y: SCREEN_MARGIN, width: 500, height: 300 });
    this.spellWindow.visible = false;
    this.targetWindow.visible = false;
    this.container.addChild(this.partyWindow, this.spellWindow, this.targetWindow);
  }

  enter(): void {
    this.phase = 'selectCaster';
    this.spellWindow.visible = false;
    this.targetWindow.visible = false;
    this.buildPartyMenu();
  }

  private buildPartyMenu(): void {
    if (this.partyMenu) this.partyWindow.removeChild(this.partyMenu);
    const items: MenuItem[] = this.game.party.all.map((c, i) => ({ label: c.name, value: String(i) }));
    this.partyMenu = new Menu({
      items,
      x: this.partyWindow.contentX,
      y: this.partyWindow.contentY,
      onSelect: (item) => this.onCasterSelect(Number(item.value)),
      onCancel: () => this.game.scenes.pop(),
    });
    this.partyWindow.addChild(this.partyMenu);
  }

  private onCasterSelect(idx: number): void {
    this.selectedCasterIdx = idx;
    const caster = this.game.party.get(idx);
    if (!caster) return;
    const spells = caster.getLearnedSpells()
      .map(({ spellId, level }) => ({ spell: SpellRegistry.getSpell(spellId), level }))
      .filter((e): e is { spell: NonNullable<typeof e.spell>; level: number } =>
        e.spell != null && e.spell.type === 'white' && FIELD_VALID_EFFECTS.includes(e.spell.effect));
    if (spells.length === 0) return;
    this.phase = 'selectSpell';
    this.spellWindow.visible = true;
    this.buildSpellMenu(spells, caster);
  }

  private buildSpellMenu(spells: { spell: { id: string; name: string; level: number; effect: string }; level: number }[], caster: { getSpellCharges(l: number): number }): void {
    if (this.spellMenu) this.spellWindow.removeChild(this.spellMenu);
    const items: MenuItem[] = spells.map(({ spell, level }) => {
      const charges = caster.getSpellCharges(level);
      return { label: `${spell.name} (${charges})`, value: `${spell.id}:${level}`, enabled: charges > 0 };
    });
    this.spellMenu = new Menu({
      items,
      x: this.spellWindow.contentX,
      y: this.spellWindow.contentY,
      maxVisible: 6,
      onSelect: (item) => this.onSpellSelect(item.value),
      onCancel: () => { this.phase = 'selectCaster'; this.spellWindow.visible = false; },
    });
    this.spellWindow.addChild(this.spellMenu);
  }

  private onSpellSelect(val: string): void {
    const [spellId, levelStr] = val.split(':');
    this.selectedSpellId = spellId;
    this.selectedSpellLevel = Number(levelStr);
    this.phase = 'selectTarget';
    this.targetWindow.visible = true;
    this.buildTargetMenu();
  }

  private buildTargetMenu(): void {
    if (this.targetMenu) this.targetWindow.removeChild(this.targetMenu);
    const items: MenuItem[] = this.game.party.all.map((c, i) => ({ label: `${c.name} ${c.currentHp}/${c.maxHp}`, value: String(i) }));
    this.targetMenu = new Menu({
      items,
      x: this.targetWindow.contentX,
      y: this.targetWindow.contentY,
      onSelect: (item) => this.onTargetSelect(Number(item.value)),
      onCancel: () => { this.phase = 'selectSpell'; this.targetWindow.visible = false; },
    });
    this.targetWindow.addChild(this.targetMenu);
  }

  private onTargetSelect(idx: number): void {
    const caster = this.game.party.get(this.selectedCasterIdx);
    const target = this.game.party.get(idx);
    const spell = SpellRegistry.getSpell(this.selectedSpellId);
    if (!caster || !target || !spell) return;
    if (!caster.useCharge(this.selectedSpellLevel)) return;

    // Apply spell effect based on type
    switch (spell.effect) {
      case 'heal':
        target.currentHp = Math.min(target.maxHp, target.currentHp + (spell.power ?? 0));
        break;
      case 'cure_poison':
        target.statusTracker.remove('poison');
        break;
      case 'cure_blind':
        target.statusTracker.remove('blind');
        break;
      case 'cure_silence':
        target.statusTracker.remove('silence');
        break;
      case 'revive':
        if (target.currentHp <= 0) {
          target.statusTracker.remove('death');
          target.currentHp = 1;
        }
        break;
    }

    this.phase = 'selectCaster';
    this.spellWindow.visible = false;
    this.targetWindow.visible = false;
  }

  update(_dt: number): void {
    if (this.phase === 'selectCaster') this.partyMenu.update(this.game.input);
    else if (this.phase === 'selectSpell' && this.spellMenu) this.spellMenu.update(this.game.input);
    else if (this.phase === 'selectTarget' && this.targetMenu) this.targetMenu.update(this.game.input);
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}
}
