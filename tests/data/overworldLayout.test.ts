import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { TerrainType } from '../../src/types/index.js';
import type { MapData } from '../../src/types/index.js';
import { backdropTerrain, battleBackdropId } from '../../src/scenes/exploration/BattleBackdrop.js';

/**
 * The generated act-1 overworld (assets-src/tools/layouts/overworld.py, compiled by build_map.py): T3c. Since pass W
 * it is region A1 of the 192x192 world (layouts/world.py), translated by `world.frames.a1.origin` (D-W11): every
 * hard-coded act-1 cell below is offset by the origin, and the whole-map scans are clipped to the act-1 frame
 * (QUEST 4.3), so other regions' roads, rivers and sand never count here.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const map = parse(readFileSync(join(root, 'assets/maps/ai/overworld.yaml'), 'utf-8')) as MapData;
const raw = parse(readFileSync(join(root, 'assets-src/maps/overworld.yaml'), 'utf-8')) as {
  ground: string; objects: Array<{ type: string; x: number; y: number; parts?: Array<Array<string | null>> }>;
  world?: MapData['world'];
};
const rawRows = raw.ground.trimEnd().split('\n');
/** The act-1 frame: the compiled map's (GAP-17); a compiled map as wide as the source shares the source's; a map
 * without one is act 1 alone at (0, 0). */
const srcFrame = raw.world?.frames?.a1 ?? { origin: [0, 0], size: [rawRows[0].length, rawRows.length] };
const frame = map.world?.frames?.a1 ?? (map.width === rawRows[0].length ? srcFrame
  : { origin: [0, 0] as [number, number], size: [map.width, map.height] as [number, number] });
const [OX, OY] = frame.origin;
/** The source, read in the compiled map's cells (they differ while the compiled map is an older act-1 build). */
const [DX, DY] = [srcFrame.origin[0] - OX, srcFrame.origin[1] - OY];
const source = { ...raw, objects: raw.objects.map((o) => ({ ...o, x: o.x - DX, y: o.y - DY })) };
const ground = rawRows.slice(Math.max(0, DY)).map((r) => r.slice(Math.max(0, DX)));
const ch = (x: number, y: number) => ground[y]?.[x] ?? 'o';
const inFrame = (x: number, y: number) => x >= OX && y >= OY && x < OX + frame.size[0] && y < OY + frame.size[1];
/** An act-1 (local) cell in map cells. */
const at = (x: number, y: number): [number, number] => [x + OX, y + OY];

type Cell = [number, number];
const key = (x: number, y: number) => `${x},${y}`;
const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const col = new CollisionMap(map);
const walking = new WalkingMode();
const ROAD = 8, BRIDGE = 9, WATER = 2, RIVER = 7, MOUNTAIN = 3;
const terrain = (x: number, y: number) => map.collision[y * map.width + x];
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;

