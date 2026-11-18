/**
 * Path helper of FIR-D2's Ice Cavern tests: walking distances on a compiled floor under a set of flags (the patches
 * whose flag is set count), with NPC cells blocking (a blocked target cell, like the stone on its plinth, gets a
 * distance when it is next to a reached cell). Transition cells are reached but not walked through when `stopAt`
 * holds them (a B2 pit drops you; it is never a way across).
 */
import type { MapData } from '../../../src/types/index.js';
import { patchedTerrain, terrainAllows } from '../../../src/systems/fieldRules.js';

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]] as const;
export const key = (x: number, y: number): string => `${x},${y}`;

export function distances(m: MapData, from: [number, number], flags: ReadonlySet<string> = new Set(),
  stopAt: ReadonlySet<string> = new Set(), npcs = true): Map<string, number> {
  const blocked = new Set(npcs ? m.npcs.filter((n) => !n.hideIf || !flags.has(n.hideIf)).map((n) => key(n.x, n.y)) : []);
  const dist = new Map([[key(...from), 0]]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS) {
      const [nx, ny] = [x + dx, y + dy];
      const k = key(nx, ny);
      if (dist.has(k) || nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      dist.set(k, dist.get(key(x, y))! + 1);
      if (!terrainAllows('walking', patchedTerrain(m, nx, ny, flags)) || blocked.has(k) || stopAt.has(k)) continue;
      q.push([nx, ny]);
    }
  }
  return dist;
}

/** The cells of the transitions from `m` to `to` (optionally to one entrance). */
export function cellsTo(m: MapData, to: string, entrance?: string): string[] {
  return m.transitions.filter((t) => t.targetMap === to && (!entrance || t.targetEntrance === entrance))
    .map((t) => key(t.x, t.y));
}
