/**
 * SMOKE experiment: the pure pixel bitmaps of the volcano smoke options (smokeStyles.ts). A bitmap is rows of palette
 * indices + 1 ('0' empty, '1' outline, '2' shade, '3' body, '4' highlight), drawn 1 art px per character; the fade is
 * an ordered (Bayer 4x4) dither, so every drawn pixel is opaque (binary alpha). No PixiJS here.
 */

/** A 15-bit colour (5 bits per channel, 0-31) as the 24-bit value the field art uses (snes_palette.c15). */
export function rgb15(r: number, g: number, b: number): number {
  const e = (v: number): number => (v << 3) | (v >> 2);
  return (e(r) << 16) | (e(g) << 8) | e(b);
}

/** A lobe of a cloud, in units of the cloud's radius: centre (x, y) and radius r. */
export type Lobe = readonly [number, number, number];

/** One round disc. */
export const DISC: readonly Lobe[] = [[0, 0, 1]];
/** A cauliflower billow: a back top lobe, the body, and two front lobes low on either side (back to front). */
export const CLUSTER: readonly Lobe[] = [[0.08, -0.4, 0.53], [0, 0.08, 0.64], [-0.44, 0.3, 0.5], [0.46, 0.34, 0.44]];

/** Ordered-dither thresholds: level k (0-3) drops the pixels whose threshold is below 4 k (k = 1: a quarter gone). */
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

export interface ShapeOptions {
  /** false: the rim gets the shade colour instead of the outline (a softer puff). */
  outline?: boolean;
  /** 0 (solid) to 3 (a quarter of the pixels left). */
  level?: number;
}

/**
 * A cloud of radius `r` art px made of `lobes`, lit from the top left: a 1 px outline round the whole cloud, a shade
 * contour where a front lobe overlaps a back one, and per-lobe highlight and shade.
 */
export function cloudShape(r: number, lobes: readonly Lobe[] = DISC, opts: ShapeOptions = {}): string[] {
  const n = 2 * r;
  const level = opts.level ?? 0;
  const at = (x: number, y: number): number => {   // the front-most lobe covering pixel (x, y), or -1
    if (x < 0 || y < 0 || x >= n || y >= n) return -1;
    const px = x + 0.5 - r, py = y + 0.5 - r;
    for (let k = lobes.length - 1; k >= 0; k--) {
      const [cx, cy, lr] = lobes[k];
      if ((px - cx * r) ** 2 + (py - cy * r) ** 2 <= (lr * r) ** 2) return k;
    }
    return -1;
  };
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) {
      const k = at(x, y);
      if (k < 0 || BAYER4[y & 3][x & 3] < level * 4) { row += '0'; continue; }
      const nb = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      if (nb.includes(-1)) { row += opts.outline === false ? '2' : '1'; continue; }
      if (nb.some((j) => j < k)) { row += '2'; continue; }                  // a front lobe's rim over a back lobe
      const [cx, cy, lr] = lobes[k];
      const lit = ((x + 0.5 - r - cx * r) + (y + 0.5 - r - cy * r)) / (lr * r);
      row += lit < -0.72 ? '4' : lit > 0.5 ? '2' : '3';
    }
    rows.push(row);
  }
  return rows;
}

/** An ellipse of half-axes (rx, ry) with a hot core: the crater glow ('1' dark red rim, '2' orange, '3' yellow). */
export function glowShape(rx: number, ry: number, level = 0): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 2 * ry; y++) {
    let row = '';
    for (let x = 0; x < 2 * rx; x++) {
      const d = ((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2;
      const rim = d > 0.55;
      if (d > 1 || (rim && BAYER4[y & 3][x & 3] < 8 + level * 4)) { row += '0'; continue; }
      row += rim ? '1' : d > 0.2 ? '2' : '3';
    }
    rows.push(row);
  }
  return rows;
}

/** The horizontal runs of each colour of a bitmap: [x, y, length, index] (index = character - 1). */
export function shapeRuns(rows: string[]): [number, number, number, number][] {
  const runs: [number, number, number, number][] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let e = x + 1;
      while (e < row.length && row[e] === ch) e++;
      if (ch !== '0') runs.push([x, y, e - x, Number(ch) - 1]);
      x = e;
    }
  });
  return runs;
}
