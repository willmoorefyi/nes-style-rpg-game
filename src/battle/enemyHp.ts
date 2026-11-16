import type { EnemyInstance } from './BattleStateMachine.js';
import { formFloor } from './bossForms.js';

/**
 * The single enemy HP write of a battle (docs/CHAOS_FORMS_PLAN.md 2.2 item 2): spell damage, physical damage, the
 * status tick, a heal and a revive all go through here, so a boss with an uncrossed form phase never drops below that
 * phase's floor `ceil(threshold * pool)` and a lethal or overkill hit can never skip a form. Callers keep their own
 * clamps (0, max HP); a plain enemy has no floor, so this is the plain assignment.
 */
export function setEnemyHp(enemy: EnemyInstance, hp: number): void {
  const floor = formFloor(enemy);
  enemy.currentHp = floor === null ? hp : Math.max(floor, hp);
}
