/**
 * One actor's turn around its status tick (re-test A): the start-of-turn tick (sleep, stun, stone, fear) decides
 * whether the actor acts, the action runs, and poison hurts at the END of the turn (FF-style), so an action's numbers
 * are real (a poisoned White Mage's HEAL heals what it says) and the poison line follows them. Pure (no PixiJS).
 */
import { endTurn, startTurn, statusList, type PresentHold, type TickSubject } from './StatusTick.js';

export interface TurnHooks {
  /** Add a battle line; returns the message object (a hold points at it). */
  say(text: string): { text: string };
  /** Run the chosen command (not called when the turn is lost). */
  act(): void;
  /** The battle is decided (an escape, or one side is down): no end-of-turn poison then. */
  decided(): boolean;
}

/**
 * Run the turn; returns the view's holds: a waking sleeper shows its old statuses until "X wakes up!", and the poison
 * damage (and a poison KO) shows only with its own line.
 */
export function runTurn(s: TickSubject, actorId: string, rng: () => number, hooks: TurnHooks): PresentHold[] {
  const holds: PresentHold[] = [];
  const snap = () => ({ actorId, hp: s.getHp(), statuses: statusList(s.tracker) });
  const before = snap();
  const wake: { text: string }[] = [];
  const start = startTurn(s, rng, (text) => {
    const line = hooks.say(text);
    if (text === `${s.name} wakes up!`) wake.push(line);
  });
  if (wake[0]) holds.push({ line: wake[0], ...before });
  if (start.canAct) hooks.act();
  if (hooks.decided()) return holds;
  const mid = snap();
  const poison: { text: string }[] = [];
  endTurn(s, start, (text) => { poison.push(hooks.say(text)); });
  if (poison[0]) holds.push({ line: poison[0], ...mid });
  return holds;
}
