/**
 * Enemy placement for the 2x preview art (docs/ART_MONSTERS_PLAN.md). Pure function, screen pixels.
 *
 * Enemies are packed into columns inside ENEMY_AREA (a titan: TITAN_AREA), left to right: titan, boss, huge, large,
 * then small columns. A column holds one size class (1 titan, boss or huge, 2 large or 3 small) stacked with equal gaps.
 * Odd columns are shifted down by half a step (the classic staggered look) when there is room.
 * Every box keeps a whole screen scale (the sheet's `scale` x the layout factor, docs/REDESIGN_PLAN.md 2.5), over four
 * passes: (1) cells at full size; (2) packed by the home art's opaque extent (`ox0` / `ox1`, docs/ROSTER_FIX_PLAN.md
 * defect 2: the cells carry 10-24 art px of empty margin); (3) as 2, with the scale-3 sheets at screen scale 2 (a no-op
 * without one); (4) every box at screen scale 1 (half size for the scale-2 sheets, as before). A formation with a
 * scale-3 sheet that reaches pass 4 is not supported (`formationFits` refuses it).
 */
export type EnemySizeClass = 'small' | 'large' | 'huge' | 'boss' | 'titan';

export interface EnemyBoxInput {
  size: EnemySizeClass;
  /** Box size at the art's normal screen scale. */
  w: number;
  h: number;
  /** The home art's opaque extent in box px from the box's left: `ox0` inclusive, `ox1` exclusive (defaults 0, w). */
  ox0?: number;
  ox1?: number;
  /** The sheet's screen px per art px (FW-S: 3 for the rescaled sheets; default 2): the passes keep it whole. */
  scale?: number;
}

export interface EnemyBox {
  /** Horizontal centre and feet line (bottom of the box). */
  x: number;
  feetY: number;
  w: number;
  h: number;
  /** 1 = normal; shrunk to fit: 2/3 (a scale-3 sheet at screen scale 2) or 1 / scale (screen scale 1). */
  scaleFactor: number;
}

/** y0 = 200 so even the smallest (160 px) box has its feet at y >= 360, on the background's battle plain. */
export const ENEMY_AREA = { x0: 80, x1: 1340, y0: 200, y1: 745 } as const;
/** A titan (chaos, 600 px box) fights alone in a taller area (docs/REDESIGN_PLAN.md 4.2): its top stays under the
 *  message window (TRAVEL_CLEAR_Y 124). */
