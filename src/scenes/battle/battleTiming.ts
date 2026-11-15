/**
 * Every battle UI hold, in 60 fps frames (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 1, §3.6). Only text holds scale
 * with the message speed; animations (lunges, casts, effects, fades) never do. F0 keeps today's values and a
 * multiplier of 1 at every speed; pass F's Fb owns the values and the multipliers.
 */
import { getSettings, type MessageSpeed } from '../../core/Settings.js';

/** Each action's announcement. */
export const ANNOUNCE_FRAMES = 30;
/** Each result line of an action. */
export const RESULT_FRAMES = 25;
/** The last result line of a round, before the next command menu (or the end screen). */
export const ROUND_END_FRAMES = 20;
/** A one-off UI notice ("No spells available.") before the menu returns. */
export const NOTICE_FRAMES = 30;
/** Round-start, boss-phase and victory lines (the scene's message list). */
export const BATTLE_MESSAGE_FRAMES = 45;
/** The "X appeared!" intro. */
export const INTRO_FRAMES = 60;
/** The beat after an action completes, in which nothing moves (new; 0 = none). */
export const ACTION_BEAT_FRAMES = 0;

/** Text-hold multiplier per message speed (1 slowest .. 5 fastest). */
export const SPEED_MULTIPLIER: Readonly<Record<MessageSpeed, number>> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };

/** A text hold at `speed` (default: the player's setting), in whole frames. */
export function holdFrames(base: number, speed: MessageSpeed = getSettings().messageSpeed): number {
  return Math.round(base * SPEED_MULTIPLIER[speed]);
}
