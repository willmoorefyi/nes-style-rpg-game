/**
 * Pass CL (docs/CLASS_LANCE_PLAN.md 3, 7.2): slicing one class's battle poses from its atlas page (the main file or an
 * oversize page) and recording each oversize frame's body head (the lance left out) for `headOf`.
 */
import { Assets, Rectangle, Texture } from 'pixi.js';
import { cellRect, type PagedBattleMeta } from './battleAtlasPages.js';
import { setKnownHead } from '../scenes/battle/fx/texturePixels.js';

/** Load the oversize pages (`pages[1..]`); a page that fails logs one console.error and stays null (its classes
 *  fall back to the placeholder box, every other class keeps its art). */
export async function loadExtraPages(meta: PagedBattleMeta, dir: string): Promise<(Texture | null)[]> {
  const out: (Texture | null)[] = [null];
  for (const p of (meta.pages ?? []).slice(1)) {
    try {
      const tex = await Assets.load<Texture>(`${dir}/${p.file}`);
      tex.source.scaleMode = 'nearest';
      out.push(tex);
    } catch (err) {
      console.error(`Battle character page ${p.file} unavailable; its classes use placeholder sprites`, err);
      out.push(null);
    }
  }
  return out;
}

/** The class's textures in `poses` order (a missing pose takes its fallback's column); oversize frames get their
 *  recorded heads (native x scale = texture px) as known heads. */
export function slicePoses(meta: PagedBattleMeta, tex: Texture, id: string, poses: readonly string[],
  fallback: (pose: string) => string): Texture[] {
  const s = meta.sheets[id];
  return poses.map((pose) => {
    let col = meta.poses.indexOf(pose);
    if (col < 0) col = meta.poses.indexOf(fallback(pose));
    col = Math.max(0, col);
    const r = cellRect(meta, id, col);
    const t = new Texture({ source: tex.source, frame: new Rectangle(r.x, r.y, r.w, r.h) });
    const h = s.heads?.[col];
    if (s.page && s.heads) setKnownHead(t, h ? { x: h[0] * meta.scale, y: h[1] * meta.scale } : null);
    return t;
  });
}
