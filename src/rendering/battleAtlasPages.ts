/**
 * Pass CL (docs/CLASS_LANCE_PLAN.md 3): the party battle atlas's pages. The main file holds one row per 80 x 80 class
 * at the top-level `cell` / `footRow`; an oversize class (the lance pair, 160 x 144) sits on its own page with its own
 * `cell`, `footRow`, `body` (the 80 x 80 box its body is drawn in, native px) and `grid` [cols, rows]: its `row` is its
 * block index and pose p is at cell (p % cols, row * rows + p // cols). Pure (no PixiJS), shared by CharacterAtlas and
 * the tests.
 */

/** A page file of the atlas (`pages[0]` is the main file). */
export interface BattleAtlasPage { file: string; w: number; h: number }

/** One class's entry in `sheets`. Main-page classes carry only `row` (and `inbetweens`). */
export interface BattleSheetEntry {
  row: number;
  page?: number;
  cell?: [number, number];
  footRow?: number;
  /** [x, y, w, h] native px of the 80 x 80 box the body is drawn in. */
  body?: [number, number, number, number];
  grid?: [number, number];
  /** The attack frame's leftmost opaque column (native px): the lunge's lead (D-CL12). */
  reach?: number;
  /** The topmost opaque row over every pose (native px): the lunge never lifts it into the message window. */
  top?: number;
  /** Per pose (the atlas `poses` order): the body's head (the lance left out), native px. */
  heads?: ([number, number] | null)[];
}

export interface PagedBattleMeta {
  cell: [number, number];
  scale: number;
  poses: string[];
  footRow: number;
  sheets: Record<string, BattleSheetEntry>;
  pages?: BattleAtlasPage[];
}

/** A native-px rectangle. */
export interface CellRect { x: number; y: number; w: number; h: number }

export function sheetPage(meta: PagedBattleMeta, id: string): number {
  return meta.sheets[id]?.page ?? 0;
}

export function cellOf(meta: PagedBattleMeta, id: string): [number, number] {
  const s = meta.sheets[id];
  return s?.page ? (s.cell ?? meta.cell) : meta.cell;
}

export function footRowOf(meta: PagedBattleMeta, id: string): number {
  const s = meta.sheets[id];
  return s?.page ? (s.footRow ?? meta.footRow) : meta.footRow;
}

/** The body box in native cell px: the whole cell for a main-page class. */
export function bodyOf(meta: PagedBattleMeta, id: string): CellRect {
  const s = meta.sheets[id];
  const [w, h] = cellOf(meta, id);
  if (s?.page && s.body) return { x: s.body[0], y: s.body[1], w: s.body[2], h: s.body[3] };
  return { x: 0, y: 0, w, h };
}

/** The page file of a page index (0: the main file, named by `pages[0]` or the default). */
export function pageFile(meta: PagedBattleMeta, page: number, mainFile: string): string {
  if (page === 0) return meta.pages?.[0]?.file ?? mainFile;
  const p = meta.pages?.[page];
  if (!p) throw new Error(`battle atlas: page ${page} is not listed`);
  return p.file;
}

/** The cell of `pose` (an index into `meta.poses`) of class `id` on its page, in atlas png px (native x scale). */
export function cellRect(meta: PagedBattleMeta, id: string, col: number): CellRect {
  const s = meta.sheets[id];
  const [gw, gh] = cellOf(meta, id);
  const k = meta.scale;
  let cx = col;
  let cy = s.row;
  if (s.page) {
    const [cols, rows] = s.grid ?? [meta.poses.length, 1];
    cx = col % cols;
    cy = s.row * rows + Math.floor(col / cols);
  }
  return { x: cx * gw * k, y: cy * gh * k, w: gw * k, h: gh * k };
}
