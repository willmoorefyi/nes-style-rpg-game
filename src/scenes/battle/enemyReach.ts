/**
 * How far a melee enemy travels to the hero it attacks (docs/FEEDBACK_PLAN_2026-11-14.md item 3). Pure, screen px.
 * The party's reach (attackChoreography.attackReach) mirrored: the enemy's opaque right edge ends ENEMY_REACH_OVERLAP
 * inside the target's box (the hero's figure sits inset in its cell), on the contact frame, so the 0.75 L lunge of the
 * contact frame is taken off the travel. The rise brings its feet line to the target's (U3 mirrored).
 */
import type { EnemySizeClass } from './EnemyLayoutAi.js';

export const ENEMY_REACH_OVERLAP = 24;
/** The plan said 1000; the first column of a nine-enemy half-size formation needs about 1080 to reach the last hero
 *  (anim_crowd), so the bound is the whole stage instead. */
export const MAX_ENEMY_TRAVEL = 1500;
export const MAX_ENEMY_RISE = 400;
/** The lunge share of the contact frame (enemyAttackTables: the first `attack` frame). */
export const CONTACT_LUNGE = 0.75;
/** Travel hop per size class, px at scale factor 1. */
export const TRAVEL_HOP: Record<EnemySizeClass, number> = { small: 10, large: 6, boss: 3 };

export interface ReachInput {
  /** The enemy's opaque right edge and feet line at home (screen px). */
  opaqueRight: number;
  feetY: number;
  /** Its full lunge L in screen px (lungePx x the layout factor). */
  lunge: number;
  /** The target's box: left edge and feet line (screen px). */
  targetLeft: number;
  targetFeetY: number;
}

const clamp = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);

/** The travel (toward the party, >= 0) and the rise (down > 0) that put the contact frame on the target. */
export function enemyReach(r: ReachInput): { travel: number; rise: number } {
  const travel = clamp(r.targetLeft + ENEMY_REACH_OVERLAP - r.opaqueRight - CONTACT_LUNGE * r.lunge, 0, MAX_ENEMY_TRAVEL);
  return { travel, rise: travel > 0 ? clamp(r.targetFeetY - r.feetY, -MAX_ENEMY_RISE, MAX_ENEMY_RISE) : 0 };
}
