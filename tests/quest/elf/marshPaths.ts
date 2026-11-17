/**
 * Path helpers of ELF-D's Marsh Cave tests (hazardPath, elf_d_marsh): the peat cells of a map's `hazards`, and
 * walking distances on the compiled collision with NPC cells blocking (a blocked target cell, like the bier, gets a
 * distance when it is next to a reached cell).
 */
import type { MapData } from '../../../src/types/index.js';
import { baseTerrain, terrainAllows } from '../../../src/systems/fieldRules.js';

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]] as const;
export const key = (x: number, y: number): string => `${x},${y}`;

export function peatCells(m: MapData): Set<string> {
  const out = new Set<string>();
  for (const h of m.hazards ?? []) for (const [x0, y0, x1, y1] of h.rects) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.add(key(x, y));
  }
  return out;
}

export function distances(m: MapData, from: [number, number], avoid = new Set<string>()): Map<string, number> {
  const npcs = new Set(m.npcs.map((n) => key(n.x, n.y)));
  const dist = new Map([[key(...from), 0]]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS) {
      const [nx, ny] = [x + dx, y + dy];
      const k = key(nx, ny);
      if (dist.has(k) || nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      if (avoid.has(k)) continue;
      dist.set(k, dist.get(key(x, y))! + 1);
      if (!terrainAllows('walking', baseTerrain(m, nx, ny)) || npcs.has(k)) continue;
      q.push([nx, ny]);
    }
  }
  return dist;
}
