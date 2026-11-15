import { BitmapText, type Container } from 'pixi.js';
import type { NextActionInfo } from '../../battle/BattleStateMachine.js';
import { NES_FONT } from '../../ui/NESFont.js';
import { FONT_SIZE } from '../../core/LayoutConstants.js';
import type { Window } from '../../ui/Window.js';
import { formatConciseResult, fitToWidth, glyphWidth } from './battleMessageUtils.js';

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
    case 'skip': return ''; // no command (asleep, stunned): the entry reads `WAR Asleep`
    default: return info.actionType;
  }
}

/** U15: a kill reads `KO` after the number, joined with no space (`19KO`, `x3 57!KO`; was `*`). */
export const KO_MARK = 'KO';

/**
 * The short result after the target: `19`, `19KO` (a kill), `19!` (a crit), `x3 57` (three hits), `Miss`, `+24`,
 * `Asleep`, `Escaped`, `Sleep`, `Defense up`.
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
  if (hit) return `${hit[2] ? `x${hit[2]} ` : ''}${hit[1]}${hit[3] ?? ''}${hit[4] ? KO_MARK : ''}`;
  const poison = concise.match(/^Poison → (\d+) dmg( \*)?$/);
  if (poison) return `Poison ${poison[1]}${poison[2] ? KO_MARK : ''}`;
  if (!concise.startsWith('→ ')) return concise.replace(' → ', ' ');
  const rest = concise.slice(2).replace(/!$/, '');
  // "→ Sleep Goblin A", "→ Frightened Wolf", "→ Revived FGHTR": the status word, without the target
  const named = texts.some(t => / is affected by | is frightened!$| is revived!?$| was revived$| is cured of /.test(t));
  return named ? rest.split(' ')[0] : rest;
}

/** Fewest characters a shortened target keeps before the `…` (2 once the label has dropped too). */
const MIN_TARGET = 3;

/** `text` cut to `n` characters plus `…` when longer. */
const cut = (text: string, n: number): string => (text.length > n ? `${text.slice(0, Math.max(0, n))}…` : text);

/**
 * U15: one turn-list entry, `ACTOR LABEL>TARGET RESULT` (each part optional except the actor), fitted to `widthPx`
 * at the turn-list font: the target is shortened first (to 3 characters and `…`), then the label (and then the target
 * to 2), so the actor and the result always show. `fitToWidth` stays the final guard.
 */
export function fitEntry(actor: string, label: string, target: string, result: string, widthPx: number): string {
  const max = Math.floor(widthPx / glyphWidth(TURN_FONT));
  const join = (a: string, l: string, t: string) => `${a}${l ? ` ${l}` : ''}${t ? `>${t}` : ''}${result ? ` ${result}` : ''}`;
  /** Characters a part may keep, before its `…`, in the line built without it (its separator counted). */
  const room = (without: string) => max - without.length - 2;
  const full = join(actor, label, target);
  if (full.length <= max) return full;
  // 1. the target, down to 3 characters
  if (target && room(join(actor, label, '')) >= MIN_TARGET) return join(actor, label, cut(target, room(join(actor, label, ''))));
  // 2. then the label, beside a 3-character target
  const t3 = target ? cut(target, MIN_TARGET) : '';
  if (label && room(join(actor, '', t3)) >= MIN_TARGET) return join(actor, cut(label, room(join(actor, '', t3))), t3);
  // 3. the label dropped: the target keeps what fits, down to 2 characters
  const bare = join(actor, '', '');
  if (!target && bare.length <= max) return bare;
  if (target && room(bare) >= 2) return join(actor, '', cut(target, room(bare)));
  // 4. the actor gives way last (a long enemy name), so the result is never cut
  const t2 = target ? cut(target, 2) : '';
  const tail = join('', '', t2);
  return fitToWidth(`${cut(actor, Math.max(1, max - tail.length - 1))}${tail}`, widthPx, TURN_FONT);
}

/** U15: the entry's target: `All` for an all-enemy action, none for the actor itself (self, party-wide) or no target. */
export function entryTarget(info: Pick<NextActionInfo, 'actorId' | 'targetId' | 'targetName' | 'allTargets'>): string {
  if (info.allTargets) return 'All';
  if (!info.targetId || info.targetId === info.actorId) return '';
  return info.targetName ?? '';
}

/** U15: the label in an entry: none for Fight (the `>` says it), else as `actionLabel`. */
const entryLabel = (info: NextActionInfo): string => (info.actionType === 'fight' ? '' : actionLabel(info));

/** K4 / B12 / U15: the round's actions in the command window, pending (`THIEF>Gr.Imp B`) then done (`THIEF>Gr.Imp B 19`). */
export class TurnList {
  readonly texts: BitmapText[] = [];
  /** The entry of the action being played. */
  index = 0;

  constructor(private readonly container: Container, private readonly window: Window) {}

  /** A turn-list line fitted to the command window's content width, so it never runs into the party panel. */
  private fit(info: NextActionInfo, result = ''): string {
    return fitEntry(info.actorName, entryLabel(info), entryTarget(info), result, this.window.contentWidth);
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
      text: this.fit(info),
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
    entry.text = this.fit(info, compactResult(messages, info.actorName));
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
