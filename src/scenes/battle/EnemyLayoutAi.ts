/**
 * Enemy placement for the 2x preview art (docs/ART_MONSTERS_PLAN.md). Pure function, screen pixels.
 *
 * Enemies are packed into columns inside ENEMY_AREA, left to right: boss columns first, then large, then small.
 * A column holds one size class (1 boss, 2 large or 3 small) stacked with equal gaps. Odd columns are shifted down by
 * half a step (the classic staggered look) when there is room. If the group is wider than the area, every box is
 * shown at half size (art at 1x screen scale, still whole pixels).
 */
export type EnemySizeClass = 'small' | 'large' | 'boss';

export interface EnemyBoxInput {
  size: EnemySizeClass;
  /** Box size at the art's normal screen scale. */
  w: number;
  h: number;
}

export interface EnemyBox {
  /** Horizontal centre and feet line (bottom of the box). */
  x: number;
  feetY: number;
  w: number;
  h: number;
  /** 1 = normal, 0.5 = shrunk to fit. */
  scaleFactor: number;
}

/** y0 = 200 so even the smallest (160 px) box has its feet at y >= 360, on the background's battle plain. */
export const ENEMY_AREA = { x0: 80, x1: 1340, y0: 200, y1: 770 } as const;
/** Battle plain feet rule (docs/ART_BATTLE_PLAN.md). */
export const STAGE_FEET = { min: 360, max: 770 } as const;
const COLUMN_GAP = 24;
const ROW_GAP = 16;
const CAPACITY: Record<EnemySizeClass, number> = { boss: 1, large: 2, small: 3 };
const ORDER: EnemySizeClass[] = ['boss', 'large', 'small'];

interface Column { size: EnemySizeClass; items: number[]; w: number; h: number }

function columns(boxes: EnemyBoxInput[], f: number): Column[] {
  const cols: Column[] = [];
  for (const size of ORDER) {
    const idx = boxes.map((b, i) => (b.size === size ? i : -1)).filter((i) => i >= 0);
    for (let c = 0; c < idx.length; c += CAPACITY[size]) {
      const items = idx.slice(c, c + CAPACITY[size]);
      const w = Math.max(...items.map((i) => boxes[i].w * f));
      const h = items.reduce((sum, i) => sum + boxes[i].h * f, 0) + ROW_GAP * (items.length - 1);
      cols.push({ size, items, w, h });
    }
  }
  return cols;
}

export function computeEnemyLayoutAi(boxes: EnemyBoxInput[]): EnemyBox[] {
  const areaW = ENEMY_AREA.x1 - ENEMY_AREA.x0;
  const areaH = ENEMY_AREA.y1 - ENEMY_AREA.y0;
  let f = 1;
  let cols = columns(boxes, f);
  const width = (cs: Column[]) => cs.reduce((s, c) => s + c.w, 0) + COLUMN_GAP * Math.max(0, cs.length - 1);
  if (width(cols) > areaW || cols.some((c) => c.h > areaH)) {
    f = 0.5;
    cols = columns(boxes, f);
  }
  const out: EnemyBox[] = new Array(boxes.length);
  let x = ENEMY_AREA.x0 + (areaW - width(cols)) / 2;
  cols.forEach((col, ci) => {
    const slack = areaH - col.h;
    const step = col.items.length > 0 ? (col.h + ROW_GAP) / col.items.length : 0;
    // stagger: even columns sit s/2 higher, odd columns s/2 lower; |s/2| <= slack/2 keeps both inside the area
    const s = cols.length > 1 ? Math.min(step / 2, slack) : 0;
    let y = ENEMY_AREA.y0 + slack / 2 + (ci % 2 === 1 ? s / 2 : -s / 2);
    // feet on the battle plain even for shrunk (half-size) boxes: the first enemy's feet at STAGE_FEET.min or lower
    const firstH = boxes[col.items[0]].h * f;
    y = Math.min(Math.max(y, STAGE_FEET.min - firstH), ENEMY_AREA.y1 - col.h);
    for (const i of col.items) {
      const w = boxes[i].w * f;
      const h = boxes[i].h * f;
      out[i] = { x: Math.round(x + col.w / 2), feetY: Math.round(y + h), w, h, scaleFactor: f };
      y += h + ROW_GAP;
    }
    x += col.w + COLUMN_GAP;
  });
  return out;
}

/** Most enemies in one battle; equal to EncounterTable's MAX_FORMATION (a test checks). */
export const MAX_LAYOUT = 9;

/**
 * True when a formation (the boxes of its maximum roll) holds 1 to MAX_LAYOUT enemies and lays out at scale 1 or 0.5
 * with every box inside ENEMY_AREA and no two boxes overlapping.
 */
export function formationFits(sizes: EnemyBoxInput[]): boolean {
  if (sizes.length === 0 || sizes.length > MAX_LAYOUT) return false;
  const rs = computeEnemyLayoutAi(sizes).map((b) => ({ l: b.x - b.w / 2, r: b.x + b.w / 2, t: b.feetY - b.h, btm: b.feetY }));
  const inside = rs.every((r) => r.l >= ENEMY_AREA.x0 && r.r <= ENEMY_AREA.x1 && r.t >= ENEMY_AREA.y0
    && r.btm <= ENEMY_AREA.y1);
  if (!inside) return false;
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      if (a.l < b.r && b.l < a.r && a.t < b.btm && b.t < a.btm) return false;
    }
  }
  return true;
}
