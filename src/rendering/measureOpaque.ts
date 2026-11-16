import type { Texture } from 'pixi.js';

/**
 * The opaque box [left, top, right, bottom] (art px in the cell, inclusive) of one atlas frame, read from the page
 * image in a browser; null outside one (tests) or for an empty frame. BattleArt uses it for sheets whose index lacks
 * `opaqueRight` or `idleBox` (FW-A2): an older atlas.
 */
export function measureOpaqueBox(sprite: string, tex: Texture, [x, y]: [number, number], [w, h]: [number, number],
  ts: number): [number, number, number, number] | null {
  if (typeof document === 'undefined') return null;
  try {
    const [pw, ph] = [Math.round(w * ts), Math.round(h * ts)];
    const canvas = document.createElement('canvas');
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx?.drawImage(tex.source.resource as CanvasImageSource, x * ts, y * ts, pw, ph, 0, 0, pw, ph);
    const data = ctx?.getImageData(0, 0, pw, ph).data;
    if (!data) return null;
    let [l, t, r, b] = [pw, ph, -1, -1];
    for (let row = 0; row < ph; row++) {
      for (let col = 0; col < pw; col++) {
        if (data[(row * pw + col) * 4 + 3] === 0) continue;
        l = Math.min(l, col); r = Math.max(r, col); t = Math.min(t, row); b = Math.max(b, row);
      }
    }
    if (r < 0) return null;
    return [Math.floor(l / ts), Math.floor(t / ts), Math.floor(r / ts), Math.floor(b / ts)];
  } catch (err) {
    console.warn(`Monster art: could not measure the opaque box of "${sprite}"; using its cell`, err);
    return null;
  }
}
