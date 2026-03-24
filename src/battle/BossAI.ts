import type { AIBehavior } from './AIBehavior.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import type { Character } from '../entities/Character.js';
import type { BattleCommand, CommandType } from './BattleCommands.js';
import { selectTarget } from './EnemyAI.js';

/** A single action in a boss pattern with optional condition gating */
export interface BossAction {
  type: CommandType;
  spellId?: string;
  weight: number;
  condition?: (self: EnemyInstance, turnNumber: number) => boolean;
}

/** A set of weighted actions the boss can choose from */
export interface BossPattern {
  actions: BossAction[];
}

/**
 * Boss AI: weighted random selection from pattern actions whose conditions pass.
 * Falls back to basic fight if no actions are available.
 */
export class BossAI implements AIBehavior {
  private pattern: BossPattern;

  constructor(pattern: BossPattern) {
    this.pattern = pattern;
  }

  /** Replace the current pattern (used for multi-phase transitions) */
  setPattern(pattern: BossPattern): void {
    this.pattern = pattern;
  }

  selectAction(
    self: EnemyInstance,
    party: Character[],
    _allies: EnemyInstance[],
    turnNumber: number,
    rng: () => number
  ): BattleCommand {
    // Filter to actions whose conditions pass
    const available = this.pattern.actions.filter(
      a => !a.condition || a.condition(self, turnNumber)
    );

    const chosen = available.length > 0
      ? weightedRandom(available, rng)
      : null;

    // Pick a living party member as target
    const targets = party.map(c => ({ id: c.name, isAlive: c.currentHp > 0 }));
    const target = selectTarget(targets, rng);

    if (!chosen || chosen.type === 'fight') {
      return { type: 'fight', actorId: self.id, targetId: target?.id };
    }

    return {
      type: chosen.type,
      actorId: self.id,
      targetId: target?.id,
      spellId: chosen.spellId,
    };
  }
}

/** Weighted random selection from an array of items with .weight */
function weightedRandom<T extends { weight: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  // Fallback (shouldn't happen with valid weights)
  return items[items.length - 1];
}
