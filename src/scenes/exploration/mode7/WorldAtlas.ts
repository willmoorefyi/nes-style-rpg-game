import { Assets, Container, RenderTexture, Sprite, type Renderer, type Texture, type TextureSourceOptions } from 'pixi.js';
import type { MapData } from '../../../types/index.js';

/** The Mode 7 far atlas (docs/MODE7_PLAN.md 3.1, tranche M7-1). The build bakes `mode7.png` (16 px per cell) and
 *  `mode7_low.png` (8 px per cell) next to the world's chunks (assets-src/tools/mode7_atlas.py, run by every world
 *  compile). `WorldAtlas` loads the profile's image into a render texture, draws each patch overlay over its cells
 *  while the patch's flag is set (scaled from the chunks' 48 px to the atlas's cell size), builds the mips, and frees
 *  the source image at once. A flag change redraws; a context restore reloads the image and recomposes. */

export type AtlasProfile = 'full' | 'low';

/** `mode7.json`, written by mode7_atlas.py. */
export interface AtlasMeta {
  version: number;
  cellPx: number;
  size: number;
  lowCellPx: number;
  lowSize: number;
  /** sha256 over the chunk files the atlas was baked from. */
  inputs: string;
}

export const ATLAS_VERSION = 1;
/** Anisotropy where the extension exists (D-M10); the GPU clamps it to what it supports. */
export const ATLAS_ANISOTROPY = 4;

/** Where the atlas files of a compiled map live: the folder of its chunks. Null for a map without baked art. */
export function atlasUrls(map: Pick<MapData, 'art'>): { meta: string; full: string; low: string } | null {
  const first = map.art?.below?.[0];
  if (!first) return null;
  const dir = first.slice(0, first.lastIndexOf('/') + 1);
  return { meta: `${dir}mode7.json`, full: `${dir}mode7.png`, low: `${dir}mode7_low.png` };
}

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** WR (docs/WORLD_WRAP_PLAN.md 7.1): one rule for mips. WebGL2 mips any size; WebGL1 only a power of two (a mip filter
 *  on an NPOT texture samples black there). */
export function atlasMips(size: number, webgl2: boolean): boolean {
  return webgl2 || isPowerOfTwo(size);
}

/** The meta's size and cell size for a profile, after checking it fits the map; throws on a mismatch, and (WR) on a
 *  wrapped map whose atlas cannot repeat under WebGL1 (NPOT), so the load rejects into the view's `failed` path. */
export function atlasSize(meta: AtlasMeta, map: Pick<MapData, 'width' | 'height' | 'wrap'>, profile: AtlasProfile,
  webgl2 = true): { size: number; cellPx: number } {
  if (meta.version !== ATLAS_VERSION) throw new Error(`mode7.json: version ${meta.version}, expected ${ATLAS_VERSION}`);
  const size = profile === 'full' ? meta.size : meta.lowSize;
  const cellPx = profile === 'full' ? meta.cellPx : meta.lowCellPx;
  if (map.width !== map.height || size !== map.width * cellPx) {
    throw new Error(`mode7.json: ${profile} atlas ${size} px at ${cellPx} px per cell does not fit a ${map.width}x${map.height} map`);
  }
  if (map.wrap && !webgl2 && !isPowerOfTwo(size)) {
    throw new Error(`mode7.json: a wrapped map needs a power-of-two atlas under WebGL1 (${size})`);
  }
  return { size, cellPx };
}

/** The render texture's options. Magnification is nearest (pixel art), minification linear; a flat map clamps to the
 *  sea at the edges, a wrapped one repeats (WR). Mips (linear, with anisotropy) when `atlasMips`: with WebGL2, or a
 *  power of two under WebGL1; otherwise none (3.1). */
export function atlasTextureOptions(size: number, webgl2: boolean, wrap = false): TextureSourceOptions {
  const base: TextureSourceOptions = { width: size, height: size, resolution: 1,
    addressMode: wrap ? 'repeat' : 'clamp-to-edge', magFilter: 'nearest', minFilter: 'linear' };
  return atlasMips(size, webgl2) ? { ...base, autoGenerateMipmaps: true, mipmapFilter: 'linear', maxAnisotropy: ATLAS_ANISOTROPY }
    : { ...base, autoGenerateMipmaps: false };
}

export interface PatchPlacement { id: string; flag: string; x: number; y: number; scale: number }

/** Where each patch overlay is drawn on the atlas: its cells' bounding box from the top-left cell, as
 *  `build_hooks.bake_patches` cuts it, scaled from the chunks' `art.tile` px to `cellPx`. */
export function patchPlacements(map: Pick<MapData, 'patches' | 'art'>, cellPx: number): PatchPlacement[] {
  const tile = map.art?.tile ?? 48;
  return (map.patches ?? []).filter((p) => p.cells.length > 0 && map.art?.patches?.[p.id]).map((p) => ({
    id: p.id, flag: p.flag, scale: cellPx / tile,
    x: Math.min(...p.cells.map((c) => c[0])) * cellPx, y: Math.min(...p.cells.map((c) => c[1])) * cellPx,
  }));
}

