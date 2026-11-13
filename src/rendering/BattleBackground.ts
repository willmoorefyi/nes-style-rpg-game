/**
 * Staged battle backgrounds (docs/ART_BATTLE_PLAN.md): screen-ready 1920x1080 images remapped once from the
 * hand-made sources by assets-src/tools/stage_backgrounds.py, so every actor's feet land on the battle plain.
 */
const STAGED_DIR = 'assets/backgrounds-ai';

/** `assets/backgrounds/<id>.png` (as built by maps and debug scenarios) -> the staged image for that id.
 *  `-hd` variants share the base id. Returns null for paths outside assets/backgrounds/. */
export function stagedBackgroundPath(legacyPath: string): string | null {
  const m = /(?:^|\/)assets\/backgrounds\/([a-z0-9_-]+)\.(?:png|jpe?g|webp)$/i.exec(legacyPath);
  if (!m) return null;
  return `${STAGED_DIR}/${m[1].replace(/-hd$/i, '')}.webp`;
}