export const TITAN_AREA = { x0: 80, x1: 1340, y0: 140, y1: 745 } as const;
type Area = { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
/** Battle plain feet rule (docs/ART_BATTLE_PLAN.md); B13: the lowest feet stop 35 px above the bottom strip (y 780). */
export const STAGE_FEET = { min: 360, max: 745 } as const;
const COLUMN_GAP = 24;
/** The gap between the opaque extents of opaque-packed columns. */
const OPAQUE_GAP = 16;
const ROW_GAP = 16;
const CAPACITY: Record<EnemySizeClass, number> = { titan: 1, boss: 1, huge: 1, large: 2, small: 3 };
const ORDER: EnemySizeClass[] = ['titan', 'boss', 'huge', 'large', 'small'];
/** The atlas screen scale of a sheet without its own (`monsters-ai.json` `scale`). */
export const DEFAULT_SHEET_SCALE = 2;

/** The layout class of an enemy: its data `size`, except that a boss sheet shown at scale 3 (chaos under D-V6 = C2,
 *  docs/REDESIGN_PLAN.md 4.2: the 200 px boss band at display scale 3, a 600 px box) is laid out, hops and attacks in
 *  place as the titan class (TITAN_AREA, travel 0). */
export function layoutSizeOf(size: EnemySizeClass | undefined, sheetScale: number | undefined): EnemySizeClass {
  const s = size ?? 'small';
  return s === 'boss' && sheetScale === 3 ? 'titan' : s;
}

interface Column { size: EnemySizeClass; items: number[]; w: number; h: number }
/** How a layout attempt packs its columns: by the cells (gap 24) or by the opaque extents (gap 16), and the whole
 *  screen scale each box is shown at (`target`; the layout factor is target / the sheet's scale). */
interface Packing { target: (scale: number) => number; opaque: boolean }

const sheetScale = (b: EnemyBoxInput): number => b.scale ?? DEFAULT_SHEET_SCALE;
/** A box length at the pass's screen scale (multiplied first, so 384 at 2/3 is exactly 256). */
const at = (v: number, b: EnemyBoxInput, p: Packing): number => (v * p.target(sheetScale(b))) / sheetScale(b);
const factorOf = (b: EnemyBoxInput, p: Packing): number => p.target(sheetScale(b)) / sheetScale(b);

/** The opaque extent of a box in a pass, box px from its left: [left, right). */
const extentAt = (b: EnemyBoxInput, p: Packing): [number, number] => [at(b.ox0 ?? 0, b, p), at(b.ox1 ?? b.w, b, p)];
/** The opaque extent of a box at layout factor f (formationFits). */
const extent = (b: EnemyBoxInput, f: number): [number, number] => [(b.ox0 ?? 0) * f, (b.ox1 ?? b.w) * f];

/** The four passes (see the header). */
const PASSES: Packing[] = [
  { target: (s) => s, opaque: false },
  { target: (s) => s, opaque: true },
  { target: (s) => (s === 3 ? 2 : s), opaque: true },
  { target: () => 1, opaque: false },
];

function columns(boxes: EnemyBoxInput[], p: Packing): Column[] {
  const cols: Column[] = [];
  for (const size of ORDER) {
    const idx = boxes.map((b, i) => (b.size === size ? i : -1)).filter((i) => i >= 0);
    for (let c = 0; c < idx.length; c += CAPACITY[size]) {
      const items = idx.slice(c, c + CAPACITY[size]);
      const w = Math.max(...items.map((i) => {
        const [l, r] = extentAt(boxes[i], p);
        return p.opaque ? r - l : at(boxes[i].w, boxes[i], p);
      }));
      const h = items.reduce((sum, i) => sum + at(boxes[i].h, boxes[i], p), 0) + ROW_GAP * (items.length - 1);
      cols.push({ size, items, w, h });
    }
  }
  return cols;
}

/** The layout and the pass (1-4) it took. */
function layout(boxes: EnemyBoxInput[]): { out: EnemyBox[]; pass: number } {
  const area: Area = boxes.some((b) => b.size === 'titan') ? TITAN_AREA : ENEMY_AREA;
  const areaW = area.x1 - area.x0;
  const areaH = area.y1 - area.y0;
  const width = (cs: Column[], p: Packing) => cs.reduce((s, c) => s + c.w, 0)
    + (p.opaque ? OPAQUE_GAP : COLUMN_GAP) * Math.max(0, cs.length - 1);
  const fits = (cs: Column[], p: Packing) => width(cs, p) <= areaW && cs.every((c) => c.h <= areaH);
  let pass = 0;
  let p = PASSES[0];
  let cols = columns(boxes, p);
  while (pass < PASSES.length - 1 && !fits(cols, p)) {
    p = PASSES[++pass];
    cols = columns(boxes, p);
  }
  const out: EnemyBox[] = new Array(boxes.length);
  let x = area.x0 + (areaW - width(cols, p)) / 2;
  cols.forEach((col, ci) => {
    const slack = areaH - col.h;
    const step = col.items.length > 0 ? (col.h + ROW_GAP) / col.items.length : 0;
    // stagger: even columns sit s/2 higher, odd columns s/2 lower; |s/2| <= slack/2 keeps both inside the area
    const s = cols.length > 1 ? Math.min(step / 2, slack) : 0;
    let y = area.y0 + slack / 2 + (ci % 2 === 1 ? s / 2 : -s / 2);
    // feet on the battle plain even for shrunk boxes: the first enemy's feet at STAGE_FEET.min or lower
    const first = boxes[col.items[0]];
    y = Math.min(Math.max(y, STAGE_FEET.min - at(first.h, first, p)), area.y1 - col.h);
    for (const i of col.items) {
      const b = boxes[i];
      const w = at(b.w, b, p);
      const h = at(b.h, b, p);
      // opaque packing centres the opaque extent in the column (the cell centre moves by the art's off-centre)
      const [l, r] = extentAt(b, p);
      const cx = p.opaque ? x + col.w / 2 + w / 2 - (l + r) / 2 : x + col.w / 2;
      out[i] = { x: Math.round(cx), feetY: Math.round(y + h), w, h, scaleFactor: factorOf(b, p) };
      y += h + ROW_GAP;
    }
    x += col.w + (p.opaque ? OPAQUE_GAP : COLUMN_GAP);
  });
  return { out, pass: pass + 1 };
}

export function computeEnemyLayoutAi(boxes: EnemyBoxInput[]): EnemyBox[] {
  return layout(boxes).out;
}

/** Most enemies in one battle; equal to EncounterTable's MAX_FORMATION (a test checks). */
export const MAX_LAYOUT = 9;

/**
 * True when a formation (the boxes of its maximum roll) holds 1 to MAX_LAYOUT enemies and lays out with every opaque
 * rect (the box's opaque extent, its full height) inside its area and no two overlapping. Refused: a titan with any
 * other enemy (it fights alone), and a formation with a scale-3 sheet that only fits at pass 4 (screen scale 1).
 */
export function formationFits(sizes: EnemyBoxInput[]): boolean {
  if (sizes.length === 0 || sizes.length > MAX_LAYOUT) return false;
  const titan = sizes.some((b) => b.size === 'titan');
  if (titan && sizes.length > 1) return false;
  const { out, pass } = layout(sizes);
  if (pass === PASSES.length && sizes.some((b) => sheetScale(b) === 3)) return false;
  const area: Area = titan ? TITAN_AREA : ENEMY_AREA;
  const rs = out.map((b, i) => {
    const [l, r] = extent(sizes[i], b.scaleFactor);
    return { l: b.x - b.w / 2 + l, r: b.x - b.w / 2 + r, t: b.feetY - b.h, btm: b.feetY };
  });
  const inside = rs.every((r) => r.l >= area.x0 && r.r <= area.x1 && r.t >= area.y0 && r.btm <= area.y1);
  if (!inside) return false;
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      if (a.l < b.r && b.l < a.r && a.t < b.btm && b.t < a.btm) return false;
    }
  }
  return true;
}
