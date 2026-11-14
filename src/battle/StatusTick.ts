import type { StatusTracker } from './StatusEffects.js';

/** Wake roll after a lost turn: wakes if rand(0..80) < current HP (FF1-style, ≈). */
const WAKE_ROLL_RANGE = 81;

/** One combatant, party member or enemy, as the start-of-turn status tick sees it. */
export interface TickSubject {
  name: string;
  maxHp: number;
  tracker: StatusTracker;
  getHp(): number;
  setHp(hp: number): void;
  /** Message suffix when poison kills ("defeated!" for enemies, "fell!" for the party). */
  fallText: string;
}

/** True when a helpless (asleep / paralysed) actor shakes it off: rand(0..80) < current HP. */
export function rollWake(currentHp: number, rng: () => number): boolean {
  return Math.floor(rng() * WAKE_ROLL_RANGE) < currentHp;
}

/**
 * Start-of-turn status tick. Returns whether the actor may act. Poison hurts first; a sleeping or
 * paralysed actor loses the turn and then may wake (damage never wakes, as in FF1); fear skips half the time.
 */
export function tickStatus(s: TickSubject, rng: () => number, say: (text: string) => void): boolean {
  if (s.getHp() <= 0) return false;
  const result = s.tracker.tick(s.maxHp);
  if (result.damage > 0) {
    s.setHp(Math.max(0, s.getHp() - result.damage));
    say(`${s.name} takes ${result.damage} poison damage!`);
    if (s.getHp() <= 0) {
      say(`${s.name} ${s.fallText}`);
      return false;
    }
  }
  if (result.skipTurn) {
    const helpless = s.tracker.isHelpless();
    say(`${s.name} is ${s.tracker.has('sleep') ? 'asleep' : 'stunned'}!`);
    if (helpless && rollWake(s.getHp(), rng)) {
      s.tracker.remove('sleep');
      s.tracker.remove('stun');
      say(`${s.name} wakes up!`);
    }
    return false;
  }
  if (s.tracker.has('fear') && rng() < 0.5) {
    say(`${s.name} is trembling with fear!`);
    return false;
  }
  return true;
}