/** Cells reachable on foot from `start`; `blocked` cells are closed, `open` cells are walkable whatever they are. */
function reach(start: Cell, blocked = new Set<string>(), open = new Set<string>()): Set<string> {
  const seen = new Set([key(...start)]);
  const queue: Cell[] = [start];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (!inside(nx, ny) || seen.has(k) || blocked.has(k)) continue;
      if (!open.has(k) && !col.isWalkable(nx, ny, walking)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

function steps(from: Cell, to: Cell): number {
  const dist = new Map([[key(...from), 0]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (x === to[0] && y === to[1]) return dist.get(key(x, y))!;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (!inside(nx, ny) || dist.has(k) || !col.isWalkable(nx, ny, walking)) continue;
      dist.set(k, dist.get(key(x, y))! + 1);
      queue.push([nx, ny]);
    }
  }
  return Infinity;
}

/** 4-connected components of the act-1 frame's cells matching `pred`. */
function components(pred0: (x: number, y: number) => boolean): Cell[][] {
  const pred = (x: number, y: number) => inFrame(x, y) && pred0(x, y);
  const seen = new Set<string>();
  const out: Cell[][] = [];
  for (let y = OY; y < OY + frame.size[1]; y++) {
    for (let x = OX; x < OX + frame.size[0]; x++) {
      if (!pred(x, y) || seen.has(key(x, y))) continue;
      const comp: Cell[] = [];
      const queue: Cell[] = [[x, y]];
      seen.add(key(x, y));
      while (queue.length) {
        const [cx, cy] = queue.shift()!;
        comp.push([cx, cy]);
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (inside(nx, ny) && pred(nx, ny) && !seen.has(key(nx, ny))) {
            seen.add(key(nx, ny));
            queue.push([nx, ny]);
          }
        }
      }
      out.push(comp);
    }
  }
  return out;
}

const entrance = (name: string): Cell => map.entrances![name] as Cell;
const start = entrance('cornelia');
const gates = map.keyItemGates ?? [];
const gateCells = new Set(gates.map((g) => key(g.x, g.y)));
const cityWarps = map.transitions.filter((t) => t.targetMap === 'cornelia');
/** The water cells between the two stubs in each gate column, and the cell just north of them (the far stub). */
const gapOf = (g: { x: number; y: number }) => {
  const cells: Cell[] = [];
  let y = g.y - 1;
  while (y >= 0 && terrain(g.x, y) === WATER) cells.push([g.x, y--]);
  return { cells, beyond: terrain(g.x, y) };
};
const gap = gates.flatMap((g) => gapOf(g).cells);
const eastBridge = Array.from({ length: map.width * map.height }, (_, i): Cell => [i % map.width, Math.floor(i / map.width)])
  .filter(([x, y]) => inFrame(x, y) && terrain(x, y) === BRIDGE && DIRS.some(([dx, dy]) => inside(x + dx, y + dy) && terrain(x + dx, y + dy) === RIVER));
const roadCell = (x: number, y: number) => terrain(x, y) === ROAD || terrain(x, y) === BRIDGE;
/** The pier's end: the one inspect cell that talks of the pier (on the water just off the jetty). */
const pier = (): Cell => {
  const e = (map.inspect ?? []).filter((i) => (i.text as string[]).some((l) => /pier/i.test(l)));
  expect(e).toHaveLength(1);
  return [e[0].x, e[0].y];
};
/** The jetty's bridge cells, from the pier's end inland (nearest the pier first). */
const jettyCells = (): Cell[] => {
  const [px, py] = pier();
  const cells: Cell[] = [];
  for (let y = py - 1; terrain(px, y) === BRIDGE; y--) cells.push([px, y]);
  return cells;
};
const doorCell = (c: Cell[]) => c.length === 1 && map.transitions.some((t) => t.x === c[0][0] && t.y === c[0][1]);
// not the far stub, nor a lone door cell (the compiler makes an icon's door a road cell: A1-O's Matoya and Pravoka)
const roadComps = components(roadCell).filter((c) => !c.every(([x, y]) => terrain(x, y) === BRIDGE) && !doorCell(c));

describe('overworld layout (T3c)', () => {
  it('cornelia is the first entrance (safeSpawn falls back to it) and the entrance contract holds', () => {
    expect(Object.keys(map.entrances!)[0]).toBe('cornelia');
    for (const name of ['cornelia', 'cornelia_west', 'cornelia_east', 'cornelia_north', 'castle', 'temple', 'north_shore']) {
      expect(map.entrances![name], name).toBeDefined();
    }
    expect(map.entrances!.castle).toEqual(map.entrances!.cornelia_north);
  });

  it('OW-15: the range seals the land route; only the bridge gap keeps the north shore out of reach', () => {
    expect(gates.length).toBe(2);
    for (const g of gates) {
      expect(terrain(g.x, g.y), 'the gate sits on the south stub').toBe(BRIDGE);
      expect(gapOf(g).cells.length, `open water in column ${g.x}`).toBe(2);
      expect(gapOf(g).beyond, `the north stub in column ${g.x}`).toBe(BRIDGE);
    }
    const north = key(...entrance('north_shore'));
    expect(reach(start, gateCells).has(north)).toBe(false);      // gates closed
    expect(reach(start).has(north)).toBe(false);                 // gates open, gap still water
    expect(reach(start, new Set(), new Set(gap.map((c) => key(...c)))).has(north)).toBe(true);   // gap bridged
    // the mainland is clearly larger than the peninsula, and joins it over land behind the range
    const peninsula = reach(start);
    const mainland = reach(entrance('north_shore'));
    expect(mainland.size, `mainland ${mainland.size} vs peninsula ${peninsula.size} cells`)
      .toBeGreaterThan(1.15 * peninsula.size);
    // the isthmus: were the mountains walkable, the north shore could be reached on foot (no water in the way)
    const rock = new Set<string>();
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (inFrame(x, y) && terrain(x, y) === MOUNTAIN) rock.add(key(x, y));
    expect(reach(start, gateCells, rock).has(north)).toBe(true);
  });

  it('OW-9: the broken-bridge debris lies over the gap as art only; the four gap cells stay water', () => {
    const debris = source.objects.filter((o) => (o.parts ?? []).flat().some((p) => p?.startsWith('bridge_gap_')));
    expect(debris.length).toBe(1);
    const d = debris[0] as typeof debris[0] & { block?: boolean; on_water?: boolean; style?: string };
    expect(d.parts).toEqual([['bridge_gap_0_0', 'bridge_gap_0_1'], ['bridge_gap_1_0', 'bridge_gap_1_1']]);
    expect(d.style, 'W8: recoloured to the stubs\' pale stone (dE checked by build_map.py --selftest)').toBe('pale_stone');
    expect(d.block).toBe(false);
    expect(d.on_water).toBe(true);
    const footprint = [0, 1].flatMap((j) => [0, 1].map((i): Cell => [d.x + i, d.y + j]));
    expect(footprint.map(([x, y]) => key(x, y)).sort()).toEqual(gap.map(([x, y]) => key(x, y)).sort());
    for (const [x, y] of footprint) {
      expect(terrain(x, y), `(${x}, ${y}) is water`).toBe(WATER);
      expect(col.isWalkable(x, y, walking)).toBe(false);
    }
    // the parts are cut from the approved overworld/kit_grand sheet; temple_grand fell back there (W1 re-cut it as
    // overworld/grand_temple, see the W1 / W2 case)
    const grand = JSON.parse(readFileSync(join(root, 'assets-src/gen/approved/overworld/grand.json'), 'utf-8')) as
      { cells: Array<Array<string | null>>; metrics: { skipped: string[] } };
    for (const p of d.parts!.flat()) expect(grand.cells.flat()).toContain(p);
    expect(grand.metrics.skipped).toContain('temple_grand');
    // the gates are unchanged: both south-stub cells still need BRIDGE_BUILT
    expect(gates.map((g) => g.requiredFlag)).toEqual(['BRIDGE_BUILT', 'BRIDGE_BUILT']);
  });

  it('W1 / W2: the temple is the ruin cut from overworld/grand_temple, its door centred on the warp cell', () => {
    type Deco = { type: string; x: number; y: number; parts?: Array<Array<string | null>>; offset?: [number, number];
      collide?: string; walk_cells?: number[][] };
    const temples = (source.objects as Deco[]).filter((o) => (o.parts ?? []).flat().some((p) => p?.startsWith('temple_')));
    expect(temples.length).toBe(1);
    const t = temples[0];
    expect(source.objects.some((o) => o.type === 'prefab'), 'no temple_icon prefab any more').toBe(false);
    expect(t.type).toBe('deco');
    expect(t.collide).toBe('alpha');
    const used = t.parts!.flat().filter((p): p is string => p !== null);
    expect(used.length).toBe(4);
    for (const p of used) expect(p).toMatch(/^temple_ruin_\d_\d$/);
    // the third column is null: it owns the art's spill, so no peak draws over it
    expect(t.parts!.map((row) => row[2])).toEqual([null, null]);
    const sheet = JSON.parse(readFileSync(join(root, 'assets-src/gen/approved/overworld/grand_temple.json'), 'utf-8')) as
      { cells: Array<Array<string | null>>; metrics: { prop_px: Record<string, [number, number]>;
        door_px: Record<string, [number, number]> } };
    for (const p of used) expect(sheet.cells.flat()).toContain(p);
    const [pw, ph] = sheet.metrics.prop_px.temple_ruin;
    expect(pw, 'the old temple_icon was 48x50').toBeGreaterThanOrEqual(82);
    expect(ph).toBeGreaterThanOrEqual(82);
    // W2: the measured doorway's centre plus the offset lands on the door cell's centre (x 72 of the box), +- 6 px
    const [d0, d1] = sheet.metrics.door_px.temple_ruin;
    expect(d1 - d0, 'the doorway is at least 12 native px wide').toBeGreaterThanOrEqual(12);
    expect(Math.abs((d0 + d1) / 2 + (t.offset?.[0] ?? 0) - 72)).toBeLessThanOrEqual(6);
    // the door cell (deco.x + 1, deco.y + 1) is walkable and warps into the temple; the arrival is one cell south
    expect(t.walk_cells).toEqual([[1, 1]]);
    const door: Cell = [t.x + 1, t.y + 1];
    expect(col.isWalkable(...door, walking)).toBe(true);
    expect(map.transitions.filter((w) => w.targetMap === 'temple-of-fiends'))
      .toEqual([{ x: door[0], y: door[1], targetMap: 'temple-of-fiends', targetEntrance: 'entry' }]);
    expect(entrance('temple')).toEqual([door[0], door[1] + 1]);
    for (const [x, y] of [[t.x, t.y], [t.x + 1, t.y], [t.x, t.y + 1]] as Cell[]) {
      expect(col.isWalkable(x, y, walking), `temple body (${x}, ${y})`).toBe(false);
    }
  });

  it('OW-14: no walkable cell on the map edge', () => {
    for (let x = 0; x < map.width; x++) {
      for (const y of [0, map.height - 1]) expect(col.isWalkable(x, y, walking), `(${x},${y})`).toBe(false);
    }
    for (let y = 0; y < map.height; y++) {
      for (const x of [0, map.width - 1]) expect(col.isWalkable(x, y, walking), `(${x},${y})`).toBe(false);
    }
  });

  it('OW-1: the roads and bridges form one network linking the gates, the temple, both bridges, the tomb and the jetty', () => {
    expect(roadComps.length).toBe(1);
    const net = new Set(roadComps[0].map((c) => key(...c)));
    const tomb = map.inspect![0];
    const tombApproach = DIRS.map(([dx, dy]): Cell => [tomb.x + dx, tomb.y + dy]).filter(([x, y]) => terrain(x, y) === ROAD);
    const targets: Array<[string, Cell[]]> = [
      ...['cornelia', 'cornelia_west', 'cornelia_east', 'cornelia_north', 'temple'].map((n): [string, Cell[]] => [n, [entrance(n)]]),
      ['north bridge (gated stub)', gates.map((g): Cell => [g.x, g.y])],
      ['east bridge', eastBridge],
      ['tomb clearing', tombApproach],
      ['jetty', [jettyCells()[0]]],
    ];
    for (const [name, cells] of targets) {
      expect(cells.length, name).toBeGreaterThan(0);
      for (const c of cells) expect(net.has(key(...c)), `${name} at ${c}`).toBe(true);
    }
  });

  it('OW-2: every gate is a doorway with exactly one walkable non-warp neighbour, and no arrival is a warp', () => {
    expect(cityWarps.length).toBe(4);
    const warps = new Set(map.transitions.map((t) => key(t.x, t.y)));
    for (const t of map.transitions) {
      const out = DIRS.filter(([dx, dy]) => col.isWalkable(t.x + dx, t.y + dy, walking) && !warps.has(key(t.x + dx, t.y + dy)));
      expect(out.length, `${t.targetMap}.${t.targetEntrance} at (${t.x},${t.y})`).toBe(1);
    }
    for (const [name, [x, y]] of Object.entries(map.entrances!)) expect(warps.has(key(x, y)), name).toBe(false);
  });

  it('OW-3 / CT-7 / M11: one warp per city gate, the north one to the castle door', () => {
    expect(cityWarps.map((t) => t.targetEntrance).sort()).toEqual(['castle', 'east_gate', 'south_gate', 'west_gate']);
    const at = (e: string) => cityWarps.find((t) => t.targetEntrance === e)!;
    expect(at('castle').y).toBeLessThan(at('west_gate').y);
    expect(at('south_gate').y).toBeGreaterThan(at('west_gate').y);
    expect(at('west_gate').x).toBeLessThan(at('east_gate').x);
  });

  it('OW-1: no road cell is hidden under an icon', () => {
    for (const o of source.objects.filter((ob) => ob.type === 'deco' && (ob.parts?.length ?? 0) > 1)) {
      o.parts!.forEach((row, j) => row.forEach((_, i) => {
        const x = o.x + i, y = o.y + j;
        if (ch(x, y) === ',') expect(col.isWalkable(x, y, walking), `road under the icon at (${x},${y})`).toBe(true);
      }));
    }
  });

  it('OW-6: the east river runs as one channel from its tarn to the sea, under the east bridge', () => {
    const water = (x: number, y: number) => ch(x, y) === 'r' || (ch(x, y) === '=' && eastBridge.some(([bx, by]) => bx === x && by === y));
    const touches = (cs: Cell[], c: string) => cs.some(([x, y]) => DIRS.some(([dx, dy]) => ch(x + dx, y + dy) === c));
    const river = components(water).find((cs) => cs.some(([x, y]) => eastBridge.some(([bx, by]) => bx === x && by === y)))!;
    expect(river).toBeDefined();
    expect(touches(river, '≈'), 'rises at a lake').toBe(true);
    expect(touches(river, 'o'), 'reaches the ocean').toBe(true);
    for (const [bx, by] of eastBridge) {
      expect(ch(bx, by - 1)).toBe('r');                           // straight through the bridge
      expect(ch(bx, by + 1)).toBe('r');
    }
  });

  it('OW-11: Erdrick\'s tomb can be inspected from a reachable cell, only by way of the east bridge', () => {
    const tomb = (map.inspect ?? []).filter((e) => (e.text as string[]).some((l) => l.includes('Here lies Erdrick')));
    expect(tomb.length).toBeGreaterThan(0);
    const seen = reach(start);
    const shut = reach(start, new Set(eastBridge.map((c) => key(...c))));
    for (const e of tomb) {
      const near = DIRS.map(([dx, dy]) => key(e.x + dx, e.y + dy));
      expect(near.some((k) => seen.has(k)), `(${e.x},${e.y}) reachable`).toBe(true);
      expect(near.some((k) => shut.has(k)), `(${e.x},${e.y}) without the east bridge`).toBe(false);
    }
  });

  it('act-1 distances stay close to the old map: south gate to the temple door and to the bridge foot', () => {
    const foot: Cell = [gates[0].x, gates[0].y + 1];
    const temple = steps(start, entrance('temple'));
    const bridge = steps(start, foot);
    expect(temple).toBeGreaterThanOrEqual(20);           // W6 (decision R-13): the footbridge shortens it 29 -> 23
    expect(temple).toBeLessThanOrEqual(40);
    expect(bridge).toBeGreaterThanOrEqual(18);
    expect(bridge).toBeLessThanOrEqual(30);
  });
});

describe('overworld encounter zones (T4e, §1.6)', () => {
  // the act-1 zones only: pass W's region zones carry their region prefix (WORLD 4.0.3) and include sea zones
  const zones = (map.encounterZones ?? []).filter((z) => !/^(a1|elf|ert|fir|ord|wat|wnd|pst)_/.test(z.id));
  const inRect = (x: number, y: number, [x0, y0, x1, y1]: [number, number, number, number]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  /** The zone the runtime picks for a cell (the first whose rects hold it), or null for the fields. */
  const zoneAt = (x: number, y: number) => zones.find((z) => z.rects.some((r) => inRect(x, y, r)))?.id ?? null;
  const cells = (id: string): Cell[] => zones.find((z) => z.id === id)!.rects
    .flatMap(([x0, y0, x1, y1]) => Array.from({ length: (x1 - x0 + 1) * (y1 - y0 + 1) },
      (_, i): Cell => [x0 + (i % (x1 - x0 + 1)), y0 + Math.floor(i / (x1 - x0 + 1))]));
  const tomb = map.inspect![0];
  const tombEnd: Cell = [tomb.x, tomb.y + 1];

  it('has the east pocket, then the temple approach', () => {
    expect(zones.map((z) => z.id)).toEqual(['east_pocket', 'temple_approach']);
  });

  it('keeps the city arrival and the north bridge foot in the fields; the temple door and the tomb are zoned', () => {
    expect(zoneAt(...start)).toBeNull();
    expect(zoneAt(gates[0].x, gates[0].y + 1), 'north bridge foot').toBeNull();
    expect(zoneAt(...entrance('temple'))).toBe('temple_approach');
    expect(zoneAt(...tombEnd)).toBe('east_pocket');
  });

  it('every zone cell is in bounds and walkable, and the zones do not overlap', () => {
    const owner = new Map<string, string>();
    for (const z of zones) {
      for (const [x, y] of cells(z.id)) {
        expect(inside(x, y), `${z.id} (${x},${y})`).toBe(true);
        expect(col.isWalkable(x, y, walking), `${z.id} (${x},${y}) walkable`).toBe(true);
        expect(owner.get(key(x, y)), `(${x},${y}) in ${z.id}`).toBeUndefined();
        owner.set(key(x, y), z.id);
      }
    }
  });

  it('the east pocket is what the tomb reaches without the east bridge', () => {
    const pocket = reach(tombEnd, new Set(eastBridge.map((c) => key(...c))));
    expect(new Set(cells('east_pocket').map((c) => key(...c)))).toEqual(pocket);
  });

  it('the temple approach is the cells closer on foot to the temple door than to any city gate (bridge closed)', () => {
    const shut = new Set(eastBridge.map((c) => key(...c)));
    const dist = (...from: Cell[]) => {
      const d = new Map(from.map((c) => [key(...c), 0]));
      const queue: Cell[] = [...from];
      while (queue.length) {
        const [x, y] = queue.shift()!;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (!inside(nx, ny) || d.has(k) || shut.has(k) || !col.isWalkable(nx, ny, walking)) continue;
          d.set(k, d.get(key(x, y))! + 1);
          queue.push([nx, ny]);
        }
      }
      return d;
    };
    const toTemple = dist(entrance('temple'));
    const toCity = dist(...['cornelia', 'cornelia_west', 'cornelia_east', 'cornelia_north'].map(entrance));
    // a warp cell (the temple door itself) is never a battle cell: the step filter skips it, so the zone may leave it out
    const warps = new Set(map.transitions.map((t) => key(t.x, t.y)));
    const want = new Set([...toTemple].filter(([k, d]) => d < (toCity.get(k) ?? Infinity) && !warps.has(k)).map(([k]) => k));
    // W7: a forest component joins the zone whole when at least half of it is closer to the temple, else leaves whole
    const reached = (k: string) => toTemple.has(k) || toCity.has(k);
    for (const comp of components((x, y) => ch(x, y) === 'f' && reached(key(x, y)))) {
      const ks = comp.map((c) => key(...c));
      const join = 2 * ks.filter((k) => want.has(k)).length >= ks.length;
      for (const k of ks) { if (join) want.add(k); else want.delete(k); }
    }
    const got = new Set(cells('temple_approach').map((c) => key(...c)));
    expect([...got].filter((k) => !want.has(k)), 'zoned but not closer to the temple').toEqual([]);
    expect([...want].filter((k) => !got.has(k)), 'closer to the temple but not zoned').toEqual([]);
  });
});

describe('overworld battle backgrounds (BA-12)', () => {
  const bg = map.battleBackgrounds!;
  /** Lowercase TerrainType names: the only keys `battleBackdropId` can match (the collision map's terrain). */
  const terrainNames = new Set(Object.keys(TerrainType).filter((k) => Number.isNaN(Number(k))).map((k) => k.toLowerCase()));
  const tables = [{ where: 'map', ...bg }, ...Object.entries(bg.zones ?? {}).map(([id, z]) => ({ where: `zone ${id}`, ...z }))];

  it('every background id (default, terrain, zones) names a staged file in assets/backgrounds/', () => {
    expect(bg.default).toBeDefined();
    for (const t of tables) {
      for (const id of [t.default, ...Object.values(t.terrain ?? {})].filter((v): v is string => v !== undefined)) {
        expect(existsSync(join(root, 'assets/backgrounds', `${id}.webp`)), `${t.where}: ${id}.webp`).toBe(true);
      }
    }
  });

  it('every terrain key is a TerrainType name, and every zone key an encounter zone id', () => {
    for (const t of tables) {
      for (const k of Object.keys(t.terrain ?? {})) expect(terrainNames.has(k), `${t.where}: terrain key ${k}`).toBe(true);
    }
    const zoneIds = new Set((map.encounterZones ?? []).map((z) => z.id));
    for (const id of Object.keys(bg.zones ?? {})) expect(zoneIds.has(id), `zone ${id}`).toBe(true);
  });

  it('the temple approach fights in the dark forest only in its forest; the east pocket in the ruined forest (T6h)', () => {
    // the plan's TF-3 table: no zone default for the temple approach, so its open fields keep the map's grassland
    expect(bg.zones?.temple_approach).toEqual({ terrain: { forest: 'dark_forest' } });
    expect(bg.zones?.east_pocket?.default).toBe('ruined_forest');
    expect(bg.zones?.east_pocket?.terrain?.desert).toBe('shoreline');
  });

  it('battles in the temple approach: forest gives dark_forest, open grass the map\'s grassland', () => {
    const zone = (map.encounterZones ?? []).find((z) => z.id === 'temple_approach')!;
    const terrainAt = (x: number, y: number): string | undefined => (inside(x, y) ? TerrainType[terrain(x, y)] : undefined);
    const picked = new Map<string, Set<string>>();
    for (const [x0, y0, x1, y1] of zone.rects) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = backdropTerrain({ x, y }, terrainAt) ?? '?';
        const id = battleBackdropId(bg, { x, y }, terrainAt, 'temple_approach') ?? '?';
        if (!picked.has(t)) picked.set(t, new Set());
        picked.get(t)!.add(id);
      }
    }
    expect([...picked.get('forest') ?? []]).toEqual(['dark_forest']);
    expect([...picked.get('grass') ?? []]).toEqual(['grassland']);   // open-field fights keep the grass backdrop
  });

  it('beach sand compiles to Desert, and Desert battles use the shoreline background', () => {
    const sand = ground.flatMap((row, y) => [...row].map((c, x): Cell | null => (c === 's' && inFrame(x, y) ? [x, y] : null)))
      .filter((c): c is Cell => c !== null);
    expect(sand.length).toBeGreaterThan(0);
    for (const [x, y] of sand) expect(terrain(x, y), `sand at (${x},${y})`).toBe(TerrainType.Desert);
    expect(bg.terrain?.desert).toBe('shoreline');
  });
});

