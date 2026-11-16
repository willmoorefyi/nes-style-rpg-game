/**
 * Colossus art (docs/CHAOS_FORMS_PLAN.md 4.6; rev 4: 18.1, 18.6): the index `assets/sprites/colossus.json` and the
 * layer tiles of each form, outside the monster atlas. The painted forms are shown at scale 1 (the glow at its
 * texScale 2), so every texture is linear-filtered with no mipmaps; the F1 atlas and every atlas monster stay nearest
 * (CharacterAtlas, MonsterPages). Every texture is counted, so a battle end or a bestiary exit can destroy all of them
 * (`release`) and a test can check the count. A form without an index entry (no approved master yet) is reported once
 * and the battle draws its placeholder box. The hurt flash reuses each tile's own texture (ColossusView), so no extra
 * texture is made.
 */
import { Assets, Texture } from 'pixi.js';
import { fetchJson } from './CharacterAtlas.js';
import { filesOf, readColossusIndex, tilesOf, type ColossusFormSpec, type ColossusIndex } from '../scenes/battle/colossus/colossusIndex.js';
import { entryIdFor, previewFileOf } from '../scenes/battle/colossus/colossusEntries.js';
import type { EnemyData } from '../types/index.js';

export const COLOSSUS_DIR = 'assets/sprites/';
/** The bestiary still's size bound (18.8: fit into 940 x 720); tests' blank textures take it. */
export const PREVIEW_SIZE: readonly [number, number] = [940, 720];
/** Dev only: `?colossus=fixture` reads the synthetic test fixture instead (the C1 browser check). */
export const FIXTURE_DIR = 'tests/fixtures/colossus/';

/** Where the index and tiles come from (tests: blank textures of the tiles' sizes). */
export interface ColossusIo {
  fetchIndex(): Promise<unknown>;
  load(file: string, w: number, h: number): Promise<Texture>;
  unload(file: string, texture: Texture): void;
}

/** RGBA bytes of every tile in the index (the 24 MB criterion). */
export function textureBytes(index: ColossusIndex): number {
  let n = 0;
  for (const f of Object.values(index.forms)) for (const l of f.layers) for (const fr of Object.values(l.frames)) {
    for (const t of fr.tiles) n += t.w * t.h * 4;
  }
  return n;
}

function browserIo(dir: string): ColossusIo {
  return {
    fetchIndex: () => fetchJson<unknown>(`${dir}colossus.json`),
    load: (file) => Assets.load<Texture>(`${dir}${file}`),
    unload: (file) => { Assets.unload(`${dir}${file}`).catch((err: unknown) => console.warn(`Colossus art: could not unload ${file}`, err)); },
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
  private readonly loading = new Map<string, Promise<void>>();
  private readonly ready = new Set<string>();
  private readonly warned = new Set<string>();
  /** The loaded bestiary stills (files in `textures`). */
  private readonly stills = new Set<string>();
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

  /** Textures alive now (the tiles). */
  get liveTextures(): number { return this.textures.size; }

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

  /** The entry a record draws (its own, F4 at its rest, else its art's; colossusEntries.ts); before the index loads, its
   *  art's id. Null: no colossus. */
  entryFor(data: EnemyData): string | null { return entryIdFor(this.idx, data); }

  /** Load the index, then the tiles of the entry `data` draws. */
  async ensureFor(data: EnemyData): Promise<void> {
    await this.loadIndex();
    const id = this.entryFor(data);
    if (id) await this.ensure([id]);
  }

  /** The form's bestiary still (18.8), loaded (linear, kept until `releasePreview` or `release`); null: none or failed. */
  async preview(id: string): Promise<Texture | null> {
    await this.loadIndex();
    const f = this.idx?.forms[id];
    const file = f ? previewFileOf(id, f) : null;
    if (!file) return null;
    const have = this.textures.get(file);
    if (have) return have;
    try {
      const tex = await this.io.load(file, PREVIEW_SIZE[0], PREVIEW_SIZE[1]);
      tex.source.scaleMode = 'linear';
      this.textures.set(file, tex);
      this.stills.add(file);
      return tex;
    } catch (err: unknown) {
      console.warn(`Colossus art: the bestiary still of "${id}" (${file}) failed to load; the live view instead`, err);
      return null;
    }
  }

  /** Destroy every loaded bestiary still. */
  releasePreview(): void {
    for (const file of this.stills) {
      const tex = this.textures.get(file);
      this.textures.delete(file);
      if (tex) this.io.unload(file, tex);
    }
    this.stills.clear();
  }

  /** Its tiles are loaded (the view can draw it now). */
  isReady(id: string): boolean { return this.ready.has(id); }

  texture(file: string): Texture | null { return this.textures.get(file) ?? null; }

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
        tex.source.scaleMode = 'linear';
        tex.source.autoGenerateMipmaps = false;
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
    if (!ids) this.releasePreview();
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
        this.textures.delete(file);
        this.io.unload(file, tex);
      }
    }
  }
}

export const colossusArt = new ColossusArt();
