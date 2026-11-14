import { Container, BitmapText, Sprite, type Texture } from 'pixi.js';
import type { CharacterClassData } from '../../types/index.js';
import { Window } from '../../ui/Window.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { classInitials } from '../shop/spellLearners.js';
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

/** One slot of the strip: `1:ROLF Wa` once named, `3:? WM` while being named, `4:----` before a class (N1). */
export function slotText(i: number, names: readonly string[], classes: readonly CharacterClassData[]): string {
  const cls = classes[i] ? ` ${classInitials(classes[i].name)}` : '';
  if (i < names.length) return `${i + 1}:${names[i]}${cls}`;
  return cls ? `${i + 1}:?${cls}` : `${i + 1}:----`;
}

/** The four slots along the top: chosen names and classes, the current slot in yellow. */
export function buildSlotDisplay(names: readonly string[], classes: readonly CharacterClassData[], currentSlot: number): Container {
  const display = new Container();
  display.position.set(SCREEN_MARGIN, 72);
  for (let i = 0; i < 4; i++) {
    display.addChild(label(slotText(i, names, classes), i * 440, 0, i === currentSlot ? 0xffff00 : 0xffffff));
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

/** The class preview panel beside the class menu, with the class's battle `ready` pose when the art is loaded. */
export function buildClassPreview(cls: CharacterClassData, pose: Texture | null = null): Window {
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
  if (pose) {
    const sprite = new Sprite(pose);
    sprite.label = 'classPose';
    sprite.position.set(win.contentX, win.contentY + (lines.length + 1) * LINE_HEIGHT);
    win.addChild(sprite);
  }
  return win;
}
