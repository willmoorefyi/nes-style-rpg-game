import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { SLOT_LABELS } from '../ui/labels.js';
import { partyRowData } from '../ui/PartyPanel.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { SPELL_LEVELS } from '../entities/SpellCharges.js';
import type { Character } from '../entities/Character.js';
import type { EquipmentSlot } from '../types/index.js';
import { GAME_WIDTH, GAME_HEIGHT, SCREEN_MARGIN } from '../core/LayoutConstants.js';

const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['weapon', 'armor', 'shield', 'helmet'];

/** MS-7: one line per spell level the member has charges or spells in: "L1 2/2  CURE, FIRE". */
export function spellLines(char: Character): string[] {
  const out: string[] = [];
  for (let lv = 1; lv <= SPELL_LEVELS; lv++) {
    const max = char.getMaxCharges(lv);
    const names = char.getSpellsAtLevel(lv).map((id) => SpellRegistry.getSpell(id)?.name ?? id);
    if (max === 0 && names.length === 0) continue;
    out.push(` L${lv} ${char.getSpellCharges(lv)}/${max}  ${names.length > 0 ? names.join(', ') : '-'}`);
  }
  return out.length > 0 ? ['', 'Spells:', ...out] : [];
}

export class StatusScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private window: Window;
  private text: TextRenderer;
  private memberIndex = 0;

  constructor(game: Game) {
    this.game = game;
    this.window = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: GAME_HEIGHT - 2 * SCREEN_MARGIN });
    this.text = new TextRenderer({ width: this.window.contentWidth });
    this.text.position.set(this.window.contentX, this.window.contentY);
    this.window.addChild(this.text);
    this.container.addChild(this.window);
  }

  enter(): void {
    this.memberIndex = 0;
    this.render();
  }

  update(_dt: number): void {
    const input = this.game.input;
    const party = this.game.party;
    if (input.isJustPressed('left')) {
      this.memberIndex = (this.memberIndex - 1 + party.size) % party.size;
      this.render();
    } else if (input.isJustPressed('right')) {
      this.memberIndex = (this.memberIndex + 1) % party.size;
      this.render();
    } else if (input.isJustPressed('cancel')) {
      this.game.scenes.pop();
    }
  }

  onPause(): void {}
  onResume(): void {}

  exit(): void {}

  private render(): void {
    const char = this.game.party.get(this.memberIndex);
    if (!char) {
      this.text.setText('No party members', true);
      return;
    }
    const s = char.stats;
    const lines = [
      `${char.name} (${this.memberIndex + 1}/${this.game.party.size})`,
      `Class: ${char.classData.name}`,
      `Level: ${char.level}  XP: ${char.xp}  ${partyRowData(char).next}`,
      `HP: ${char.currentHp}/${char.maxHp}`,
      ``,
      `STR: ${s.strength}  AGI: ${s.agility}`,
      `INT: ${s.intelligence}  VIT: ${s.vitality}`,
      `LCK: ${s.luck}`,
      `ATK: ${s.attack}  DEF: ${s.defense}`,
      ``,
      `Equipment:`,
      ...EQUIPMENT_SLOTS.map((slot) => ` ${`${SLOT_LABELS[slot]}:`.padEnd(8)}${char.getEquipped(slot)?.name ?? 'None'}`),
      ...spellLines(char),
    ];
    this.text.setText(lines.join('\n'), true);
  }
}
