/**
 * V8 F8 (docs/REDESIGN_FIX_PLAN.md, D-O7): does a formation lay out at an integer screen scale >= 2? The layout
 * boxes are built as AiEnemyView builds them (the atlas cell at the sheet's scale, its home extent, the titan class for
 * a scale-3 boss; a placeholder box when there is no art), then checked by `formationFits`. The debug sandbox refuses
 * a formation that does not fit; AiEnemyView warns once when a battle lays one out anyway.
 */
import type { EnemyData } from '../../types/index.js';
import { monsterSpriteKey, type MonsterFrames } from '../../rendering/BattleArt.js';
import { enemyBoxInput } from '../../rendering/monsterAnchors.js';
import { formationFits, layoutSizeOf, type EnemyBoxInput, type EnemySizeClass } from './EnemyLayoutAi.js';

/** Placeholder box sizes when no art is loaded yet (screen px, matches the 2x art bands). */
export const PLACEHOLDER: Record<EnemySizeClass, number> = { small: 160, large: 256, huge: 384, boss: 400, titan: 600 };

/** The layout input of one enemy: its frames' cell, scale and home extent, else its placeholder box. */
export function boxInputOf(e: EnemyData, f: MonsterFrames | null | undefined): EnemyBoxInput {
  const size = layoutSizeOf(e.size, f?.scale);
  return f ? enemyBoxInput(size, f) : { size, w: PLACEHOLDER[size], h: PLACEHOLDER[size] };
}

/** True when the formation fits (formationFits over the boxes AiEnemyView would lay out). */
export function formationFitsArt(enemies: readonly EnemyData[],
  art: { getMonsterFrames(sprite: string): MonsterFrames | null }): boolean {
  return formationFits(enemies.map((e) => boxInputOf(e, art.getMonsterFrames(monsterSpriteKey(e)))));
}

/** The warning for a refused formation, naming its enemy ids. */
export const formationWarning = (ids: readonly string[]): string =>
  `sandbox: formation does not fit at an integer scale >= 2: ${ids.join(', ')}`;
