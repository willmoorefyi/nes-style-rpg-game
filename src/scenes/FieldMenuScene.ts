import { Container, BitmapText } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Window } from '../ui/Window.js';
import { HelpWindow } from '../ui/HelpWindow.js';
import { Menu, type MenuItem } from '../ui/Menu.js';
import { PartyPanel } from '../ui/PartyPanel.js';
import { NES_FONT } from '../ui/NESFont.js';
import type { ExplorationScene } from './ExplorationScene.js';
import { wrapText } from '../ui/textUtils.js';
import { boostSummary } from '../core/Boosts.js';
import { SCREEN_MARGIN, FONT_SIZE, MENU_LINE_HEIGHT, WINDOW_PADDING, LINE_HEIGHT, CHAR_WIDTH } from '../core/LayoutConstants.js';

/** MS-7 layout (fix plan T6 revision 12): left pane x 24 w 360, party pane x 408 w 1488, rows 168 px; the shared
 * `HelpWindow` sits at `HELP_RECT` (y 900) below. */
export const LEFT_PANE = { x: SCREEN_MARGIN, width: 360 };
export const PARTY_PANE = { x: 408, width: 1488, rowHeight: 168, rows: 4 };
const INFO_HEIGHT = FONT_SIZE + 2 * WINDOW_PADDING;
const INFO_GAP = 12;

const COMMANDS: ReadonlyArray<MenuItem & { help: string }> = [
  { label: 'Items', value: 'items', help: 'Use the items you carry.' },
  { label: 'Magic', value: 'magic', help: 'Cast a field spell.' },
  { label: 'Equip', value: 'equip', help: 'Change weapons and armour.' },
  { label: 'Status', value: 'status', help: 'Look at a member\'s stats, spells and gear.' },
  { label: 'Order', value: 'order', help: 'Change the marching order.' },
  { label: 'Bestiary', value: 'bestiary', help: 'Look up the monsters: stats, weaknesses and moves.' },
  { label: 'Save', value: 'save', help: 'Record your journey.' },
  { label: 'Load', value: 'load', help: 'Resume a saved journey.' },
  // the user's word for it (playtest 2026-11-22): the Pixel Remaster's "Boosts", here named Cheats so it is found
  { label: 'Cheats', value: 'boosts', help: 'Cheats: gold and XP multipliers, encounters, battle and walk speed, escape.' },
  { label: 'Config', value: 'config', help: 'Set the battle message speed.' },
];

/** Play time in seconds as H:MM:SS. */
export function formatPlayTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** The field menu (MS-7): commands, gold, time and location on the left, the party on the right, a help bar below. */
export class FieldMenuScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private menu: Menu;
  private saveIndex: number;
  private partyPanel: PartyPanel;
  private goldText: BitmapText;
  private timeText: BitmapText;
  private locationText: BitmapText;
  private help: HelpWindow;
  private shownIndex = -1;

  constructor(game: Game) {
    this.game = game;
    const items: MenuItem[] = COMMANDS.map(({ label, value }) => ({ label, value }));
    const menuWindow = new Window({ x: LEFT_PANE.x, y: SCREEN_MARGIN, width: LEFT_PANE.width,
      height: items.length * MENU_LINE_HEIGHT + 2 * WINDOW_PADDING });
    this.saveIndex = items.findIndex((i) => i.value === 'save');
    this.menu = new Menu({
      items,
      x: menuWindow.contentX,
      y: menuWindow.contentY,
      onSelect: (item) => this.onSelect(item),
      onCancel: () => this.game.scenes.pop(),
    });
    menuWindow.addChild(this.menu);
    this.container.addChild(menuWindow);

    let y = SCREEN_MARGIN + items.length * MENU_LINE_HEIGHT + 2 * WINDOW_PADDING + INFO_GAP;
    const info = (lines = 1): BitmapText => {
      const height = INFO_HEIGHT + (lines - 1) * LINE_HEIGHT;
      const w = new Window({ x: LEFT_PANE.x, y, width: LEFT_PANE.width, height });
      y += height + INFO_GAP;
      const t = new BitmapText({ text: '', style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill: 0xffffff } });
      t.position.set(w.contentX, w.contentY);
      w.addChild(t);
      this.container.addChild(w);
      return t;
    };
    this.goldText = info();
    this.timeText = info();
    this.locationText = info(2);   // long names ("Retired Knight's House") wrap onto a second line

    this.partyPanel = new PartyPanel({ x: PARTY_PANE.x, y: SCREEN_MARGIN, width: PARTY_PANE.width,
      rowHeight: PARTY_PANE.rowHeight, rows: PARTY_PANE.rows });
    this.container.addChild(this.partyPanel);

    this.help = new HelpWindow();
    this.container.addChild(this.help);
  }

  enter(): void {
    // C7: Evaluate canSave on enter, not constructor
    const exploration = this.game.scenes.get<ExplorationScene>('exploration');
    // redraws the item, so Save is only grey where the map forbids saving
    this.menu.setItemEnabled(this.saveIndex, exploration?.canSave() ?? false);
    const chars = Math.floor((LEFT_PANE.width - 2 * WINDOW_PADDING) / CHAR_WIDTH);
    this.locationText.text = wrapText(exploration?.getMapName() ?? '', chars);
    this.refresh();
  }

  update(_dt: number): void {
    this.menu.update(this.game.input);
    this.timeText.text = formatPlayTime(this.game.playTime);
    this.showHelp();
  }

  onPause(): void {}
  /** Back from Items, Equip, Order...: HP, gear, charges and order may have changed. */
  onResume(): void {
    this.refresh();
  }

  exit(): void {}

  /** The party rows, gold and time as they are now. */
  private refresh(): void {
    this.partyPanel.refresh(this.game.party.all);
    this.partyPanel.setBoostTag(boostSummary(this.game.boosts));   // back from Boosts: the indicator follows
    this.goldText.text = `${this.game.party.gold} G`;
    this.timeText.text = formatPlayTime(this.game.playTime);
    this.shownIndex = -1;
    this.showHelp();
  }

  private showHelp(): void {
    if (this.menu.selectedIndex === this.shownIndex) return;
    this.shownIndex = this.menu.selectedIndex;
    this.help.setText(COMMANDS[this.shownIndex]?.help ?? '');
  }

  private onSelect(item: MenuItem): void {
    switch (item.value) {
      case 'items':
        this.game.scenes.push('itemMenu');
        break;
      case 'equip':
        this.game.scenes.push('equip');
        break;
      case 'status':
        this.game.scenes.push('status');
        break;
      case 'magic':
        this.game.scenes.push('fieldMagic');
        break;
      case 'order':
        this.game.scenes.push('fieldOrder');
        break;
      case 'bestiary':
        this.game.scenes.push('bestiary');
        break;
      case 'boosts':
        this.game.scenes.push('boosts');
        break;
      case 'config':
        this.game.scenes.push('config');
        break;
      case 'save':
        this.game.scenes.push('saveMenu');
        break;
      case 'load':
        this.game.scenes.push('loadMenu');
        break;
    }
  }
}
