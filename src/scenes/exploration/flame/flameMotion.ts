/**
 * The pure motion of a prop's light (AR-P2; no PixiJS): 8 frames of 110 ms, each light on its own phase.
 * - Flicker: every flame pixel steps along its style's 4-colour ramp from its own level by a per-frame noise of -1, 0
 *   or +1 per 2-px row; with a tongue, some columns drop their top 1-3 px on a frame (only inside the flame's top
 *   quarter), so the flame's height jitters. Lava and embers (no tongue) only cycle the palette.
 * - Glow: a floor ellipse 1.4 times as wide as high, two Bayer 4x4 rings (8/16 of the pixels inside 0.55 r, 4/16 out
 *   to r), its radius breathing +-12 % over the loop. The Bayer pattern is fixed to the art px grid of the floor.
 */
export const FLAME_FRAMES = 8;
export const FLAME_FRAME_MS = 110;
export const FLAME_LOOP_MS = FLAME_FRAMES * FLAME_FRAME_MS;
export const GLOW_BREATH = 0.12;
export const GLOW_ASPECT = 1.4;

const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

/** A small integer hash (deterministic, unsigned 32 bit). */
export function hash3(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The seed of a flame shape: lights of the same prop share their frames (and their bitmaps). */
export function shapeSeed(rows: readonly string[]): number {
  let h = 2166136261;
  for (const ch of rows.join('/')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** A light's phase in ms, from its cell: lights never flicker in step by accident of placement. */
export function lightPhaseMs(x: number, y: number): number {
  return hash3(x, y, 7) % FLAME_LOOP_MS;
}

/** The frame (0-7) a light shows at time `ms`. */
export function frameAt(ms: number, phaseMs: number): number {
  return Math.floor((((ms + phaseMs) % FLAME_LOOP_MS) + FLAME_LOOP_MS) % FLAME_LOOP_MS / FLAME_FRAME_MS);
}

/** The flame rows (from the top) that may drop out: the top quarter, at least one (kit_props.tongue_rows too). */
export function tongueRows(height: number): number {
  return Math.max(1, Math.floor((height - 1) / 4));
}

/**
 * Frame `f` of a flame mask: rows of '0' (not drawn) or '1'-'4' (the ramp colour to draw). `rows` are the mask's
 * ramp levels ('.' none, '1'-'4').
 */
export function flameFrame(rows: readonly string[], tongue: boolean, f: number, seed: number): string[] {
  const h = rows.length, w = rows[0]?.length ?? 0;
  const drop = new Array<number>(w).fill(0);
  if (tongue) {
    const deep = tongueRows(h);
    for (let x = 0; x < w; x++) {
      const k = hash3(seed, f, 1000 + x);
      if (k % 100 >= 45) continue;                    // 45 % of the columns drop out on a frame
      const want = 1 + ((k >>> 8) % 3);               // 1-3 px
      let top = 0;
      while (top < h && rows[top][x] === '.') top++;
      for (let y = top; y < Math.min(h, top + want) && y < deep; y++) if (rows[y][x] !== '.') drop[x]++;
    }
  }
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    const shift = (hash3(seed, f, y >> 1) % 3) - 1;
    let row = '';
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') { row += '0'; continue; }
      let top = 0;
      while (rows[top][x] === '.') top++;
      if (y < top + drop[x]) { row += '0'; continue; }
      row += String(1 + Math.min(3, Math.max(0, Number(ch) - 1 + shift)));
    }
    out.push(row);
  }
  return out;
}

/** The glow radius (art px) of frame `f`: `glow` breathing +-GLOW_BREATH over the loop. */
export function glowRadius(glow: number, f: number): number {
  return Math.round(glow * (1 + GLOW_BREATH * Math.sin((2 * Math.PI * f) / FLAME_FRAMES)));
}

/**
 * The glow of radius `r` round a centre at art px (ax, ay) of the floor (only ax & 3, ay & 3 matter): rows of '1'
 * (lifted) and '0', from (-rx, -r) to (rx, r), rx = round(1.4 r).
 */
export function glowShape(r: number, ax: number, ay: number): string[] {
  const rx = Math.round(GLOW_ASPECT * r);
  const out: string[] = [];
  for (let j = -r; j <= r; j++) {
    let row = '';
    for (let i = -rx; i <= rx; i++) {
      const d = Math.sqrt((i / GLOW_ASPECT) ** 2 + j ** 2) / r;
      const level = d < 0.55 ? 8 : d < 1 ? 4 : 0;
      row += BAYER4[(ay + j) & 3][(ax + i) & 3] < level ? '1' : '0';
    }
    out.push(row);
  }
  return out;
}
