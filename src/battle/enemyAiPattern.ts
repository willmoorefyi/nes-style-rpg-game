import type { SpellData } from '../types/index.js';
import type { EnemyAi } from '../types/enemyRoster.js';
import type { AIBehavior } from './AIBehavior.js';
import { BossAI, type BossAction, type BossPattern } from './BossAI.js';

/**
 * Data-driven enemy actions (docs/ROSTER_PLAN.md 7.2, `ai` in enemies.yaml): a turn is a spell with chance `rate`,
 * split over `actions` by weight, else a Fight. Only spells the battle knows are kept; with none left it is null
 * (the enemy keeps the default Fight).
 */
export function dataAiPattern(ai: EnemyAi, spells: readonly Pick<SpellData, 'id'>[]): BossPattern | null {
  const known = new Set(spells.map((s) => s.id));
  const magic = ai.actions.filter((a) => known.has(a.spellId));
  const total = magic.reduce((sum, a) => sum + a.weight, 0);
  if (magic.length === 0 || total <= 0 || ai.rate <= 0) return null;
  const actions: BossAction[] = [
    ...(ai.rate < 1 ? [{ type: 'fight' as const, weight: 1 - ai.rate }] : []),
    ...magic.map((a) => ({ type: 'magic' as const, spellId: a.spellId, weight: (ai.rate * a.weight) / total })),
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
