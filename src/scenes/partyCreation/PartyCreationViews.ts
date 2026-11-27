import { Container, BitmapText, Sprite, type Texture } from 'pixi.js';
import type { CharacterClassData } from '../../types/index.js';
import { Window } from '../../ui/Window.js';
import { classLabel } from '../../data/classLabel.js';
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
  barbarian: 'BARB',
  legionnaire: 'LEGN',
};

function label(text: string, x: number, y: number, fill = 0xffffff): BitmapText {
  const t = new BitmapText({ text, style: { fontFamily: NES_FONT, fontSize: FONT_SIZE, fill } });
  t.position.set(x, y);
  return t;
}

/**
 * One slot of the strip: `1:ROLF WAR` once named, `3:B.M WHM` while being named (the name typed so far, `----`
 * while it is empty), `4:----` before a class (N1).
 */
export function slotText(i: number, names: readonly string[], classes: readonly CharacterClassData[], typed = ''): string {
  const cls = classes[i] ? ` ${classLabel(classes[i])}` : '';
  if (i < names.length) return `${i + 1}:${names[i]}${cls}`;
  return cls ? `${i + 1}:${typed || '----'}${cls}` : `${i + 1}:----`;
}

/** The four slots along the top: chosen names and classes, the current slot in yellow. */
export class SlotStrip extends Container {
  private readonly labels: BitmapText[] = [];

  constructor(
    private readonly names: readonly string[],
    private readonly classes: readonly CharacterClassData[],
    private readonly currentSlot: number,
  ) {
    super();
    this.position.set(SCREEN_MARGIN, 72);
    for (let i = 0; i < 4; i++) {
      const t = label(slotText(i, names, classes), i * 440, 0, i === currentSlot ? 0xffff00 : 0xffffff);
      this.labels.push(t);
      this.addChild(t);
    }
  }

  /** Show the name being typed in the current slot. */
  setTyped(typed: string): void {
    const t = this.labels[this.currentSlot];
    if (!t) return;
    const text = slotText(this.currentSlot, this.names, this.classes, typed);
    if (t.text !== text) t.text = text;
  }
}

export function buildSlotDisplay(names: readonly string[], classes: readonly CharacterClassData[], currentSlot: number): SlotStrip {
  return new SlotStrip(names, classes, currentSlot);
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
