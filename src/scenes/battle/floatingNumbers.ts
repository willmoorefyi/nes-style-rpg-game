import type { Container } from 'pixi.js';
import type { DamageEvent } from '../../battle/BattleStateMachine.js';
import { OutlinedText } from '../../ui/NESFont.js';
import { getSettings, type MessageSpeed } from '../../core/Settings.js';
import { SPEED_MULTIPLIER } from './battleTiming.js';
import { FLOAT_COLORS, FLOAT_FONT, FLOAT_OUTLINE } from './BattleSceneTypes.js';

export type FloatKind = keyof typeof FLOAT_COLORS;

/** Frames a floating number stays up at message speed 3 (it rises 1 px per frame and fades out; was 48). */
export const FLOAT_FRAMES = 72;
/** The shortest life (speed 5: today's 48); slower speeds never make it longer than `FLOAT_FRAMES`. */
export const MIN_FLOAT_FRAMES = 48;

/** A floating number's life at `speed`: 72 at speeds 1-3, 54 at 4, 48 at 5. */
export function floatFrames(speed: MessageSpeed = getSettings().messageSpeed): number {
  return Math.max(MIN_FLOAT_FRAMES, Math.min(FLOAT_FRAMES, Math.round(FLOAT_FRAMES * SPEED_MULTIPLIER[speed])));
}

export function floatKind(evt: DamageEvent): FloatKind {
  if (evt.isHeal) return 'heal';
  if (evt.damage <= 0) return 'miss';
  return evt.isCrit ? 'crit' : 'hit';
}

export function floatLabel(evt: DamageEvent): string {
  return evt.isHeal ? `+${evt.damage}` : `${evt.damage}`;
}

/** V8 F6: px between an enemy's status icon row and a number below it, and the least rise the number keeps there. */
export const ICON_CLEAR = 4;
export const RISE_MIN = 24;

/** Where a number spawns (`y`) and the highest it rises to (`minY`): at the cell top, rising freely, unless the
 *  target shows a status icon row (its bottom at `iconRowBottom`); then it starts RISE_MIN below the row's clearance
 *  (never above the cell top) and stops ICON_CLEAR px under the row, so its top never enters the row (D-O5). */
export function floatPlacement(top: number, iconRowBottom: number | null): { y: number; minY: number | null } {
  if (iconRowBottom === null) return { y: Math.round(top), minY: null };
  const minY = Math.round(iconRowBottom + ICON_CLEAR);
  return { y: Math.max(Math.round(top), minY + RISE_MIN), minY };
}

/** BA-8: a 48 px number with a dark outline, centred over the top of `sprite` (below its icon row, F6). */
export function createFloatingNumber(label: string, kind: FloatKind, sprite: Container, y = Math.round(sprite.y)): OutlinedText {
  const text = new OutlinedText({ text: label, fontSize: FLOAT_FONT, fill: FLOAT_COLORS[kind], outline: FLOAT_OUTLINE, outlineWidth: 3 });
  // the NES font is monospace at about 0.6 em per glyph
  const approxWidth = label.length * FLOAT_FONT * 0.6;
  text.position.set(Math.round(sprite.x + sprite.width / 2 - approxWidth / 2), y);
  return text;
}
