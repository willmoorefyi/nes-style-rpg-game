import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { TextRenderer } from '../ui/TextRenderer.js';
import { WIDTH, HEIGHT } from '../core/Game.js';

export class StatusScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private window: Window;
  private text: TextRenderer;
  private memberIndex = 0;

  constructor(game: Game) {
    this.game = game;
    this.window = new Window({ x: 8, y: 8, width: WIDTH - 16, height: HEIGHT - 16 });
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
      `Level: ${char.level}  XP: ${char.xp}`,
      `HP: ${char.currentHp}/${char.maxHp}`,
      ``,
      `STR: ${s.strength}  AGI: ${s.agility}`,
      `INT: ${s.intelligence}  VIT: ${s.vitality}`,
      `LCK: ${s.luck}`,
      `ATK: ${s.attack}  DEF: ${s.defense}`,
      ``,
      `Equipment:`,
      ` Weapon: ${char.getEquipped('weapon')?.name ?? 'None'}`,
      ` Armor:  ${char.getEquipped('armor')?.name ?? 'None'}`,
      ` Shield: ${char.getEquipped('shield')?.name ?? 'None'}`,
      ` Helmet: ${char.getEquipped('helmet')?.name ?? 'None'}`,
    ];
    this.text.setText(lines.join('\n'), true);
  }
}