/**
 * Hazard floors (docs/QUEST_PLAN.md 4.2; W1-B): each walking step onto a `MapData.hazards` cell (lava, peat;
 * fieldRules.fieldStep reports its `hazard` damage) takes `damage` HP from every living member, never below 1 HP.
 * Pure logic; the field adds the red flash (src/scenes/exploration/FieldHazard.ts).
 */
import type { Character } from '../entities/Character.js';
import { isFallen } from './FieldSpellEffects.js';

/** Apply one hazard step to the party; returns how many members lost HP (0: nobody was hurt). */
export function applyHazard(party: readonly Character[], damage: number): number {
  if (!(damage > 0)) return 0;
  let hurt = 0;
  for (const c of party) {
    if (isFallen(c) || c.currentHp <= 1) continue;
    c.currentHp = Math.max(1, c.currentHp - Math.floor(damage));
    hurt++;
  }
  return hurt;
}
