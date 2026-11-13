/**
 * Battle stage backgrounds (docs/ART_BATTLE_PLAN.md): screen-ready 1920x1080 images remapped once from the hand-made
 * sources by assets-src/tools/stage_backgrounds.py, so every actor's feet land on the battle plain.
 */
export function battleBackgroundPath(id: string): string {
  return `assets/backgrounds/${id}.webp`;
}