describe('overworld second-pass fixes (R4b)', () => {
  const cornelia = parse(readFileSync(join(root, 'assets/maps/ai/cornelia.yaml'), 'utf-8')) as MapData;
  const city = source.objects.find((o) => (o.parts ?? []).flat().some((p) => p?.startsWith('city_')))!;
  const isWater = (x: number, y: number) => terrain(x, y) === WATER;

  it('T1: both bridge gates say the builders are at work once the King has ordered it (INTRO_COMPLETE)', () => {
    for (const g of gates) {
      const msg = g.message as Array<{ condition?: string; text: string[] }>;
      expect(Array.isArray(msg), `gate (${g.x},${g.y})`).toBe(true);
      const after = msg.find((m) => m.condition === 'INTRO_COMPLETE');
      const before = msg.find((m) => m.condition === undefined);
      expect(after?.text.join(' ')).toMatch(/at work/);
      expect(before?.text.join(' ')).toMatch(/collapsed/);
      expect(after!.text).not.toEqual(before!.text);
      expect(msg.indexOf(after!), 'the flagged line is checked first').toBeLessThan(msg.indexOf(before!));
    }
  });

  it('M11 / W10: the north warp sits on the wall\'s top row and lands in front of the castle door', () => {
    const north = cityWarps.find((t) => t.targetEntrance === 'castle')!;
    expect(north.y, 'the city icon\'s top row').toBe(city.y);
    const door = cornelia.transitions.find((t) => t.targetMap === 'cornelia-castle')!;
    expect(cornelia.entrances!.castle).toEqual([door.x, door.y + 1]);
  });

  it('W10: every city gate road runs onto its warp cell', () => {
    for (const t of cityWarps) expect(terrain(t.x, t.y), `${t.targetEntrance} at (${t.x},${t.y})`).toBe(ROAD);
    const net = new Set(roadComps[0].map((c) => key(...c)));
    for (const t of cityWarps) expect(net.has(key(t.x, t.y)), `${t.targetEntrance} in the road network`).toBe(true);
  });

  it('W6: a footbridge over the city stream: the field west of the stream is a few steps from the south gate', () => {
    expect(steps(start, at(24, 47))).toBeLessThanOrEqual(8);
  });

  it('W9: the jetty runs out between open water, and its end can be inspected', () => {
    // QUEST 4.3: found from the pier's inspect cell, not the ship spawn (A1-T moves the ship to Pravoka's quay)
    const jetty = jettyCells();
    expect(jetty.length).toBe(3);
    for (const [x, y] of jetty) expect(isWater(x - 1, y) && isWater(x + 1, y), `jetty (${x},${y})`).toBe(true);
    expect(isWater(...pier())).toBe(true);
  });

  it('W11: no vines hang in mid-air (none on a cell below walkable ground or grass)', () => {
    for (const o of source.objects) {
      (o.parts ?? []).forEach((row, j) => row.forEach((p, i) => {
        if (p !== 'vines') return;
        const x = o.x + i, y = o.y + j;
        expect(col.isWalkable(x, y - 1, walking) || ch(x, y - 1) === '.', `vines at (${x},${y})`).toBe(false);
      }));
    }
  });

  it('W12: the east pocket holds a chest (an Iron Shield), reachable only over the east bridge', () => {
    const chests = (map.npcs ?? []).filter((n) => n.chestItem);
    expect(chests.map((c) => [c.chestItem, c.chestFlag])).toEqual([['iron_shield', 'CHEST_ERDRICK_TOMB']]);
    const pocket = map.encounterZones!.find((z) => z.id === 'east_pocket')!;
    const [c] = chests;
    expect(pocket.rects.some(([x0, y0, x1, y1]) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1)).toBe(true);
    const shut = reach(start, new Set(eastBridge.map((b) => key(...b))));
    expect(DIRS.some(([dx, dy]) => shut.has(key(c.x + dx, c.y + dy)))).toBe(false);
    expect(DIRS.some(([dx, dy]) => reach(start).has(key(c.x + dx, c.y + dy)))).toBe(true);
  });

  it('W7: no forest is split by the temple approach\'s edge', () => {
    const zone = map.encounterZones!.find((z) => z.id === 'temple_approach')!;
    const inZone = (x: number, y: number) => zone.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    for (const comp of components((x, y) => ch(x, y) === 'f' && col.isWalkable(x, y, walking))) {
      const n = comp.filter(([x, y]) => inZone(x, y)).length;
      expect(n === 0 || n === comp.length, `forest at (${comp[0]}): ${n} of ${comp.length} cells zoned`).toBe(true);
    }
  });
});

