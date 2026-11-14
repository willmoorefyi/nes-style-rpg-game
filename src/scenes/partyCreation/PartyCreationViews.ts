import { Container, BitmapText } from 'pixi.js';
import type { CharacterClassData } from '../../types/index.js';
import { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { GAME_WIDTH, FONT_SIZE, SCREEN_MARGIN, LINE_HEIGHT } from '../../core/LayoutConstants.js';

/** Default name per base class; NameEntryGrid's uniqueDefaultName adds 2, 3... for repeats. */
export const DEFAULT_NAMES: Record<string, string> = {
  warrior: 'FGHTR',
  thief: 'THIEF',
  monk: 'MONK',
  white_mage: 'W.MAG',
  black_mage: 'B.MAG',
  red_mage: 'R.MAG',
};

function label(text: string, x: number, y: number, fill = 0xffffff): BitmapText {
  const t = new BitmapText({ text, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill } });
  t.position.set(x, y);
  return t;
}

/** The four slots along the top: chosen names, the current slot in yellow. */
export function buildSlotDisplay(names: readonly string[], currentSlot: number): Container {
  const display = new Container();
  display.position.set(SCREEN_MARGIN, 72);
  for (let i = 0; i < 4; i++) {
    const text = i < names.length ? `${i + 1}:${names[i]}` : `${i + 1}:----`;
    display.addChild(label(text, i * 240, 0, i === currentSlot ? 0xffff00 : 0xffffff));
  }
  return display;
}

/** The party summary on the confirm screen: name, class and HP per member. */
export function buildPartySummary(classes: readonly CharacterClassData[], names: readonly string[]): Window {
  const win = new Window({ x: SCREEN_MARGIN, y: 120, width: GAME_WIDTH - 2 * SCREEN_MARGIN, height: 500 });
  classes.forEach((cls, i) => {
    win.addChild(label(`${names[i]}  ${cls.name}  HP:${cls.baseStats.hp}`, win.contentX, win.contentY + i * 48));
  });
  return win;
}

/** The class preview panel beside the class menu. */
export function buildClassPreview(cls: CharacterClassData): Window {
  const win = new Window({ x: 0, y: 0, width: 600, height: 800 });
  const lines = [
    cls.name,
    '',
    `HP:${cls.baseStats.hp}  STR:${cls.baseStats.strength}`,
    `AGI:${cls.baseStats.agility} INT:${cls.baseStats.intelligence}`,
    `VIT:${cls.baseStats.vitality} LCK:${cls.baseStats.luck}`,
    '',
    `Magic: W${cls.spellLevels.white}/B${cls.spellLevels.black}`,
  ];
  lines.forEach((line, i) => win.addChild(label(line, win.contentX, win.contentY + i * LINE_HEIGHT)));
  return win;
}
