import type { BossPhase, SpellData } from '../types/index.js';
import type { BattleCommand } from './BattleCommands.js';
import type { BossPattern } from './BossAI.js';
import type { EnemyInstance, QueuedAction } from './BattleStateMachine.js';
import { retargetIfDead } from './BattleCommands.js';
import { retargetEnemyTarget } from './EnemyAI.js';

/**
 * Pieces of the round that `BattleStateMachine` delegates (revision 6): target resolution (B2), item reservation
 * (B5) and boss-phase overrides (B1). Pure logic on the battle's own objects; no rendering.
 */

export interface TargetContext {
  /** Party battle ids in party order (party_0 …), for the enemies' front-weighted retarget. */
  partyIds: readonly string[];
  livingEnemyIds: () => string[];
  isAlive: (id: string) => boolean;
  spells: readonly SpellData[];
  rng: () => number;
}

/**
 * B2: a queued Fight (either side) or a party single-target spell at an enemy whose target has died gets a living
 * target, written back into the queued command. The peek and the execution both call this, so the announcement,
 * the animation and the hit name the same target; the second call is a no-op (the target is alive by then). The RNG
 * is drawn only when a retarget happens.
 */
export function resolveActionTarget(action: QueuedAction, ctx: TargetContext): void {
  const cmd = action.command;
  if (!cmd.targetId || ctx.isAlive(cmd.targetId)) return;
  if (cmd.type === 'fight' && action.isEnemy) {
    // enemies retarget by the original party slots, so the front stays favoured
    const id = retargetEnemyTarget(ctx.partyIds, ctx.isAlive, ctx.rng);
    if (id) action.command = { ...cmd, targetId: id };
    return;
  }
  if (action.isEnemy) return;
  const singleSpell = cmd.type === 'magic' && cmd.targetId.startsWith('enemy_')
    && ctx.spells.find((s) => s.id === cmd.spellId)?.targeting === 'single';
  if (cmd.type === 'fight' || singleSpell) {
    action.command = retargetIfDead(cmd, ctx.isAlive, ctx.livingEnemyIds, ctx.rng);
  }
}

/** B5: how many of `itemId` the commands queued this round already use. */
export function reservedItems(commands: readonly BattleCommand[], itemId: string): number {
  return commands.filter((c) => c.type === 'item' && c.itemId === itemId).length;
}

/** B1: a crossed phase's `hits` / `attack` overrides, kept as battle-only buffs (the shared data never changes). */
export function applyPhaseOverrides(enemy: EnemyInstance, phase: BossPhase): void {
  if (phase.hits !== undefined) enemy.buffs.set('hits', phase.hits - (enemy.data.stats.hits ?? 1));
  if (phase.attack !== undefined) {
    enemy.buffs.set('attack', (enemy.buffs.get('attack') ?? 0) + phase.attack - enemy.data.stats.attack);
  }
}

/**
 * ST-6 / B1: an enemy that has crossed a boss-phase HP threshold. Each phase fires once: its overrides apply, its
 * message is said, and the pattern swaps for an AI with `setPattern` when `bossPatterns` knows the id. An enemy with
 * no AI (Garland) keeps the default targeting, so no RNG draw is added.
 */
export function checkBossPhases(enemy: EnemyInstance, bossPatterns: Map<string, BossPattern>, say: (text: string) => void): void {
  const phases = enemy.data.bossPhases;
  if (!phases) return;
  const hpPercent = enemy.currentHp / enemy.data.stats.hp;
  for (let i = 0; i < phases.length; i++) {
    if (enemy.crossedPhases?.has(i) || hpPercent > phases[i].hpThreshold) continue;
    enemy.crossedPhases?.add(i);
    applyPhaseOverrides(enemy, phases[i]);
    const ai = enemy.aiBehavior;
    if (ai) {
      const newPattern = bossPatterns.get(phases[i].patternId);
      if (!newPattern) {
        // crossedPhases makes this fire once per phase
        console.warn(`${enemy.data.id}: boss phase pattern "${phases[i].patternId}" is not in bossPatterns`);
      } else if ('setPattern' in ai) {
        (ai as { setPattern(p: BossPattern): void }).setPattern(newPattern);
      }
    }
    if (phases[i].message) say(phases[i].message!);
  }
}
