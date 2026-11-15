import type { Container } from 'pixi.js';
import type { GameEvents } from '../../core/EventBus.js';
import type { ActionResult, NextActionInfo } from '../../battle/BattleStateMachine.js';
import { attackReach, attackRise, MIN_ATTACK_REACH, type AttackReach } from './attackChoreography.js';

/** Pure helpers of BattleAnimationController (split out to keep it under its line ceiling). */

export type ActionSound = 'battleHit' | 'battleMiss' | 'spellCast';

/** BA-9 / B11: reach to the target sprite's right edge (its 2x cell, whose art sits 16-34 px inside); the minimum when
 *  there is no target. U3: and from the attacker's feet row (its box's bottom) to the target's. */
export function measureReach(actor: Container, target: Container | null): AttackReach {
  if (!target) return { dx: MIN_ATTACK_REACH, dy: 0 };
  const b = target.getBounds();
  const a = actor.getBounds();
  return { dx: attackReach(actor.x, b.x + b.width), dy: attackRise(a.y + a.height, b.y + b.height) };
}

/** I3: a damaging Fight sounds a hit, a miss a miss, and a spell that really went off its cast (not when picked). */
export function emitActionSounds(info: NextActionInfo, result: ActionResult,
  emit: (event: ActionSound, data: GameEvents['battleHit']) => void): void {
  if (result.missed) emit('battleMiss', {});
  else if (info.actionType === 'fight' && result.damageEvents.some(e => !e.isHeal && e.damage > 0)) emit('battleHit', {});
  if (info.actionType === 'magic' && result.messages.some(m => m.text.startsWith(`${info.actorName} casts `))) emit('spellCast', {});
}
