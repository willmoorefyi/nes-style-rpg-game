import type { SpellData } from '../types/index.js';
import type { EnemyAi, EnemyAiMagicAction } from '../types/enemyRoster.js';
import type { AIBehavior } from './AIBehavior.js';
import { BossAI, type BossAction, type BossPattern } from './BossAI.js';

/**
 * Data-driven enemy actions (docs/ROSTER_PLAN.md 7.2, `ai` in enemies.yaml): a turn is a spell with chance `rate`,
 * split over the magic `actions` by weight, else a Fight. A `slam` action (CHAOS_FORMS_PLAN 2.2 item 9) takes its
 * `weight` share of the non-spell turns `1 - rate`, the rest staying Fight. Only spells the battle knows are kept; with
 * none left and no slam it is null (the enemy keeps the default Fight).
 */
export function dataAiPattern(ai: EnemyAi, spells: readonly Pick<SpellData, 'id'>[]): BossPattern | null {
  const known = new Set(spells.map((s) => s.id));
  const magic = ai.actions.filter((a): a is EnemyAiMagicAction => a.type === 'magic' && known.has(a.spellId));
  const slam = Math.min(1, ai.actions.find((a) => a.type === 'slam')?.weight ?? 0);
  const total = magic.reduce((sum, a) => sum + a.weight, 0);
  const casts = magic.length > 0 && total > 0 && ai.rate > 0;
  if (!casts && slam <= 0) return null;
  const rate = casts ? ai.rate : 0;
  const physical = 1 - rate;
  const actions: BossAction[] = [
    ...(physical * (1 - slam) > 0 ? [{ type: 'fight' as const, weight: physical * (1 - slam) }] : []),
    ...(physical * slam > 0 ? [{ type: 'slam' as const, weight: physical * slam }] : []),
    ...(casts ? magic.map((a) => ({ type: 'magic' as const, spellId: a.spellId, weight: (rate * a.weight) / total })) : []),
  ];
  return { actions };
}

/**
 * The behaviour for an enemy's `ai`, targeting by each spell's `targeting` (BossAI). It has no `setPattern`, so a
 * boss phase keeps it (the phase's own overrides and message still apply) instead of looking up a debug pattern.
 */
export function dataDrivenAI(ai: EnemyAi, spells: readonly SpellData[]): AIBehavior | null {
  const pattern = dataAiPattern(ai, spells);
  if (!pattern) return null;
  const boss = new BossAI(pattern, spells);
  return { selectAction: (self, party, allies, turn, rng) => boss.selectAction(self, party, allies, turn, rng) };
}
