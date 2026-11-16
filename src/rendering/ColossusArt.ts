/**
 * Colossus art (docs/CHAOS_FORMS_PLAN.md 4.6): the index `assets/sprites/colossus.json` and the layer tiles of each
 * form, outside the monster atlas. Every texture is nearest-scaled (art px scaled on the GPU, R27) and counted, so a
 * battle end or a bestiary exit can destroy all of them (`release`) and a test can check the count. A form without an
 * index entry (no approved master yet) is reported once and the battle draws its placeholder box.
 *
 * Hurt flashes swap each tile to a white silhouette of itself, made once per tile on first use (a canvas in the
 * browser), never a render of the composite (R15).
 */
import { Assets, Texture } from 'pixi.js';
import { fetchJson } from './CharacterAtlas.js';
import { filesOf, readColossusIndex, tilesOf, type ColossusFormSpec, type ColossusIndex } from '../scenes/battle/colossus/colossusIndex.js';

export const COLOSSUS_DIR = 'assets/sprites/';
/** Dev only: `?colossus=fixture` reads the synthetic test fixture instead (the C1 browser check). */
export const FIXTURE_DIR = 'tests/fixtures/colossus/';

/** Where the index and tiles come from (tests: blank textures of the tiles' sizes). */
export interface ColossusIo {
  fetchIndex(): Promise<unknown>;
  load(file: string, w: number, h: number): Promise<Texture>;
  unload(file: string, texture: Texture): void;
  /** A white silhouette of `texture` (same size, alpha kept). */
  white(texture: Texture): Texture;
}

/** RGBA bytes of every tile in the index (the 24 MB criterion). */
export function textureBytes(index: ColossusIndex): number {
  let n = 0;
  for (const f of Object.values(index.forms)) for (const l of f.layers) for (const fr of Object.values(l.frames)) {
    for (const t of fr.tiles) n += t.w * t.h * 4;
  }
  return n;
}

function whiteSilhouette(t: Texture): Texture {
  const res = t.source.resource as CanvasImageSource | undefined;
  const canvas = document.createElement('canvas');
  canvas.width = t.width;
  canvas.height = t.height;
  const ctx = canvas.getContext('2d');
  if (ctx && res) {
    ctx.drawImage(res, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, t.width, t.height);
  } else {
    console.warn('Colossus art: no image data for a white flash; the flash shows a white box');
    ctx?.fillRect(0, 0, t.width, t.height);
  }
  return Texture.from(canvas);
}

function browserIo(dir: string): ColossusIo {
  return {
    fetchIndex: () => fetchJson<unknown>(`${dir}colossus.json`),
    load: (file) => Assets.load<Texture>(`${dir}${file}`),
    unload: (file) => { Assets.unload(`${dir}${file}`).catch((err: unknown) => console.warn(`Colossus art: could not unload ${file}`, err)); },
    white: whiteSilhouette,
  };
}

function defaultDir(): string {
  if (!import.meta.env.DEV || typeof location === 'undefined') return COLOSSUS_DIR;
  return new URLSearchParams(location.search).get('colossus') === 'fixture' ? FIXTURE_DIR : COLOSSUS_DIR;
}

export class ColossusArt {
  private io: ColossusIo;
  private idx: ColossusIndex | null = null;
  private indexLoad: Promise<void> | null = null;
  private readonly textures = new Map<string, Texture>();
  private readonly whites = new Map<Texture, Texture>();
  private readonly loading = new Map<string, Promise<void>>();
  private readonly ready = new Set<string>();
  private readonly warned = new Set<string>();
  /** Bumped on each load and release of a form: a load that finishes after a release is dropped at once. */
  private readonly gens = new Map<string, number>();

  constructor(io?: ColossusIo) {
    this.io = io ?? browserIo(defaultDir());
  }

