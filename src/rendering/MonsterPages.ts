import type { Texture } from 'pixi.js';

/** One page of the monster atlas (`monsters-ai.json` `pages`, docs/ROSTER_PLAN.md 8): a PNG next to the JSON. */
export interface MonsterAtlasPage { file: string; w: number; h: number }

/** How a page texture is fetched and freed (pixi `Assets` in the game; tests inject fakes). */
export interface PageIo {
  load(url: string): Promise<Texture>;
  unload(url: string): void;
}

/** Unreferenced pages kept loaded (the bestiary keeps the current and the neighbour's page). */
export const PAGE_CACHE = 2;

/**
 * The paged monster atlas at runtime (FW-8): which page each sprite lives on, loading pages on demand and freeing
 * them again.
 * - `ensure(sprites)` loads the pages those sprites need (deduplicated; a load in flight is shared). It never
 *   rejects: a page that fails logs one warning and its sprites stay not ready (placeholder boxes).
 * - `hold(sprite)` refcounts the sprite's page for as long as Textures cut from it are in use (a battle's enemy view,
 *   the bestiary's cached frames); it returns the release.
 * - The LRU keeps at most `capacity` loaded pages with no holds; it never frees a held page or a page the latest
 *   `ensure` asked for (so a battle's pages survive until its view holds them).
 * - `pin(pages)` (docs/KNEEL_PLAN.md D-K13: the act-1 pages): pinned pages are never freed and not counted by the LRU.
 */
export class MonsterPages {
  private pages: MonsterAtlasPage[] = [];
  private pageOfSprite: (sprite: string) => number | undefined = () => undefined;
  private readonly loaded = new Map<number, Texture>();
  private readonly inFlight = new Map<number, Promise<void>>();
  private readonly failed = new Set<number>();
  private readonly refs = new Map<number, number>();
  private readonly lastUse = new Map<number, number>();
  private recent = new Set<number>();
  private readonly pinned = new Set<number>();
  private clock = 0;

  constructor(private readonly dir: string, private readonly io: PageIo, private readonly capacity = PAGE_CACHE) {}

  /** Install the atlas index (frees nothing: call once, after the JSON loads). */
  setIndex(pages: MonsterAtlasPage[], pageOf: (sprite: string) => number | undefined): void {
    this.pages = pages;
    this.pageOfSprite = pageOf;
  }

  get pageCount(): number { return this.pages.length; }

  /** Keep these pages loaded for the session: never evicted, outside the `capacity` count (unknown pages are ignored). */
  pin(pages: readonly number[]): void {
    for (const p of pages) if (Number.isInteger(p) && p >= 0 && p < this.pages.length) this.pinned.add(p);
  }

  isPinned(page: number): boolean { return this.pinned.has(page); }

  /** The page a sprite lives on, or undefined when the index lacks it. */
  pageOf(sprite: string): number | undefined {
    const p = this.pageOfSprite(sprite);
    return p !== undefined && p >= 0 && p < this.pages.length ? p : undefined;
  }

  url(page: number): string { return `${this.dir}${this.pages[page].file}`; }

  isReady(sprite: string): boolean {
    const p = this.pageOf(sprite);
    return p !== undefined && this.loaded.has(p);
  }

  /** The last load of the sprite's page failed (a later `ensure` retries it). */
  hasFailed(sprite: string): boolean {
    const p = this.pageOf(sprite);
    return p !== undefined && this.failed.has(p);
  }

  /** The loaded page texture, or null. */
  texture(page: number): Texture | null { return this.loaded.get(page) ?? null; }

  /** Pages loaded now, ascending (tests and the dev console). */
  loadedPages(): number[] { return [...this.loaded.keys()].sort((a, b) => a - b); }

  refCount(page: number): number { return this.refs.get(page) ?? 0; }

  /** A page load is in flight. */
  get busy(): boolean { return this.inFlight.size > 0; }

  /** Resolves once no page load is in flight (loads started meanwhile included). */
  async settled(): Promise<void> {
    while (this.inFlight.size) await Promise.all([...this.inFlight.values()]);
  }

  /** Load the pages of `sprites` (unknown sprites are skipped), then trim the LRU. Never rejects. */
  ensure(sprites: string[]): Promise<void> {
    const pages = [...new Set(sprites.map((s) => this.pageOf(s)).filter((p): p is number => p !== undefined))];
    return this.ensurePages(pages);
  }

  async ensurePages(pages: number[]): Promise<void> {
    const want = [...new Set(pages)].filter((p) => p >= 0 && p < this.pages.length);
    this.recent = new Set(want);
    for (const p of want) this.touch(p);
    await Promise.all(want.map((p) => this.loadPage(p)));
    this.trim();
  }

  /** Refcount the sprite's page while its Textures are in use; the returned release is idempotent. */
  hold(sprite: string): () => void {
    const p = this.pageOf(sprite);
    if (p === undefined) return () => {};
    this.refs.set(p, this.refCount(p) + 1);
    this.touch(p);
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      const n = this.refCount(p) - 1;
      if (n > 0) this.refs.set(p, n); else this.refs.delete(p);
      this.trim();
    };
  }

  private touch(p: number): void { this.lastUse.set(p, ++this.clock); }

  private loadPage(p: number): Promise<void> {
    if (this.loaded.has(p)) return Promise.resolve();
    let job = this.inFlight.get(p);
    if (!job) {
      const url = this.url(p);
      job = this.io.load(url).then((tex) => {
        tex.source.scaleMode = 'nearest';
        this.loaded.set(p, tex);
        this.failed.delete(p);
      }, (err: unknown) => {
        this.failed.add(p);
        console.warn(`Monster art: atlas page ${p} (${url}) failed to load; its sprites use placeholder boxes`, err);
      }).finally(() => { this.inFlight.delete(p); });
      this.inFlight.set(p, job);
    }
    return job;
  }

  /** Free the least recently used unheld, unpinned pages beyond `capacity` (never a held or pinned page or one `ensure`
   *  just asked for). */
  private trim(): void {
    const free = [...this.loaded.keys()].filter((p) => !this.refCount(p) && !this.pinned.has(p));
    let extra = free.length - this.capacity;
    const victims = free.filter((p) => !this.recent.has(p)).sort((a, b) => (this.lastUse.get(a) ?? 0) - (this.lastUse.get(b) ?? 0));
    for (const p of victims) {
      if (extra <= 0) break;
      this.loaded.delete(p);
      this.io.unload(this.url(p));
      extra--;
    }
  }
}
