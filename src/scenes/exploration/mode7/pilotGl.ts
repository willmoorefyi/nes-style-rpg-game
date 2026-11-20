/**
 * M7-0 pilot only (dev): the stand-in far atlas and the pilot's GPU checks (docs/MODE7_PLAN.md 10, R2, R5).
 *
 * The stand-in: M7-1 bakes `mode7.png` offline. Until then the pilot composes the same 16 px per cell image at load,
 * drawing the 144 below chunks into a mipmapped `RenderTexture` at 1/3 scale (linear: about the bake's 3x box) one
 * chunk row at a time, freeing each row's chunks after its draw. The patches are left out, as in the bake.
 */
import { Assets, Container, Graphics, RenderTexture, Sprite, type Texture, type TextureSource, type WebGLRenderer } from 'pixi.js';
import type { BakedMapArt } from '../../../types/index.js';

export const ATLAS_CELL_PX = 16;

export interface StandInAtlas {
  texture: RenderTexture;
  size: number;
  chunks: number;
  composeMs: number;
}

/** A mipmapped, clamped atlas render texture: anisotropy first (it resets the filters to linear), then nearest mag. */
export function atlasTexture(size: number, aniso: number): RenderTexture {
  const rt = RenderTexture.create({ width: size, height: size, autoGenerateMipmaps: true });
  const style = rt.source.style;
  style.addressMode = 'clamp-to-edge';
  style.maxAnisotropy = aniso;
  style.magFilter = 'nearest';
  style.minFilter = 'linear';
  style.mipmapFilter = 'linear';
  return rt;
}

/** Fill `rt` with one colour (the mip check's known start). */
export function fillTexture(renderer: WebGLRenderer, rt: RenderTexture, color: number): void {
  const g = new Graphics().rect(0, 0, rt.width, rt.height).fill(color);
  renderer.render({ container: g, target: rt, clear: true });
  g.destroy();
}

/** Draw every below chunk of `art` into `rt` at 16 px per cell, then regenerate its mips. */
export async function composeStandIn(renderer: WebGLRenderer, rt: RenderTexture, art: BakedMapArt): Promise<StandInAtlas> {
  const t0 = performance.now();
  const chunkPx = art.tile * art.chunk;
  const destPx = ATLAS_CELL_PX * art.chunk;
  const rows = new Map<number, { url: string; c: number }[]>();
  for (const url of art.below) {
    const m = /below_(\d+)_(\d+)\.png$/.exec(url ?? '');
    if (!url || !m) continue;
    const r = Number(m[1]);
    rows.set(r, [...(rows.get(r) ?? []), { url, c: Number(m[2]) }]);
  }
  let chunks = 0;
  for (const [r, list] of [...rows].sort((x, y) => x[0] - y[0])) {
    const textures = await Promise.all(list.map((e) => Assets.load<Texture>(e.url)));
    const row = new Container();
    textures.forEach((tex, i) => {
      tex.source.scaleMode = 'linear';
      const s = new Sprite(tex);
      s.position.set(list[i].c * destPx, r * destPx);
      s.scale.set(destPx / chunkPx);
      row.addChild(s);
    });
    renderer.render({ container: row, target: rt, clear: false });
    row.destroy({ children: true });
    await Promise.all(list.map((e) => Assets.unload(e.url)));
    chunks += list.length;
  }
  rt.source.updateMipmaps();
  return { texture: rt, size: rt.width, chunks, composeMs: performance.now() - t0 };
}

/** Read mip `level` of a texture back (RGBA bytes), through a framebuffer bound to that level (WebGL2). */
export function readMip(renderer: WebGLRenderer, source: TextureSource, level: number): { w: number; h: number; px: Uint8Array } {
  const gl = renderer.gl;
  const w = Math.max(1, source.pixelWidth >> level);
  const h = Math.max(1, source.pixelHeight >> level);
  const px = new Uint8Array(w * h * 4);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, renderer.texture.getGlSource(source).texture, level);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status === gl.FRAMEBUFFER_COMPLETE) gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  else console.error(`Mode 7 pilot: mip ${level} framebuffer incomplete (0x${status.toString(16)})`);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  renderer.resetState();
  return { w, h, px };
}

/** The mean RGB of RGBA bytes. */
export function meanRgb(px: Uint8Array): [number, number, number] {
  const sum = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) { sum[0] += px[i]; sum[1] += px[i + 1]; sum[2] += px[i + 2]; }
  const n = px.length / 4;
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/** The sampler state the driver holds for a texture: filters and the anisotropy level actually set. */
export function samplerState(renderer: WebGLRenderer, source: TextureSource): { min: string; mag: string; aniso: number | null; maxAniso: number | null } {
  const gl = renderer.gl;
  const ext = gl.getExtension('EXT_texture_filter_anisotropic');
  gl.bindTexture(gl.TEXTURE_2D, renderer.texture.getGlSource(source).texture);
  const name = (v: number): string => ({
    [gl.NEAREST]: 'nearest', [gl.LINEAR]: 'linear', [gl.LINEAR_MIPMAP_LINEAR]: 'linear-mipmap-linear',
    [gl.NEAREST_MIPMAP_NEAREST]: 'nearest-mipmap-nearest', [gl.LINEAR_MIPMAP_NEAREST]: 'linear-mipmap-nearest',
    [gl.NEAREST_MIPMAP_LINEAR]: 'nearest-mipmap-linear' } as Record<number, string>)[v] ?? String(v);
  const out = {
    min: name(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER)),
    mag: name(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER)),
    aniso: ext ? Number(gl.getTexParameter(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT)) : null,
    maxAniso: ext ? Number(gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : null,
  };
  gl.bindTexture(gl.TEXTURE_2D, null);
  renderer.resetState();
  return out;
}

/** One screen row of the default framebuffer (top-down row index), read right after a render. */
export function readScreenRow(renderer: WebGLRenderer, y: number): Uint8Array {
  const gl = renderer.gl;
  const w = gl.drawingBufferWidth;
  const px = new Uint8Array(w * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, gl.drawingBufferHeight - 1 - y, w, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  renderer.resetState();
  return px;
}

/** Mean absolute RGB difference of row `b` against row `a` shifted left by `shift` px, over x in [x0, x1). */
export function rowDiff(a: Uint8Array, b: Uint8Array, shift: number, x0: number, x1: number): number {
  let sum = 0;
  for (let x = x0; x < x1; x++) for (let k = 0; k < 3; k++) sum += Math.abs(b[x * 4 + k] - a[(x + shift) * 4 + k]);
  return sum / ((x1 - x0) * 3);
}

/** The GL version and the unmasked renderer string (WEBGL_debug_renderer_info). */
export function glInfo(renderer: WebGLRenderer): { version: string; renderer: string; maxTexture: number } {
  const gl = renderer.gl;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    version: String(gl.getParameter(gl.VERSION)),
    renderer: String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    maxTexture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
  };
}
