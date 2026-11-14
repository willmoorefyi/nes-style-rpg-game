/**
 * Battle stage backgrounds (docs/ART_BATTLE_PLAN.md): screen-ready 1920x1080 images remapped once from the hand-made
 * sources by assets-src/tools/stage_backgrounds.py, so every actor's feet land on the battle plain.
 */
export function battleBackgroundPath(id: string): string {
  return `assets/backgrounds/${id}.webp`;
}

/**
 * Staged backgrounds only cover the screen from y 120 down: above that (the battle message window's band) the stager
 * may fill with a flat colour (stage_backgrounds.py FIELD_TOP). Shown without that window, as in the opening, the
 * image must start at its row 120.
 */
export const STAGE_COVERED_TOP = 120;

/** Placement of a staged background shown with no message window: row STAGE_COVERED_TOP at the screen's top, covering it. */
export function backdropCover(texW: number, texH: number, screenW: number, screenH: number): { x: number; y: number; scale: number } {
  const visibleH = texH - STAGE_COVERED_TOP;
  const scale = Math.max(screenW / texW, screenH / visibleH);
  return { x: Math.round((screenW - texW * scale) / 2), y: Math.round(-STAGE_COVERED_TOP * scale), scale };
}
