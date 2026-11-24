/**
 * V8 F8 (docs/REDESIGN_FIX_PLAN.md, D-O7): does a formation lay out at an integer screen scale >= 2? The layout
 * boxes are built as AiEnemyView builds them (the atlas cell at the sheet's scale, its home extent, the titan class for
 * a scale-3 boss whose art does not fit ENEMY_AREA; a placeholder box when there is no art), then checked by
 * `formationFits`. The debug sandbox refuses a formation that does not fit; AiEnemyView warns once when a battle lays
 * one out anyway.
 */
import type { EnemyData } from '../../types/index.js';
import { monsterSpriteKey, type MonsterFrames } from '../../rendering/BattleArt.js';
import { enemyBoxInput, layoutSizeOfArt } from '../../rendering/monsterAnchors.js';
import { formationFits, type EnemyBox, type EnemyBoxInput, type EnemySizeClass } from './EnemyLayoutAi.js';
import { colossusOf } from './colossus/colossusIndex.js';

export { colossusOf };

/** Placeholder box sizes when no art is loaded yet (screen px, matches the 2x art bands). */
export const PLACEHOLDER: Record<EnemySizeClass, number> = { small: 160, medium: 200, large: 256, huge: 384, boss: 400, titan: 600 };

/** The layout input of one enemy: its frames' cell, scale and home extent, else its placeholder box. */
export function boxInputOf(e: EnemyData, f: MonsterFrames | null | undefined): EnemyBoxInput {
  const size = layoutSizeOfArt(e.size, f);
  return f ? enemyBoxInput(size, f, e.size ?? 'small') : { size, w: PLACEHOLDER[size], h: PLACEHOLDER[size] };
}

/** True when the formation fits (formationFits over the boxes AiEnemyView would lay out). */
export function formationFitsArt(enemies: readonly EnemyData[],
  art: { getMonsterFrames(sprite: string): MonsterFrames | null }): boolean {
  return formationFits(enemies.map((e) => boxInputOf(e, art.getMonsterFrames(monsterSpriteKey(e)))));
}

/** The warning for a refused formation, naming its enemy ids. */
export const formationWarning = (ids: readonly string[]): string =>
  `sandbox: formation does not fit at an integer scale >= 2: ${ids.join(', ')}`;

/** The layout inputs of the atlas enemies only (a colossus record is placed by its ColossusView, never laid out or
 *  checked, docs/CHAOS_FORMS_PLAN.md 4.2), and the map of their boxes back to enemy order (a colossus gets an empty box). */
export function atlasLayout(enemies: readonly EnemyData[], frames: readonly (MonsterFrames | null | undefined)[]):
  { inputs: EnemyBoxInput[]; boxesOf: (boxes: EnemyBox[]) => EnemyBox[] } {
  const atlas = enemies.map((e, i) => (colossusOf(e) ? null : boxInputOf(e, frames[i])));
  const inputs = atlas.filter((b): b is EnemyBoxInput => b !== null);
  return { inputs, boxesOf: (boxes) => {
    let k = 0;
    return atlas.map((b) => (b ? boxes[k++] : { x: 0, feetY: 0, w: 0, h: 0, scaleFactor: 1 }));
  } };
}
