/**
 * Every battle UI hold, in 60 fps frames (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 1, §3.6). The values are the holds
 * at message speed 3 (the default); other speeds multiply the text holds by `SPEED_MULTIPLIER`. Animations (lunges,
 * casts, effects, fades) never scale: the speed changes reading time, not motion. Confirm skips any text hold.
 */
import { getSettings, type MessageSpeed } from '../../core/Settings.js';

/** Each action's announcement (was 30). */
export const ANNOUNCE_FRAMES = 45;
/** Each result line of an action (was 25). */
export const RESULT_FRAMES = 60;
/** The last result line of a round, before the next command menu (or the end screen) (was 20). */
export const ROUND_END_FRAMES = 40;
/** A one-off UI notice ("No spells available.") before the menu returns (was 30). */
export const NOTICE_FRAMES = 60;
/** Round-start, boss-phase and victory lines (the scene's message list) (was 45). */
export const BATTLE_MESSAGE_FRAMES = 90;
/** The "X appeared!" intro (was 60). */
export const INTRO_FRAMES = 75;
/** The beat after an action completes and before the next announcement: nothing moves, the HP change registers. */
export const ACTION_BEAT_FRAMES = 15;
/** After confirm skips a hold, the next hold ignores confirm this long (unscaled), so a double press skips one line. */
export const SKIP_GUARD_FRAMES = 8;

/** Text-hold multiplier per message speed (1 slowest .. 5 fastest). */
export const SPEED_MULTIPLIER: Readonly<Record<MessageSpeed, number>> = { 1: 1.6, 2: 1.3, 3: 1.0, 4: 0.75, 5: 0.55 };

/** A text hold at `speed` (default: the player's setting), in whole frames. */
export function holdFrames(base: number, speed: MessageSpeed = getSettings().messageSpeed): number {
  // the epsilon keeps x.5 products (90 x 0.55 = 49.5) rounding up despite binary floating point
  return Math.round(base * SPEED_MULTIPLIER[speed] + 1e-9);
}

/** Confirm skips the current text hold, but a press within SKIP_GUARD_FRAMES of the last skip is ignored, so two quick
 *  presses never skip two lines. Call `take` once per frame of a skippable phase. */
export class ConfirmSkip {
  private since = SKIP_GUARD_FRAMES;
  take(pressed: boolean, dt: number): boolean {
    const skip = pressed && this.since >= SKIP_GUARD_FRAMES;
    this.since = skip ? 0 : this.since + dt;
    return skip;
  }
}
