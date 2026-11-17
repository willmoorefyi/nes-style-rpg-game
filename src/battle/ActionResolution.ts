import type { BossPhase, SpellData } from '../types/index.js';
import type { BattleCommand } from './BattleCommands.js';
import type { BossPattern } from './BossAI.js';
import type { EnemyInstance, QueuedAction } from './BattleStateMachine.js';
import { retargetIfDead } from './BattleCommands.js';
import { retargetEnemyTarget } from './EnemyAI.js';
import { gatedFloor } from './bossForms.js';

/**
 * Pieces of the round that `BattleStateMachine` delegates (revision 6): target resolution (B2), item reservation
 * (B5) and boss-phase overrides (B1). Pure logic on the battle's own objects; no rendering.
 */

/** One battle line. `interlude` (CHAOS_FORMS_PLAN 18.8 row 2c, B5): the view plays that battle-interludes.yaml script in
 *  place of the line (the script shows the text as its message step); a view without the script shows the text. */
export interface BattleMessage {
  text: string;
  interlude?: string;
}

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
  if ((cmd.type === 'fight' || cmd.type === 'slam') && action.isEnemy) {
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

/**
 * B1: a crossed phase's `hits` / `attack` overrides, kept as battle-only buffs (the shared data never changes). The
 * deltas are also tracked in `phaseBuffs`, so a form change takes them off again while spell buffs stay (R6).
 */
export function applyPhaseOverrides(enemy: EnemyInstance, phase: BossPhase): void {
  const add = (stat: string, next: number): void => {
    const before = enemy.buffs.get(stat) ?? 0;
    enemy.buffs.set(stat, next);
    (enemy.phaseBuffs ??= new Map()).set(stat, (enemy.phaseBuffs.get(stat) ?? 0) + next - before);
  };
  if (phase.hits !== undefined) add('hits', phase.hits - (enemy.data.stats.hits ?? 1));
  if (phase.attack !== undefined) add('attack', (enemy.buffs.get('attack') ?? 0) + phase.attack - enemy.data.stats.attack);
}

/**
 * ST-6 / B1: an enemy that has crossed a boss-phase HP threshold. Each phase fires once: its overrides apply, its
 * message is said, and the pattern swaps for an AI with `setPattern` when `bossPatterns` knows the id. An enemy with
 * no AI (Garland) keeps the default targeting, so no RNG draw is added. A phase that names an interlude (B5) says one
 * line `{text: message, interlude}` in place of its plain line; the interlude shows the message.
 */
export function checkBossPhases(enemy: EnemyInstance, bossPatterns: Map<string, BossPattern>, say: (line: BattleMessage) => void): void {
  const phases = enemy.data.bossPhases;
  if (!phases) return;
  const hpPercent = enemy.currentHp / enemy.data.stats.hp;
  for (let i = 0; i < phases.length; i++) {
    // a form phase is never a plain phase: bossForms changes the form at its floor (CHAOS_FORMS_PLAN 2.2, R5); a gated
    // phase (an interlude) is reached at its floor `ceil(t * pool)` (CHAOS_FIX_PLAN 2.4 M2), any other at `hp / pool <= t`
    const reached = phases[i].interlude ? enemy.currentHp <= gatedFloor(enemy, phases[i]) : hpPercent <= phases[i].hpThreshold;
    if (phases[i].form || enemy.crossedPhases?.has(i) || !reached) continue;
    enemy.crossedPhases?.add(i);
    applyPhaseOverrides(enemy, phases[i]);
    const ai = enemy.aiBehavior;
    // a pattern AI (BossAI) swaps its pattern; a data-driven `ai` (no setPattern) keeps its actions
    if (ai && 'setPattern' in ai) {
      const newPattern = bossPatterns.get(phases[i].patternId);
      if (!newPattern) {
        // crossedPhases makes this fire once per phase
        console.warn(`${enemy.data.id}: boss phase pattern "${phases[i].patternId}" is not in bossPatterns`);
      } else {
        (ai as { setPattern(p: BossPattern): void }).setPattern(newPattern);
      }
    }
    const { message, interlude } = phases[i];
    if (interlude) say({ text: message ?? '', interlude });
    else if (message) say({ text: message });
  }
}
