import type { Character } from '../entities/Character.js';
import type { PhysicalHitDeps } from './physicalHit.js';
import { attackLine, resolveEnemyAttack } from './PhysicalAttack.js';

/** The slam's default target count (the validator allows only 2). */
const SLAM_TARGETS = 2;

/**
 * F3's slam (docs/CHAOS_FORMS_PLAN.md 2.2 item 9, R9): one physical attack on up to `slam.targets` (2) different
 * living heroes, the queued (resolved) target first and then a living hero drawn uniformly from the others. Each target
 * is rolled with the normal physical formula, and each hit makes its own damage event, in target order. The action
 * counts as missed only when every target was missed.
 */
export function executeSlam(deps: PhysicalHitDeps, enemyId: string, targetId: string): void {
  const enemy = deps.enemies.find(e => e.id === enemyId);
  const first = deps.partyMember(targetId);
  if (!enemy || !first || enemy.currentHp <= 0 || first.currentHp <= 0) return;
  const targets: Array<[string, Character]> = [[targetId, first]];
  const count = enemy.data.slam?.targets ?? SLAM_TARGETS;
  while (targets.length < count) {
    const others = deps.partyIds.flatMap((id): Array<[string, Character]> => {
      const hero = deps.partyMember(id);
      return hero && hero.currentHp > 0 && !targets.some(([t]) => t === id) ? [[id, hero]] : [];
    });
    if (others.length === 0) break;
    targets.push(others[Math.floor(deps.rng() * others.length)]);
  }
  let landed = 0;
  for (const [id, hero] of targets) {
    const result = resolveEnemyAttack(enemy, hero, deps.rng);
    if (!result.hit) {
      deps.say(`${enemy.displayName} missed ${hero.name}!`);
      continue;
    }
    landed++;
    hero.currentHp = hero.currentHp - result.damage;
    deps.say(attackLine(enemy.displayName, hero.name, result));
    deps.damage({ targetId: id, damage: result.damage, isHeal: false, isCrit: result.critical });
    if (hero.currentHp <= 0) deps.say(`${hero.name} fell!`);
  }
  if (landed === 0) deps.missed();
}
