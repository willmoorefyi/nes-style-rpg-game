import type { EnemyInstance } from './BattleStateMachine.js';
import { formFloor } from './bossForms.js';

/**
 * The single enemy HP write of a battle (docs/CHAOS_FORMS_PLAN.md 2.2 item 2): spell damage, physical damage, the
 * status tick, a heal and a revive all go through here, so a boss with an uncrossed form phase never drops below that
 * phase's floor `ceil(threshold * pool)` and a lethal or overkill hit can never skip a form (or the gated crack).
 * Callers keep their own clamps (0, max HP); a plain enemy has no floor, so this is the plain assignment.
 */
export function setEnemyHp(enemy: EnemyInstance, hp: number): void {
  const floor = formFloor(enemy);
  // M5 (CHAOS_FIX_PLAN 2.4, C7-N1): damage from above a floor stops at it, but a write never lifts HP up to a floor
  enemy.currentHp = floor === null ? hp : Math.max(hp, Math.min(floor, enemy.currentHp));
}

/**
 * Debug scenarios (`enemyHp`, CHAOS_FIX_PLAN C6-12b): enemy `index` starts at `ceil(fraction * pool)`. A start value,
 * not damage, so it is written directly (a gated floor above it does not hold it). An unknown index is logged.
 */
export function applyStartHp(enemies: readonly EnemyInstance[], fractions: Readonly<Record<number, number>> = {}): void {
  for (const [index, f] of Object.entries(fractions)) {
    const enemy = enemies[Number(index)];
    if (enemy) enemy.currentHp = Math.ceil(f * enemy.data.stats.hp);
    else console.error(`Battle: enemyHp for enemy ${index}, but there are ${enemies.length}`);
  }
}
