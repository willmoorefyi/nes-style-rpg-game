import { BitmapText, type Container } from 'pixi.js';
import type { NextActionInfo } from '../../battle/BattleStateMachine.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import type { Window } from '../../ui/Window.js';
import { formatConciseResult, fitToWidth } from './battleMessageUtils.js';

/** B12: the turn list reads at the normal UI size, one line per 32 px (7 lines fit the 252 px command window: 252 / 32 = 7.9). */
export const TURN_FONT = FONT_SIZE;
export const TURN_PITCH = 32;
const DONE_TINT = 0x888888;

/** One label for both states of an entry: Fight, the spell's name (FIRE), the item's name (Potion), Run. */
export function actionLabel(info: Pick<NextActionInfo, 'actionType' | 'spellName' | 'itemName'>): string {
  switch (info.actionType) {
    case 'fight': return 'Fight';
    case 'magic': return (info.spellName ?? 'Magic').toUpperCase();
    case 'item': return info.itemName ?? 'Item';
    case 'run': return 'Run';
    default: return info.actionType;
  }
}

/**
 * The short result after the label, without the target: `19`, `19*` (a kill), `19!` (a crit), `x3 57` (three hits),
 * `Miss`, `+24`, `Asleep`, `Escaped`, `Sleep`, `Defense up`.
 */
export function compactResult(messages: Array<{ text: string }>, actorName: string): string {
  const texts = messages.map(m => m.text);
  if (texts.includes(`${actorName} is silenced!`)) return 'Silenced';
  if (texts.includes(`${actorName} has no charges!`)) return 'No charges';
  if (texts.some(t => t.endsWith("'s HP is full!"))) return '+0';
  const concise = formatConciseResult(messages, actorName);
  const heal = concise.match(/^→ (\d+) HP to /);
  if (heal) return `+${heal[1]}`;
  const hit = concise.match(/^→ (\d+) to .+?(?: x(\d+))?(!)?( \*)?$/);
  if (hit) return `${hit[2] ? `x${hit[2]} ` : ''}${hit[1]}${hit[3] ?? ''}${hit[4] ? '*' : ''}`;
  const poison = concise.match(/^Poison → (\d+) dmg( \*)?$/);
  if (poison) return `Poison ${poison[1]}${poison[2] ? '*' : ''}`;
  if (!concise.startsWith('→ ')) return concise.replace(' → ', ' ');
  const rest = concise.slice(2).replace(/!$/, '');
  // "→ Sleep Goblin A", "→ Frightened Wolf", "→ Revived FGHTR": the status word, without the target
  const named = texts.some(t => / is affected by | is frightened!$| is revived!?$| was revived$| is cured of /.test(t));
  return named ? rest.split(' ')[0] : rest;
}

/** K4 / B12: the round's actions in the command window, pending (`THIEF Fight`) then done (`THIEF Fight 19`). */
export class TurnList {
  readonly texts: BitmapText[] = [];
  /** The entry of the action being played. */
  index = 0;

  constructor(private readonly container: Container, private readonly window: Window) {}

  /** A turn-list line cut to the command window's content width, so it never runs into the party panel. */
  private fit(text: string): string {
    return fitToWidth(text, this.window.contentWidth, TURN_FONT);
  }

  reset(): void {
    this.container.removeChildren();
    this.container.y = 0;
    this.texts.length = 0;
    this.index = 0;
  }

  /** A pending entry for the announced action. */
  add(info: NextActionInfo): void {
    const entry = new BitmapText({
      text: this.fit(`${info.actorName} ${actionLabel(info)}`),
      style: { fontFamily: NES_FONT, fontSize: TURN_FONT, fill: 0xffffff },
    });
    entry.position.set(this.window.contentX, this.window.contentY + this.texts.length * TURN_PITCH);
    this.container.addChild(entry);
    this.texts.push(entry);
    this.scroll();
  }

  /** The current entry, in place, with its result. */
  complete(info: NextActionInfo, messages: Array<{ text: string }>): void {
    const entry = this.texts[this.index];
    if (!entry) return;
    entry.text = this.fit(`${info.actorName} ${actionLabel(info)} ${compactResult(messages, info.actorName)}`.trimEnd());
    this.scroll();
  }

  /** Grey the current entry and move to the next. */
  advance(): void {
    const entry = this.texts[this.index];
    if (entry) entry.tint = DONE_TINT;
    this.index++;
  }

  /** Scroll so the latest entry is visible within the command window. */
  private scroll(): void {
    const overflow = this.texts.length - Math.floor(this.window.contentHeight / TURN_PITCH);
    if (overflow > 0) this.container.y = -overflow * TURN_PITCH;
  }
}
