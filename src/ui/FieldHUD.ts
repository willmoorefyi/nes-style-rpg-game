import { Container, BitmapText } from 'pixi.js';
import { NES_FONT } from './NESFont.js';
import { Window } from './Window.js';
import { NAME_MAX_LENGTH } from './NameEntryGrid.js';
import type { PartyManager } from '../entities/PartyManager.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_SIZE, CHAR_WIDTH, SCREEN_MARGIN, WINDOW_BORDER_OUTER, WINDOW_BORDER_INNER, WINDOW_PADDING } from '../core/LayoutConstants.js';

/** Inset of the text inside a HUD panel: the window border plus a small gap. */
const INSET = WINDOW_BORDER_OUTER + WINDOW_BORDER_INNER + 6;
/** HUD panel height: one line of text. */
export const HUD_PANEL_HEIGHT = FONT_SIZE + 2 * INSET;
/** The gold panel always fits this many characters ("99999G"). */
const GOLD_CHARS = 6;
const PARTY_COLUMNS = 4;

/** Field HUD (UI-1): the map name (top left), the gold (top right) and the party's HP (bottom), each in a panel. */
export class FieldHUD {
  readonly container = new Container();
  readonly mapPanel: Window;
  readonly goldPanel: Window;
  readonly hpPanel: Window;
  private mapNameText: BitmapText;
  private goldText: BitmapText;
  private hpTexts: BitmapText[] = [];

  constructor(party: PartyManager) {
    const style = { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff };
    const text = (): BitmapText => {
      const t = new BitmapText({ text: '', style });
      t.position.set(INSET, INSET);
      return t;
    };

    this.mapPanel = new Window({ x: SCREEN_MARGIN, y: SCREEN_MARGIN, width: 2 * INSET, height: HUD_PANEL_HEIGHT });
    this.mapNameText = text();
    this.mapPanel.addChild(this.mapNameText);
    this.mapPanel.visible = false;

    const goldWidth = GOLD_CHARS * CHAR_WIDTH + 2 * INSET;
    this.goldPanel = new Window({ x: GAME_WIDTH - SCREEN_MARGIN - goldWidth, y: SCREEN_MARGIN, width: goldWidth, height: HUD_PANEL_HEIGHT });
    this.goldText = text();
    this.goldPanel.addChild(this.goldText);

    const hpWidth = GAME_WIDTH - 2 * SCREEN_MARGIN;
    this.hpPanel = new Window({ x: SCREEN_MARGIN, y: GAME_HEIGHT - SCREEN_MARGIN - HUD_PANEL_HEIGHT, width: hpWidth, height: HUD_PANEL_HEIGHT });
    const column = (hpWidth - 2 * INSET) / PARTY_COLUMNS;
    for (let i = 0; i < PARTY_COLUMNS; i++) {
      const t = text();
      t.x = INSET + i * column;
      this.hpTexts.push(t);
      this.hpPanel.addChild(t);
    }

    this.container.addChild(this.mapPanel);
    this.container.addChild(this.goldPanel);
    this.container.addChild(this.hpPanel);

    this.update(party);
  }

  setMapName(name: string): void {
    const label = name.toUpperCase();
    this.mapNameText.text = label;
    this.mapPanel.resize(label.length * CHAR_WIDTH + 2 * INSET, HUD_PANEL_HEIGHT);
    this.mapPanel.visible = label.length > 0;
  }

  setGold(gold: number): void {
    const text = `${gold}G`;
    this.goldText.text = text;
    // right-aligned inside the panel (the panel grows only past 99999G)
    const width = Math.max(GOLD_CHARS, text.length) * CHAR_WIDTH + 2 * INSET;
    this.goldPanel.resize(width, HUD_PANEL_HEIGHT);
    this.goldPanel.x = GAME_WIDTH - SCREEN_MARGIN - width;
    this.goldText.x = width - INSET - text.length * CHAR_WIDTH;
  }

  update(party: PartyManager): void {
    this.setGold(party.gold);
    const members = party.all;
    this.hpTexts.forEach((t, i) => {
      const m = members[i];
      t.text = m ? `${m.name.slice(0, NAME_MAX_LENGTH).padEnd(NAME_MAX_LENGTH)} ${m.currentHp}/${m.maxHp}` : '';
    });
    this.hpPanel.visible = members.length > 0;
  }

  /** A panel's screen box (its drawn size, not the bounds of what it holds). */
  panelBox(panel: Window): { x: number; y: number; width: number; height: number } {
    return windowBox(panel);
  }

  /** The party strip's texts, one per column (for tests and layout checks). */
  get hpLines(): readonly string[] {
    return this.hpTexts.map((t) => t.text);
  }
}

/** A window's drawn box on screen (its parent is at the origin). */
export function windowBox(w: Window): { x: number; y: number; width: number; height: number } {
  return { x: w.x, y: w.y, width: w.contentWidth + 2 * WINDOW_PADDING, height: w.contentHeight + 2 * WINDOW_PADDING };
}
