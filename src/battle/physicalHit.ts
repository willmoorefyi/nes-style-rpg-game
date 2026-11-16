import type { Character } from '../entities/Character.js';
import type { BattleCommand } from './BattleCommands.js';
import type { DamageEvent, EnemyInstance } from './BattleStateMachine.js';
import { attackLine, resolveEnemyAttack, resolvePartyAttack } from './PhysicalAttack.js';

/**
 * The physical hits of a battle (docs/CHAOS_FORMS_PLAN.md 2.2 item 8, A3): a party member's Fight and an enemy's
 * Fight, extracted from `BattleStateMachine` unchanged. Pure logic on the battle's own objects; no rendering.
 */
export interface PhysicalHitDeps {
  rng: () => number;
  enemies: readonly EnemyInstance[];
  partyMember: (id: string) => Character | undefined;
  say: (text: string) => void;
  damage: (event: DamageEvent) => void;
  /** A physical attack missed during the current action. */
  missed: () => void;
}

/** A queued Fight; the target was resolved before the action (resolveActionTarget). */
export function executeFight(deps: PhysicalHitDeps, cmd: BattleCommand, isEnemy: boolean): void {
  if (cmd.type !== 'fight' || !cmd.targetId) return;
  if (isEnemy) executeEnemyAttack(deps, cmd.actorId, cmd.targetId);
  else executePartyAttack(deps, cmd.actorId, cmd.targetId);
}

export function executePartyAttack(deps: PhysicalHitDeps, actorId: string, targetId: string): void {
  const actor = deps.partyMember(actorId);
  const target = deps.enemies.find(e => e.id === targetId);
  if (!actor || !target || actor.currentHp <= 0 || target.currentHp <= 0) return;

  const result = resolvePartyAttack(actor, target, deps.rng);
  if (!result.hit) {
    deps.missed();
    deps.say(`${actor.name} missed!`);
    return;
  }
  target.currentHp = Math.max(0, target.currentHp - result.damage);
  deps.say(attackLine(actor.name, target.displayName, result));
  deps.damage({ targetId, damage: result.damage, isHeal: false, isCrit: result.critical });
  if (target.currentHp <= 0) deps.say(`${target.displayName} defeated!`);
}

export function executeEnemyAttack(deps: PhysicalHitDeps, enemyId: string, targetId: string): void {
  const enemy = deps.enemies.find(e => e.id === enemyId);
  const target = deps.partyMember(targetId);
  if (!enemy || !target || enemy.currentHp <= 0 || target.currentHp <= 0) return;

  const result = resolveEnemyAttack(enemy, target, deps.rng);
  if (!result.hit) {
    deps.missed();
    deps.say(`${enemy.displayName} missed!`);
    return;
  }
  target.currentHp = target.currentHp - result.damage;
  deps.say(attackLine(enemy.displayName, target.name, result));
  deps.damage({ targetId, damage: result.damage, isHeal: false, isCrit: result.critical });
  if (target.currentHp <= 0) deps.say(`${target.name} fell!`);
}
