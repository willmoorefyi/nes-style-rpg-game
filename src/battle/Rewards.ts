/** Each living member's XP share of a victory (FF1 splits the total evenly, rounding down). */
export function xpShare(total: number, livingMembers: number): number {
  return livingMembers > 0 ? Math.floor(total / livingMembers) : 0;
}
