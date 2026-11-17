/**
 * The originality self-check by layout topology (docs/QUEST_PLAN.md 4.6 item 2, docs/WORLD_PLAN.md 4.0.4), computed
 * from compiled maps: a dungeon's stair graph and whether it is a simple chain, dead-end branches per floor, the boss
 * room's octant and path length from the arrival, floor shapes (bounding-box aspect and fill), equal ground grids
 * (also mirrored or transposed), and the design note's `Topology:` line against the stair graph. Plus the phrase
 * test (item 3). Walkability comes from fieldRules.terrainAllows.
 */
import { baseTerrain, terrainAllows } from '../../src/systems/fieldRules.js';
import type { MapData } from '../../src/types/index.js';

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]] as const;

/** A floor's dungeon and label: `marsh-cave-b2` -> (`marsh-cave`, `B2`), `mirage-3f` -> (`mirage`, `3F`). */
export function floorOf(id: string): { dungeon: string; label: string } | null {
  const m = /^(.*)-(b\d+|\d+f|\d+)$/.exec(id);
  return m ? { dungeon: m[1], label: m[2].toUpperCase() } : null;
}

const walkable = (m: MapData, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < m.width && y < m.height && terrainAllows('walking', baseTerrain(m, x, y));

export interface StairGraph {
  floors: string[];
  edges: Array<[string, string]>;
  /** Not a simple chain: a floor with 2+ links out, a loop, or a one-way edge. */
  branching: boolean;
}

export function stairGraph(floors: MapData[]): StairGraph {
  const ids = new Set(floors.map((f) => f.id));
  const edges = new Set<string>();
  const ways = new Map<string, Set<string>>();       // the distinct arrival entrances of each floor-to-floor edge
  for (const f of floors) for (const t of f.transitions ?? []) if (ids.has(t.targetMap) && t.targetMap !== f.id) {
    edges.add(`${f.id}>${t.targetMap}`);
    const w = ways.get(`${f.id}>${t.targetMap}`) ?? new Set<string>();
    w.add(t.targetEntrance ?? `${t.targetX},${t.targetY}`);
    ways.set(`${f.id}>${t.targetMap}`, w);
  }
  const list = [...edges].map((e) => e.split('>') as [string, string]).sort();
  const oneWay = list.some(([a, b]) => !edges.has(`${b}>${a}`));
  const undirected = new Set(list.map(([a, b]) => [a, b].sort().join('|')));
  const degree = new Map<string, number>();
  for (const e of undirected) for (const f of e.split('|')) degree.set(f, (degree.get(f) ?? 0) + 1);
  // a simple chain: two-way stairs only, floors - 1 links, no floor linked to more than two others
  // twin stairs (two stairs joining the same two floors at different places) close a loop (ELF-O's keep)
  const twin = [...ways.values()].some((w) => w.size > 1);
  const chain = !oneWay && !twin && undirected.size === floors.length - 1 && [...degree.values()].every((d) => d <= 2);
  return { floors: floors.map((f) => f.id), edges: list, branching: !chain };
}

/** Dead-end cells (one walkable neighbour) that are not a transition or an entrance. */
export function deadEnds(m: MapData): number {
  const skip = new Set([...(m.transitions ?? []).map((t) => `${t.x},${t.y}`),
    ...Object.values(m.entrances ?? {}).map(([x, y]) => `${x},${y}`)]);
  let n = 0;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (!walkable(m, x, y) || skip.has(`${x},${y}`)) continue;
      if (DIRS.filter(([dx, dy]) => walkable(m, x + dx, y + dy)).length === 1) n++;
    }
  }
  return n;
}

