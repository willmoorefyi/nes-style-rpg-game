import type { StatusEffect, StatusTracker } from './StatusEffects.js';

/** Wake roll after a lost turn: wakes if rand(0..80) < current HP (FF1-style, ≈). */
const WAKE_ROLL_RANGE = 81;

/** One combatant, party member or enemy, as the status tick sees it. */
export interface TickSubject {
  name: string;
  maxHp: number;
  tracker: StatusTracker;
  getHp(): number;
  setHp(hp: number): void;
  /** Message suffix when poison kills ("defeated!" for enemies, "fell!" for the party). */
  fallText: string;
}

/**
 * A change the view presents only once its line shows (re-test A, D): until `line` is on screen the actor `actorId`
 * still shows `hp` and `statuses` (a sleeper keeps SLP until "X wakes up!"; poison damage lands with its own line).
 */
export interface PresentHold {
  line: { text: string };
  actorId: string;
  hp: number;
  statuses: StatusEffect[];
}

/** What the start of a turn decided: whether the actor acts, and the poison damage owed at the end of the turn. */
export interface TurnStart {
  canAct: boolean;
  poison: number;
  /** Poison wore off with this turn's tick (it still hurts once: the tick computed the damage before the expiry). */
  poisonExpired: boolean;
}

/** True when a helpless (asleep / paralysed) actor shakes it off: rand(0..80) < current HP. */
export function rollWake(currentHp: number, rng: () => number): boolean {
  return Math.floor(rng() * WAKE_ROLL_RANGE) < currentHp;
}

/**
 * E1 lookahead, no RNG and no state change: true when the next `startTurn` is certain to end the turn: sleep / stun /
 * stone (skipTurn is decided before a status expires, so one turn left still skips). Fear is a roll at tick time and
 * is not a certain loss. Re-test A: poison hurts at the END of the turn, so even lethal poison never costs the turn
 * (the actor acts, then falls to the poison) and is not counted here.
 */
export function losesTurn(s: Pick<TickSubject, 'tracker' | 'getHp'>): boolean {
  if (s.getHp() <= 0) return false;
  const t = s.tracker;
  return t.has('sleep') || t.has('stun') || t.has('stone');
}

/**
 * Start-of-turn tick (durations count down here). A sleeping or paralysed actor loses the turn and then may wake
 * (damage never wakes, as in FF1); fear skips half the time. Poison is owed, not applied: `endTurn` applies it.
 */
export function startTurn(s: TickSubject, rng: () => number, say: (text: string) => void): TurnStart {
  if (s.getHp() <= 0) return { canAct: false, poison: 0, poisonExpired: false };
  const result = s.tracker.tick(s.maxHp);
  const owed = { poison: result.damage, poisonExpired: result.expired.includes('poison') };
  if (result.skipTurn) {
    const helpless = s.tracker.isHelpless();
    say(`${s.name} is ${s.tracker.has('sleep') ? 'asleep' : 'stunned'}!`);
    if (helpless && rollWake(s.getHp(), rng)) {
      s.tracker.remove('sleep');
      s.tracker.remove('stun');
      say(`${s.name} wakes up!`);
    }
    return { canAct: false, ...owed };
  }
  if (s.tracker.has('fear') && rng() < 0.5) {
    say(`${s.name} is trembling with fear!`);
    return { canAct: false, ...owed };
  }
  return { canAct: true, ...owed };
}

/**
 * End-of-turn poison, after the action (or the lost turn), FF-style: the damage `startTurn` computed, unless the actor
 * fell or was cured meanwhile (an Antidote on themselves). Returns false when the actor is down.
 */
export function endTurn(s: TickSubject, start: TurnStart, say: (text: string) => void): boolean {
  if (s.getHp() <= 0) return false;
  if (start.poison <= 0 || !(s.tracker.has('poison') || start.poisonExpired)) return true;
  s.setHp(Math.max(0, s.getHp() - start.poison));
  say(`${s.name} takes ${start.poison} poison damage!`);
  if (s.getHp() > 0) return true;
  say(`${s.name} ${s.fallText}`);
  return false;
}

/** The statuses on a tracker now (a hold's snapshot). */
export const statusList = (t: StatusTracker): StatusEffect[] => t.getAll().map((e) => e.effect);
