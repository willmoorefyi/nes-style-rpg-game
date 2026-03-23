import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { WIDTH } from '../core/Game.js';

type Phase = 'selectCaster' | 'selectSpell' | 'selectTarget';

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
    this.partyWindow = new Window({ x: 8, y: 8, width: 100, height: 64 });
    this.spellWindow = new Window({ x: 8, y: 80, width: WIDTH - 16, height: 100 });
    this.targetWindow = new Window({ x: 116, y: 8, width: 100, height: 64 });
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
        e.spell != null && e.spell.type === 'white' && e.spell.effect === 'heal');
    if (spells.length === 0) return;
    this.phase = 'selectSpell';
    this.spellWindow.visible = true;
    this.buildSpellMenu(spells, caster);
  }

  private buildSpellMenu(spells: { spell: { id: string; name: string; level: number }; level: number }[], caster: { getSpellCharges(l: number): number }): void {
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
    target.currentHp = Math.min(target.maxHp, target.currentHp + (spell.power ?? 0));
    this.phase = 'selectCaster';
    this.spellWindow.visible = false;
    this.targetWindow.visible = false;
  }

  update(_dt: number): void {
    if (this.phase === 'selectCaster') this.partyMenu.update(this.game.input);
    else if (this.phase === 'selectSpell' && this.spellMenu) this.spellMenu.update(this.game.input);
    else if (this.phase === 'selectTarget' && this.targetMenu) this.targetMenu.update(this.game.input);
  }

  exit(): void {}
}
