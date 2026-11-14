/**
 * Minimal PNG reader for tests: decodes non-interlaced 8-bit RGBA PNGs (what the asset pipeline writes) with
 * node:zlib, so tests can measure the committed art (e.g. opaque insets of atlas cells) without a dependency.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export interface RgbaImage { width: number; height: number; data: Uint8Array }

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function readRgbaPng(path: string): RgbaImage {
  const buf = readFileSync(path);
  let off = 8;
  let width = 0, height = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];
      if (depth !== 8 || colour !== 6 || interlace !== 0) {
        throw new Error(`readRgbaPng: ${path} is not 8-bit non-interlaced RGBA (depth ${depth}, colour ${colour}, interlace ${interlace})`);
      }
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x];
      const a = x >= 4 ? data[dst + x - 4] : 0;
      const b = y > 0 ? data[dst - stride + x] : 0;
      const c = x >= 4 && y > 0 ? data[dst - stride + x - 4] : 0;
      const pred = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
      data[dst + x] = (v + pred) & 0xff;
    }
  }
  return { width, height, data };
}

/** Bounding box [left, top, right, bottom) of the pixels with alpha > 0 inside a cell, relative to the cell; null if empty. */
export function opaqueBounds(img: RgbaImage, x0: number, y0: number, w: number, h: number): [number, number, number, number] | null {
  let l = w, t = h, r = -1, b = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (img.data[((y0 + y) * img.width + x0 + x) * 4 + 3] === 0) continue;
      if (x < l) l = x;
      if (x > r) r = x;
      if (y < t) t = y;
      if (y > b) b = y;
    }
  }
  return r < 0 ? null : [l, t, r + 1, b + 1];
}
