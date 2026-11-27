/**
 * Reading a texture's pixels once (a canvas pass over its frame of the atlas image), for the stone grey copies and the
 * head anchor of the status overlays. Outside a browser (unit tests) there is no canvas: `readPixels` returns null and
 * callers fall back (the coloured texture, the bounds' top-centre).
 */
import type { Texture } from 'pixi.js';

export interface Pixels { data: Uint8ClampedArray; w: number; h: number }

/** The texture's frame as RGBA bytes, or null (no document, or the image cannot be read; warned once). */
let warned = false;
export function readPixels(tex: Texture): Pixels | null {
  if (typeof document === 'undefined') return null;
  const resource = tex.source?.resource as CanvasImageSource | undefined;
  if (!resource) return null;
  const { x, y, width, height } = tex.frame;
  const w = Math.round(width);
  const h = Math.round(height);
  if (w <= 0 || h <= 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(resource, x, y, w, h, 0, 0, w, h);
    return { data: ctx.getImageData(0, 0, w, h).data, w, h };
  } catch (err) {
    if (!warned) console.warn('Status visuals: could not read a battle texture; no stone grey / head anchor for it', err);
    warned = true;
    return null;
  }
}

const heads = new WeakMap<Texture, { x: number; y: number } | null>();

/** Pass CL (docs/CLASS_LANCE_PLAN.md 7.2): a frame whose head is known (an oversize hero's body head, the lance left
 *  out, recorded by the atlas build) answers `headOf` without a pixel scan. Texture px. */
export function setKnownHead(tex: Texture, head: { x: number; y: number } | null): void {
  heads.set(tex, head);
}

/** The topmost opaque row's centre, in texture px (the head the overlays and icons sit on), or null. Cached. */
export function headOf(tex: Texture, read: (t: Texture) => Pixels | null = readPixels): { x: number; y: number } | null {
  if (heads.has(tex)) return heads.get(tex) ?? null;
  const px = read(tex);
  let head: { x: number; y: number } | null = null;
  for (let row = 0; px && head === null && row < px.h; row++) {
    let lo = -1;
    let hi = -1;
    for (let col = 0; col < px.w; col++) {
      if (px.data[(row * px.w + col) * 4 + 3] === 0) continue;
      if (lo < 0) lo = col;
      hi = col;
    }
    if (lo >= 0) head = { x: (lo + hi + 1) / 2, y: row };
  }
  heads.set(tex, head);
  return head;
}