describe('overworld third-pass fixes (U)', () => {
  it('U17: two builders stand beside the south stub from INTRO_COMPLETE on, on walkable cells off the stub', () => {
    const stub = gates.map((g) => [g.x, g.y] as Cell);
    expect(stub).toEqual([at(29, 32), at(30, 32)]);
    const workers = map.npcs.filter((n) => n.showIf === 'INTRO_COMPLETE');
    expect(workers).toHaveLength(2);
    const atlas = JSON.parse(readFileSync(join(root, 'assets/sprites/characters-ai.json'), 'utf-8')) as
      { sheets: Record<string, unknown> };
    const start = entrance('cornelia');
    const reachable = reach(start);
    for (const w of workers) {
      const near = Math.min(...stub.map(([x, y]) => Math.abs(w.x - x) + Math.abs(w.y - y)));
      expect(near, w.id).toBeLessThanOrEqual(2);
      expect(stub.some(([x, y]) => x === w.x && y === w.y), `${w.id} on the stub`).toBe(false);
      expect(col.isWalkable(w.x, w.y, walking), `${w.id} cell`).toBe(true);
      expect(reachable.has(key(w.x, w.y)), `${w.id} can be walked up to`).toBe(true);
      expect(atlas.sheets[w.sprite], `${w.sprite}: existing field art`).toBeDefined();
      expect((w.dialog as string[]).join(' ').length).toBeGreaterThan(0);
    }
    // the stub's road stays open: the bridge foot is still reachable with the workers standing
    const blocked = new Set(workers.map((w) => key(w.x, w.y)));
    expect(reach(start, blocked).has(key(...at(29, 33)))).toBe(true);
  });

  it('U19: the temple icon uses the `brighter` recolour (darker than the city at 0.25 scale under `bright`)', () => {
    const temple = (source.objects as Array<{ name?: string; style?: string }>).find((o) => o.name === 'temple')!;
    expect(temple.style).toBe('brighter');
  });
});
