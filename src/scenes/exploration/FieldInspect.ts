import { resolveNPCDialog, type MapData } from '../../types/index.js';

/**
 * The lines shown when the player faces map cell (x, y) and presses confirm (a tomb, a sign...), or null when the
 * map declares no inspect cell there (or its conditional text resolves to nothing). Conditional text follows the
 * NPC dialog rules: the first entry whose `condition` flag is set, else the first entry without a condition.
 */
export function inspectAt(
  map: Pick<MapData, 'inspect'>,
  x: number,
  y: number,
  hasFlag: (flag: string) => boolean,
): string[] | null {
  const cell = map.inspect?.find((c) => c.x === x && c.y === y);
  if (!cell) return null;
  const lines = resolveNPCDialog(cell.text, hasFlag);
  return lines.length > 0 ? lines : null;
}
