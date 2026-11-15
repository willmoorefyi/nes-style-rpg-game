/**
 * Re-test C: a feared party member's skip was announced as a real action ("BLM uses Potion!", then "BLM is trembling
 * with fear!" and nothing happened). Fear's 50 % skip stays rolled at execute time (decision O1, so the RNG order is
 * unchanged), but for a feared party member the view runs the action at announce time: a skip then shows only the
 * fear line (and the turn list reads `BLM Afraid`), and an action that goes ahead is announced and played as usual.
 * A feared enemy still announces and lunges first (O1).
 */
import type { ActionResult, NextActionInfo } from '../../battle/BattleStateMachine.js';

/** What `isAfraid` reads: the party's status trackers by battle order (test doubles may leave them out). */
interface PartySource { readonly allParty?: readonly { statusTracker?: { has(effect: 'fear'): boolean } }[] }

/** The next actor is a party member with fear (their turn may be skipped by the execute-time roll). */
export function isAfraid(info: Pick<NextActionInfo, 'actorId'>, battle: PartySource): boolean {
  const [side, index] = info.actorId.split('_');
  return side === 'party' && (battle.allParty?.[Number(index)]?.statusTracker?.has('fear') ?? false);
}

/** The executed turn was lost to fear (its result is the fear line). */
export function afraidSkip(result: Pick<ActionResult, 'messages'>, info: Pick<NextActionInfo, 'actorName'>): boolean {
  return result.messages.some((m) => m.text === `${info.actorName} is trembling with fear!`);
}