  /** Use another io (tests); returns the restore. Drops everything loaded. */
  setIo(io: ColossusIo): () => void {
    const old = this.io;
    this.release();
    this.io = io;
    this.idx = null;
    this.indexLoad = null;
    return () => { this.release(); this.io = old; this.idx = null; this.indexLoad = null; };
  }

  /** Textures alive now (tiles and white silhouettes). */
  get liveTextures(): number { return this.textures.size + this.whites.size; }

  /** The forms whose tiles are loaded. */
  loadedForms(): string[] { return [...this.ready]; }

  /** The form's index entry, or null (warned once) when the index has none. */
  form(id: string): ColossusFormSpec | null {
    const f = this.idx?.forms[id] ?? null;
    if (!f && this.idx && !this.warned.has(id)) {
      this.warned.add(id);
      console.warn(`Colossus art: no entry for "${id}" in colossus.json; using a placeholder box`);
    }
    return f;
  }

  /** Its tiles are loaded (the view can draw it now). */
  isReady(id: string): boolean { return this.ready.has(id); }

  texture(file: string): Texture | null { return this.textures.get(file) ?? null; }

  /** The tile's white silhouette (made on first use, counted, destroyed with it). */
  whiteOf(t: Texture): Texture {
    let w = this.whites.get(t);
    if (!w) {
      w = this.io.white(t);
      w.source.scaleMode = 'nearest';
      this.whites.set(t, w);
    }
    return w;
  }

  private loadIndex(): Promise<void> {
    this.indexLoad ??= this.io.fetchIndex().then((raw) => { this.idx = readColossusIndex(raw); }).catch((err: unknown) => {
      console.warn('Colossus art: colossus.json unavailable (no approved colossus masters yet); placeholders', err);
      this.idx = { forms: {} };
    });
    return this.indexLoad;
  }

  /** Load the index and every tile of `ids` (never rejects; an unknown form stays a placeholder). */
  async ensure(ids: string[]): Promise<void> {
    await this.loadIndex();
    await Promise.all(ids.map((id) => this.loadForm(id)));
  }

  private loadForm(id: string): Promise<void> {
    const f = this.form(id);
    if (!f || this.ready.has(id)) return Promise.resolve();
    let p = this.loading.get(id);
    if (!p) {
      const gen = (this.gens.get(id) ?? 0) + 1;
      this.gens.set(id, gen);
      p = Promise.all(tilesOf(f).map(async (t) => {
        const file = t.file;
        if (this.textures.has(file)) return;
        const tex = await this.io.load(file, t.w, t.h);
        if (this.gens.get(id) !== gen) { this.io.unload(file, tex); return; }
        tex.source.scaleMode = 'nearest';
        this.textures.set(file, tex);
      })).then(() => { if (this.loading.has(id)) this.ready.add(id); })
        .catch((err: unknown) => console.warn(`Colossus art: tiles of "${id}" failed to load; placeholder`, err))
        .finally(() => this.loading.delete(id));
      this.loading.set(id, p);
    }
    return p;
  }

  /** Destroy the textures of `ids` (every form when omitted): the battle's end, the bestiary's entry change and exit. */
  release(ids?: string[]): void {
    const forms = ids ?? [...new Set([...this.ready, ...this.loading.keys()])];
    const keep = new Set([...this.ready].filter((id) => !forms.includes(id)).flatMap((id) => (this.idx?.forms[id] ? filesOf(this.idx.forms[id]) : [])));
    for (const id of forms) {
      this.gens.set(id, (this.gens.get(id) ?? 0) + 1);
      this.ready.delete(id);
      this.loading.delete(id);
      const f = this.idx?.forms[id];
      for (const file of f ? filesOf(f) : []) {
        const tex = this.textures.get(file);
        if (!tex || keep.has(file)) continue;
        this.whites.get(tex)?.destroy(true);
        this.whites.delete(tex);
        this.textures.delete(file);
        this.io.unload(file, tex);
      }
    }
  }
}

export const colossusArt = new ColossusArt();
