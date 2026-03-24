import type { AIBehavior } from './AIBehavior.js';
import type { EnemyInstance } from './BattleStateMachine.js';
import type { Character } from '../entities/Character.js';
import type { BattleCommand } from './BattleCommands.js';
import { selectTarget } from './EnemyAI.js';

/**
 * Basic AI: random targeting of living party members.
 * Wraps existing EnemyAI.selectTarget logic into the AIBehavior interface.
 */
export class BasicAI implements AIBehavior {
  selectAction(
    self: EnemyInstance,
    party: Character[],
    _allies: EnemyInstance[],
    _turnNumber: number,
    rng: () => number
  ): BattleCommand {
    const targets = party.map(c => ({ id: c.name, isAlive: c.currentHp > 0 }));
    const target = selectTarget(targets, rng);
    return { type: 'fight', actorId: self.id, targetId: target?.id };
  }
}
