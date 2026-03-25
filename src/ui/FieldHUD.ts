import { Container, BitmapText } from 'pixi.js';
import { NES_FONT } from './NESFont.js';
import type { PartyManager } from '../entities/PartyManager.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE, CHAR_WIDTH } from '../core/LayoutConstants.js';

/** Minimal field HUD: map name (top-left), gold (top-right), party HP (bottom) */
export class FieldHUD {
  readonly container = new Container();
  private mapNameText: BitmapText;
  private goldText: BitmapText;
  private hpText: BitmapText;

  constructor(party: PartyManager) {
    const style = { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff };

    // Map name - top left
    this.mapNameText = new BitmapText({ text: '', style });
    this.mapNameText.x = 12;
    this.mapNameText.y = 6;

    // Gold - top right
    this.goldText = new BitmapText({ text: '', style });
    this.goldText.y = 6;

    // Party HP strip - bottom
    this.hpText = new BitmapText({ text: '', style });
    this.hpText.x = 12;
    this.hpText.y = GAME_HEIGHT - 48;

    this.container.addChild(this.mapNameText);
    this.container.addChild(this.goldText);
    this.container.addChild(this.hpText);

    this.update(party);
  }

  setMapName(name: string): void {
    this.mapNameText.text = name.toUpperCase();
  }

  setGold(gold: number): void {
    const text = `${gold}G`;
    this.goldText.text = text;
    this.goldText.x = GAME_WIDTH - 12 - text.length * CHAR_WIDTH;
  }

  update(party: PartyManager): void {
    this.setGold(party.gold);
    const parts: string[] = [];
    for (const member of party.all) {
      parts.push(`${member.name.slice(0, 5)} ${member.currentHp}/${member.maxHp}`);
    }
    this.hpText.text = parts.join(' ');
  }
}
