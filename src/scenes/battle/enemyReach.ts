/**
 * How far a melee enemy travels to the hero it attacks (docs/FEEDBACK_PLAN_2026-11-14.md item 3). Pure, screen px.
 * The party's reach (attackChoreography.attackReach) mirrored: the enemy's opaque right edge ends ENEMY_REACH_OVERLAP
 * inside the target's box (the hero's figure sits inset in its cell), on the contact frame, so the 0.75 L lunge of the
 * contact frame is taken off the travel. The rise brings its feet line to the target's (U3 mirrored), but never lifts
 * the travel frames' highest row above TRAVEL_CLEAR_Y (docs/ROSTER_FIX_PLAN.md defect 1: a tall boss attacking the top
 * hero rose under the message window); the boss then strikes a little lower.
 */
import type { EnemySizeClass } from './EnemyLayoutAi.js';
import { BATTLE_MESSAGE_HEIGHT } from './BattleSceneTypes.js';

export const ENEMY_REACH_OVERLAP = 24;
/** The plan said 1000; the first column of a nine-enemy half-size formation needs about 1080 to reach the last hero
 *  (anim_crowd), so the bound is the whole stage instead. */
export const MAX_ENEMY_TRAVEL = 1500;
export const MAX_ENEMY_RISE = 400;
/** The lunge share of the contact frame (enemyAttackTables: the first `attack` frame). */
export const CONTACT_LUNGE = 0.75;
/** Travel hop per size class, px at scale factor 1 (a titan attacks in place, docs/REDESIGN_PLAN.md 4.2). */
export const TRAVEL_HOP: Record<EnemySizeClass, number> = { small: 10, medium: 10, large: 6, huge: 4, boss: 3, titan: 0 };
/** The highest a travelling enemy's art may reach: 4 px under the message window. */
export const TRAVEL_CLEAR_Y = BATTLE_MESSAGE_HEIGHT + 4;

export interface ReachInput {
  /** The enemy's opaque right edge and feet line at home (screen px). */
  opaqueRight: number;
  feetY: number;
  /** Its full lunge L in screen px (lungePx x the layout factor). */
  lunge: number;
  /** The target's box: left edge and feet line (screen px). */
  targetLeft: number;
  targetFeetY: number;
  /** Screen y of the travel frames' highest opaque row at home (absent: no clearance limit). */
  topY?: number;
}

const clamp = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);

/** The travel (toward the party, >= 0) and the rise (down > 0) that put the contact frame on the target. */
export function enemyReach(r: ReachInput): { travel: number; rise: number } {
  const travel = clamp(r.targetLeft + ENEMY_REACH_OVERLAP - r.opaqueRight - CONTACT_LUNGE * r.lunge, 0, MAX_ENEMY_TRAVEL);
  if (travel <= 0) return { travel, rise: 0 };
  const rise = clamp(r.targetFeetY - r.feetY, -MAX_ENEMY_RISE, MAX_ENEMY_RISE);
  // the clearance bound in whole px (int-ef2: at 2.7 a travel top lands on x.9; Math.round(-94.1) would leave 0.1 px
  // above the line; at scale 2, 3 and 2.5 the result is unchanged, as Math.round(-94.5) is -94 too)
  return { travel, rise: r.topY === undefined ? rise : Math.min(MAX_ENEMY_RISE, Math.max(rise, Math.ceil(TRAVEL_CLEAR_Y - r.topY))) };
}
