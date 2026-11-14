/**
 * FF1 (NES) experience table: total XP needed to reach each level (fix plan T4 §2.2, EB-3).
 * Values past Lv30 may be off by one; FF1 adds about 32,800 per level there.
 */
export const MAX_LEVEL = 50;

/** `XP_TO_REACH[level]` = total XP to reach `level` (index 0 is unused, Lv1 needs 0). */
const XP_TO_REACH: readonly number[] = [
  0, 0,
  40, 196, 547, 1171, 2146, 3550, 5461, 7957, 11116,                       // Lv2-10
  15016, 19735, 25351, 31942, 39586, 48361, 58345, 69617, 82253, 96332,    // Lv11-20
  111932, 129131, 148008, 168639, 191103, 215479, 241843, 270275, 300851, 333651, // Lv21-30
  366450, 399250, 432049, 464849, 497648, 530448, 563247, 596047, 628846, 661646, // Lv31-40
  694445, 727245, 760044, 792844, 825643, 858443, 891242, 924042, 956841, 989641, // Lv41-50
];

/** Total XP needed to reach `level` (Infinity past the cap). */
export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return Infinity;
  return XP_TO_REACH[level];
}

/** The highest level `xp` reaches. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level++;
  return level;
}
