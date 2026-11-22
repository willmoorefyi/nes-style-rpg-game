/**
 * WR (docs/WORLD_WRAP_PLAN.md 8.2, D-WR-8): the wrap invariant of proof (h). The wrap must join no component on foot,
 * on foot plus canoe, or by ship: with the map's patches (the north bridge, the canal) all shut and all open, the
 * 4-connected labelling with the seam neighbours equals the labelling without them. Then every reachable place is
 * the same on the torus as on the flat chart, and only routes get shorter.
 */
import { patchedTerrain, terrainAllows } from '../systems/fieldRules.js';
import { stepIndex } from '../systems/worldWrap.js';
import { TerrainType, type MapData } from '../types/index.js';
import type { ProofFailure } from './questTypes.js';
import { fail } from './questProofs.js';

type Layer = 'walk' | 'walk+canoe' | 'ship';
const LAYERS: readonly Layer[] = ['walk', 'walk+canoe', 'ship'];
const DIRS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, -1], [-1, 0], [1, 0]];

function passable(layer: Layer, t: TerrainType): boolean {
  if (layer === 'ship') return t === TerrainType.Water;
  if (terrainAllows('walking', t)) return true;
  return layer === 'walk+canoe' && (t === TerrainType.River || t === TerrainType.Lake);
}

/** Component labels (-1: not passable) of `open`, with or without the seam neighbours. */
export function labelCells(map: MapData, open: Uint8Array, wrap: boolean): Int32Array {
  const view = { width: map.width, height: map.height, wrap };
  const w = map.width;
  const label = new Int32Array(open.length).fill(-1);
  let next = 0;
  const queue = new Int32Array(open.length);
  for (let s = 0; s < open.length; s++) {
    if (!open[s] || label[s] >= 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    label[s] = next;
    while (head < tail) {
      const c = queue[head++];
      const x = c % w;
      const y = (c - x) / w;
      for (const [dx, dy] of DIRS) {
        const n = stepIndex(view, x, y, dx, dy);
        if (n < 0 || !open[n] || label[n] >= 0) continue;
        label[n] = next;
        queue[tail++] = n;
      }
    }
    next++;
  }
  return label;
}

/** The first seam step that joins two flat components, per layer and patch state, as proof (h) failures. */
export function wrapInvariant(map: MapData): ProofFailure[] {
  const out: ProofFailure[] = [];
  const w = map.width;
  const h = map.height;
  const all = new Set((map.patches ?? []).map((p) => p.flag));
  for (const [state, flags] of [['shut', new Set<string>()], ['open', all]] as const) {
    for (const layer of LAYERS) {
      const open = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) open[y * w + x] = passable(layer, patchedTerrain(map, x, y, flags)) ? 1 : 0;
      }
      const flat = labelCells(map, open, false);
      const torus = labelCells(map, open, true);
      const seen = new Map<number, number>();
      for (let i = 0; i < open.length; i++) {
        if (flat[i] < 0) continue;
        const t = seen.get(torus[i]);
        if (t === undefined) { seen.set(torus[i], flat[i]); continue; }
        if (t === flat[i]) continue;
        const at = `(${i % w}, ${Math.floor(i / w)})`;
        out.push(fail('h', 'WRAP', `WRAP joins ${layer} components ${t} and ${flat[i]} at ${at} (patches ${state})`));
        break;
      }
    }
  }
  return out;
}

/** The WRAP failures of the quest's world map (on a flat map too: the wrap would join nothing). */
export function wrapFailures(map: MapData | undefined): ProofFailure[] {
  return map ? wrapInvariant(map) : [];
}

/** WR report (plan 8.3): the late seas of `layouts/world_api.SEA_CLASS` (mirrored here for the report only). */
export const LATE_SEAS: ReadonlySet<string> = new Set(['ord_sea', 'wat_sea', 'wnd_sea']);

/** A stage's witness across the seam: its seam crossings and the late-sea cells it sails. */
export interface SeamNote { crossings: number; late: number }

/** Count one witness step `c` (after `prev`) on a wrapped map into `acc[stage]`. */
export function noteSeam(acc: Map<string, SeamNote>, stage: string, map: MapData,
  prev: { map: string; x: number; y: number } | null, c: { map: string; x: number; y: number; mode: string }): void {
  if (!map.wrap) return;
  const n = acc.get(stage) ?? { crossings: 0, late: 0 };
  if (prev && prev.map === c.map && (Math.abs(prev.x - c.x) > 1 || Math.abs(prev.y - c.y) > 1)) n.crossings++;
  if (c.mode === 'ship') {
    const z = map.encounterZones?.find((e) => (e.modes ?? []).includes('ship')
      && e.rects.some(([x0, y0, x1, y1]) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1));
    if (z && LATE_SEAS.has(z.id)) n.late++;
  }
  if (n.crossings || n.late) acc.set(stage, n);
}

/** The report text: each stage whose witness crosses a seam, with its late-sea cells. */
export function seamReport(acc: ReadonlyMap<string, SeamNote>): string {
  const rows = [...acc].filter(([, n]) => n.crossings > 0).map(([s, n]) => `${s} x${n.crossings} late ${n.late}`);
  return rows.length ? `seam: ${rows.join(', ')}` : 'seam: no crossing';
}
