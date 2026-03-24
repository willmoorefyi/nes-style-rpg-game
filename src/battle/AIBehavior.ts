import type { EnemyInstance } from './BattleStateMachine.js';
import type { Character } from '../entities/Character.js';
import type { BattleCommand } from './BattleCommands.js';

/**
 * AIBehavior interface for enemy AI strategies.
 * Used by both basic enemies (random targeting) and bosses (pattern-based).
 */
export interface AIBehavior {
  selectAction(
    self: EnemyInstance,
    party: Character[],
    allies: EnemyInstance[],
    turnNumber: number,
    rng: () => number
  ): BattleCommand;
}