/** The set patch ids, in map order: the atlas recomposes when this changes. */
export function patchSignature(placements: PatchPlacement[], hasFlag: (flag: string) => boolean): string {
  return placements.filter((p) => hasFlag(p.flag)).map((p) => p.id).join(',');
}

/** Asset access, injectable for tests. */
export interface AtlasLoader {
  meta(url: string): Promise<AtlasMeta>;
  texture(url: string): Promise<Texture>;
  unload(url: string): Promise<void>;
}

export const assetAtlasLoader: AtlasLoader = {
  meta: (url) => Assets.load<AtlasMeta>(url),
  texture: (url) => Assets.load<Texture>(url),
  unload: (url) => Assets.unload(url),
};

export interface WorldAtlasOptions {
  map: MapData;
  profile: AtlasProfile;
  /** WebGL2 (NPOT mips); false gives linear minification with no mips. */
  webgl2: boolean;
  renderer: Renderer;
  hasFlag: (flag: string) => boolean;
  loader?: AtlasLoader;
}

export class WorldAtlas {
  private rt: RenderTexture | null = null;
  private placements: PatchPlacement[] = [];
  private patchTex: Record<string, Texture> = {};
  private signature = '';
  private composing: Promise<void> | null = null;
  private destroyed = false;
  private readonly loader: AtlasLoader;

  constructor(private readonly opts: WorldAtlasOptions) {
    this.loader = opts.loader ?? assetAtlasLoader;
  }

  /** The composed atlas (null until `load` resolves). One texel per `cellPx` of a cell. */
  get texture(): RenderTexture | null { return this.rt; }
  /** Px per cell of the loaded profile (0 until loaded). */
  cellPx = 0;
  /** A loaded patch overlay (at the chunks' `art.tile` px per cell), shared with the near detail. */
  patchTexture(id: string): Texture | null { return this.patchTex[id] ?? null; }

  /** Load the meta, the patch overlays and the image; compose; free the image. Rejects on a missing or stale atlas. */
  async load(): Promise<void> {
    const urls = atlasUrls(this.opts.map);
    if (!urls) throw new Error(`map ${this.opts.map.id} has no baked art for a Mode 7 atlas`);
    const { size, cellPx } = atlasSize(await this.loader.meta(urls.meta), this.opts.map, this.opts.profile,
      this.opts.webgl2);
    this.cellPx = cellPx;
    this.placements = patchPlacements(this.opts.map, cellPx);
    const art = this.opts.map.art?.patches ?? {};
    await Promise.all(this.placements.map((p) => this.loader.texture(art[p.id]).then((t) => { this.patchTex[p.id] = t; },
      (err: unknown) => console.error(`Mode 7: could not load the patch overlay ${art[p.id]}`, err))));
    if (this.destroyed) return;
    this.rt = RenderTexture.create(atlasTextureOptions(size, this.opts.webgl2, this.opts.map.wrap === true));
    this.rt.source.style.magFilter = 'nearest';   // Pixi's maxAnisotropy > 1 sets every filter linear: keep nearest up
    await this.compose();
  }

  /** Recompose when a patch flag changed (call once per frame; cheap when nothing changed). */
  update(): void {
    if (!this.rt || this.composing) return;
    if (patchSignature(this.placements, this.opts.hasFlag) !== this.signature) {
      this.recompose().catch((err: unknown) => console.error('Mode 7: the atlas recompose failed', err));
    }
  }

  /** After a context restore the render texture's contents are lost: reload the image and draw it again (joining a
   *  recompose under way). Rejects when that fails (M7-6: the view then flies top-down). */
  restore(): Promise<void> {
    return this.recompose();
  }

  destroy(): void {
    this.destroyed = true;
    this.rt?.destroy(true);
    this.rt = null;
  }

  /** One compose at a time; it rejects on a failure (each caller handles it). */
  private recompose(): Promise<void> {
    this.composing ??= this.compose().finally(() => { this.composing = null; });
    return this.composing;
  }

  /** Draw the atlas image, then every set patch, into the render texture; build the mips; free the image. */
  private async compose(): Promise<void> {
    const urls = atlasUrls(this.opts.map);
    if (!urls || !this.rt) return;
    const url = this.opts.profile === 'full' ? urls.full : urls.low;
    const image = await this.loader.texture(url);
    try {
      if (this.destroyed || !this.rt) return;
      const stage = new Container();
      stage.addChild(new Sprite(image));
      for (const p of this.placements) {
        const tex = this.patchTex[p.id];
        if (!tex || !this.opts.hasFlag(p.flag)) continue;
        const s = new Sprite(tex);
        s.position.set(p.x, p.y);
        s.scale.set(p.scale);
        stage.addChild(s);
      }
      this.opts.renderer.render({ container: stage, target: this.rt, clear: true });
      if (atlasMips(this.rt.width, this.opts.webgl2)) this.rt.source.updateMipmaps();
      stage.destroy({ children: true });
      this.signature = patchSignature(this.placements, this.opts.hasFlag);
    } finally {
      await this.loader.unload(url);     // the 37.7 MB source is freed right after the compose (3.1)
    }
  }
}