/** The boss cell's compass octant (N, NE, ...) and walking path length from the arrival, or null. */
export function bossPosition(m: MapData): { octant: string; path: number } | null {
  const boss = (m.scriptedEncounters ?? []).find((e) => e.isBoss);
  const ents = m.entrances ?? {};
  const arr = ents.arrival ?? Object.values(ents)[0];
  if (!boss || !arr) return null;
  const deg = (Math.atan2(boss.x - arr[0], arr[1] - boss.y) * 180 / Math.PI + 360) % 360;
  const octant = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
  const dist = new Map<string, number>([[`${arr[0]},${arr[1]}`, 0]]);
  const q: Array<[number, number]> = [[arr[0], arr[1]]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS) {
      const k = `${x + dx},${y + dy}`;
      if (dist.has(k)) continue;
      const atBoss = x + dx === boss.x && y + dy === boss.y;
      if (!atBoss && !walkable(m, x + dx, y + dy)) continue;
      dist.set(k, dist.get(`${x},${y}`)! + 1);
      if (atBoss) return { octant, path: dist.get(k)! };
      q.push([x + dx, y + dy]);
    }
  }
  return { octant, path: -1 };
}

/** The walkable mask's bounding-box aspect (w / h) and fill (walkable cells / box area). */
export function floorShape(m: MapData): { aspect: number; fill: number } {
  let [x0, y0, x1, y1, n] = [Infinity, Infinity, -1, -1, 0];
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (!walkable(m, x, y)) continue;
    n++;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (!n) return { aspect: 0, fill: 0 };
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  return { aspect: w / h, fill: n / (w * h) };
}

export const within = (a: number, b: number, share = 0.05): boolean => Math.abs(a - b) <= share * Math.max(a, b);

/** Pairs of maps whose ground (collision) grids are equal, mirrored or transposed. */
export function equalGrounds(maps: MapData[]): string[] {
  const key = (f: (x: number, y: number) => number, w: number, h: number): string => {
    const rows: string[] = [];
    for (let y = 0; y < h; y++) { const r: number[] = []; for (let x = 0; x < w; x++) r.push(f(x, y)); rows.push(r.join(',')); }
    return `${w}x${h}:${rows.join('/')}`;
  };
  const forms = (m: MapData): string[] => {
    const c = (x: number, y: number): number => m.collision[y * m.width + x];
    const [w, h] = [m.width, m.height];
    return [key(c, w, h), key((x, y) => c(w - 1 - x, y), w, h), key((x, y) => c(x, h - 1 - y), w, h),
      key((x, y) => c(y, x), h, w)];
  };
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const m of maps) {
    const fs = forms(m);
    const hit = fs.map((f) => seen.get(f)).find((x) => x && x !== m.id);
    if (hit) out.push(`${hit} = ${m.id}`);
    seen.set(fs[0], m.id);
  }
  return out;
}

/** The floor labels and boss floor a `Topology:` line names (`B1 -> B2 (2 stairs) -> B3 boss`). */
export function topologyLine(line: string): { floors: string[]; boss: string | null } {
  const floors = [...new Set([...line.matchAll(/\b(B\d+|\d+F)\b/gi)].map((m) => m[1].toUpperCase()))];
  const boss = /\b(B\d+|\d+F)\s+boss\b/i.exec(line)?.[1].toUpperCase() ?? null;
  return { floors, boss };
}

/** About 20 famous lines of the classic script (QUEST 4.6 item 3; open question 5 lets the names stay). */
export const CLASSIC_LINES: readonly string[] = [
  'knock you all down', 'the world is veiled in darkness', 'the wind stops', 'the sea is wild', 'the earth begins to rot',
  'four warriors will come', 'each holding an orb', 'my crystal ball', 'i am astos', 'the prince has been sleeping',
  'the elf prince was cursed', 'one hundred years ago', '2000 years ago', 'you will be bored', 'the time loop',
  'rescue the princess', 'the bridge is complete', 'the lefeinish', 'i cannot see', 'chaos has stolen',
];

export function classicHits(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const l of lines) for (const p of CLASSIC_LINES) if (l.toLowerCase().includes(p)) out.push(`"${p}" in "${l}"`);
  return out;
}
