import { Sprite, Texture, type Container } from 'pixi.js';
import type { BakedMapArt, MapData } from '../types/index.js';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from './Camera.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
import { chunkRect, ChunkStreamer, dominantColour, flightWindow, MISS_HOLD_FRAMES, rectChunks, STREAM_TEXTURE_CAP,
  viewSpan, type ChunkRect, type ChunkSource } from './chunkStreaming.js';
import { wrapDelta } from '../systems/worldWrap.js';

interface Slot {
  below: Sprite | null;
  above: Sprite | null;
  placeholder: Sprite | null;
  missAt: number | null;    // the frame a needed texture was first found missing
  logged: boolean;
}

/** Makes the sprite of chunk `i` in `parent`, placed and scaled. */
export type ChunkSpriteFactory = (tex: Texture, i: number, parent: Container) => Sprite;

/**
 * The chunks of a streamed map (QUEST 4.3): the view's chunks plus a 1-chunk ring plus 1 chunk ahead per axis of
 * travel stay loaded (at most 6x5 chunks, both layers: `STREAM_TEXTURE_CAP`); the rest are freed least recently used.
 * A chunk in view that is still missing after `MISS_HOLD_FRAMES` frames shows as a flat placeholder in its dominant
 * terrain's colour (logged once) until its texture arrives.
 */
export class StreamedChunks {
  private readonly streamer: ChunkStreamer;
  private readonly slots: Slot[] = [];
  private readonly urlSlot = new Map<string, { i: number; layer: 'below' | 'above' }>();
  private readonly cols: number;
  private readonly rows: number;
  private window = new Set<number>();
  private visible: ChunkRect | null = null;
  private frame = 0;
  private last: { x: number; y: number } | null = null;
  private readonly dir = { x: 0, y: 0 };
  private waiters: (() => void)[] = [];
  /** The Mode 7 flight window (docs/MODE7_PLAN.md 3.3), its size in chunks, and the late-chunk listeners. */
  private override: ChunkRect | null = null;
  private flightN = 0;
  private readonly listeners = new Set<(i: number) => void>();
  /** WR: the map wraps; the image (unwrapped column and row) each wanted chunk draws at this frame. */
  private readonly wrap: boolean;
  private readonly image = new Map<number, { col: number; row: number }>();

  constructor(private readonly map: MapData, private readonly art: BakedMapArt, source: ChunkSource,
    private readonly below: Container, private readonly above: Container, private readonly sprite: ChunkSpriteFactory) {
    this.cols = Math.ceil(map.width / art.chunk);
    this.rows = Math.ceil(map.height / art.chunk);
    this.wrap = map.wrap === true;
    this.streamer = new ChunkStreamer(source, STREAM_TEXTURE_CAP, (url) => this.evicted(url), (url) => this.arrived(url));
    art.below.forEach((url, i) => {
      this.slots.push({ below: null, above: null, placeholder: null, missAt: null, logged: false });
      this.urlSlot.set(url, { i, layer: 'below' });
      const up = art.above[i];
      if (up) this.urlSlot.set(up, { i, layer: 'above' });
    });
  }

  /** Resident chunk textures (loaded or loading), both layers. */
  get count(): number { return this.streamer.count; }

  /** In flight, `rect` (an n x n `flightWindow`) replaces the view's window and `cap` the texture cap (trimmed at once);
   *  `setWindow(null, STREAM_TEXTURE_CAP)` restores today's. */
  setWindow(rect: ChunkRect | null, cap: number): void {
    this.override = rect;
    this.flightN = rect ? rect.c1 - rect.c0 + 1 : 0;
    this.streamer.setCap(cap);
  }

  /** `cb(i)` runs each time chunk i finishes loading (all its layers); returns the unsubscribe. */
  onChunkLoaded(cb: (i: number) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** Chunk i's loaded textures (below, then above when it has one), or null while any is missing. */
  textureOf(i: number): Texture[] | null {
    if (!this.loaded(i)) return null;
    const below = this.streamer.texture(this.art.below[i]);
    const up = this.art.above[i];
    const above = up ? this.streamer.texture(up) : null;
    return below ? (above ? [below, above] : [below]) : null;
  }

  /** One frame: `vis` is the chunks in view, (`camX`, `camY`) the camera, whose motion gives the direction of travel. */
  update(vis: ChunkRect, camX: number, camY: number): void {
    this.frame++;
    const px = this.art.chunk * TILE_SIZE;
    if (this.last) { // WR: the camera's period jump at a seam step does not flip the look-ahead
      const dx = wrapDelta(this.last.x, camX, this.wrap ? this.cols * px : 0);
      const dy = wrapDelta(this.last.y, camY, this.wrap ? this.rows * px : 0);
      if (dx !== 0) this.dir.x = Math.sign(dx);
      if (dy !== 0) this.dir.y = Math.sign(dy);
    }
    this.last = { x: camX, y: camY };
    const src = this.override ?? vis;   // in flight: the window, plus 1 chunk ahead (no ring)
    const ring = this.override ? 0 : 1;
    const lo = (v: number): number => (this.wrap ? v : Math.max(0, v));
    const win: ChunkRect = {
      c0: lo(src.c0 - ring - (this.dir.x < 0 ? 1 : 0)), r0: lo(src.r0 - ring - (this.dir.y < 0 ? 1 : 0)),
      c1: this.wrap ? src.c1 + ring + (this.dir.x > 0 ? 1 : 0) : Math.min(this.cols - 1, src.c1 + ring + (this.dir.x > 0 ? 1 : 0)),
      r1: this.wrap ? src.r1 + ring + (this.dir.y > 0 ? 1 : 0) : Math.min(this.rows - 1, src.r1 + ring + (this.dir.y > 0 ? 1 : 0)),
    };
    const seen = rectChunks(vis, this.cols, this.rows);
    const shown = new Set(seen.map((c) => c.i));
    const isVisible = (i: number): boolean => shown.has(i);
    this.image.clear();
    for (const c of [...rectChunks(win, this.cols, this.rows), ...seen]) this.image.set(c.i, c);   // vis's image wins
    const order = [...this.image.keys()];
    order.sort((a, b) => Number(isVisible(b)) - Number(isVisible(a)));   // the visible chunks load first
    this.window = new Set(order);
    this.visible = vis;
    const urls: string[] = order.map((i) => this.art.below[i]);
    for (const i of order) { const up = this.art.above[i]; if (up) urls.push(up); }
    this.streamer.want(urls, this.frame);
    this.slots.forEach((slot, i) => this.updateSlot(slot, i, isVisible(i)));
    if (this.wrap) for (const [i, at] of this.image) this.placeSlot(this.slots[i], at.col * px, at.row * px);
    this.checkReady();
  }

  /** A step onto (x, y) waits while a window chunk the view there needs is missing, for at most MISS_HOLD_FRAMES. In
   *  flight the view there is the window recentring would choose for (x, y) (D-M11). */
  stepHeld(x: number, y: number): boolean {
    if (!this.visible) return false;
    const r = this.override ? flightWindow(x, y, this.flightN, this.art.chunk, this.cols, this.rows, this.wrap)
      : this.viewAt(x, y);
    let held = false;
    for (const { i } of rectChunks(r, this.cols, this.rows)) {
      if (!this.window.has(i) || this.loaded(i)) continue;   // chunks outside the window never hold a step
      const slot = this.slots[i];
      slot.missAt ??= this.frame;
      if (this.frame - slot.missAt < MISS_HOLD_FRAMES) held = true;
    }
    return held;
  }

  private viewAt(x: number, y: number): ChunkRect {
    const [x0, x1] = viewSpan(x, VIEWPORT_WIDTH / TILE_SIZE, this.map.width, this.wrap);
    const [y0, y1] = viewSpan(y, VIEWPORT_HEIGHT / TILE_SIZE, this.map.height, this.wrap);
    return chunkRect(x0, y0, x1, y1, this.art.chunk, this.cols, this.rows, this.wrap);
  }

  /** Resolves once every chunk in view is loaded. */
  ready(): Promise<void> {
    return new Promise((resolve) => { this.waiters.push(resolve); this.checkReady(); });
  }

  /** Free every chunk texture (the map was left). */
  dispose(): void {
    this.streamer.dispose();
  }

  private updateSlot(slot: Slot, i: number, visible: boolean): void {
    const below = this.streamer.texture(this.art.below[i]);
    if (below && !slot.below) slot.below = this.sprite(below, i, this.below);
    const upUrl = this.art.above[i];
    const above = upUrl ? this.streamer.texture(upUrl) : null;
    if (above && !slot.above) slot.above = this.sprite(above, i, this.above);
    if (slot.below) slot.below.visible = visible;
    if (slot.above) slot.above.visible = visible;
    if (this.loaded(i)) {
      slot.missAt = null;
      slot.logged = false;
    } else if (visible) {
      slot.missAt ??= this.frame;
      if (this.frame - slot.missAt >= MISS_HOLD_FRAMES && !slot.logged) {
        slot.logged = true;
        console.warn(`Map ${this.map.id}: chunk ${Math.floor(i / this.cols)}_${i % this.cols} not loaded after `
          + `${MISS_HOLD_FRAMES} frames; showing a placeholder`);
      }
    }
    const show = visible && !below && slot.missAt !== null && this.frame - slot.missAt >= MISS_HOLD_FRAMES;
    if (show && !slot.placeholder) slot.placeholder = this.placeholder(i);
    if (slot.placeholder) {
      slot.placeholder.visible = show;
      if (below) { slot.placeholder.destroy(); slot.placeholder = null; }   // the real texture replaces it
    }
  }

  /** WR: move a wanted slot's sprites to its image (px). */
  private placeSlot(slot: Slot, x: number, y: number): void {
    for (const s of [slot.below, slot.above, slot.placeholder]) s?.position.set(x, y);
  }

  /** A flat chunk in its dominant terrain's colour. */
  private placeholder(i: number): Sprite {
    const px = this.art.chunk * TILE_SIZE;
    const col = i % this.cols;
    const row = Math.floor(i / this.cols);
    const sprite = new Sprite(Texture.WHITE);
    sprite.tint = dominantColour(this.map, col, row, this.art.chunk);
    sprite.width = px;
    sprite.height = px;
    sprite.position.set(col * px, row * px);
    this.below.addChild(sprite);
    return sprite;
  }

  /** Both of chunk i's textures are loaded. */
  private loaded(i: number): boolean {
    const up = this.art.above[i];
    return this.streamer.texture(this.art.below[i]) !== null && (!up || this.streamer.texture(up) !== null);
  }

  /** A texture is being freed: drop the sprite drawing it first (Assets.unload destroys the texture). */
  private evicted(url: string): void {
    const at = this.urlSlot.get(url);
    if (!at) return;
    const slot = this.slots[at.i];
    slot[at.layer]?.destroy();
    slot[at.layer] = null;
  }

  /** A texture arrived: wake `ready` waiters, and tell the listeners once the whole chunk is loaded. */
  private arrived(url: string): void {
    this.checkReady();
    const at = this.urlSlot.get(url);
    if (!at || !this.loaded(at.i)) return;
    for (const cb of this.listeners) {
      try { cb(at.i); } catch (err) { console.error(`Map ${this.map.id}: a chunk-loaded listener failed`, err); }
    }
  }

  private checkReady(): void {
    const vis = this.visible;
    if (!vis || this.waiters.length === 0) return;
    for (const { i } of rectChunks(vis, this.cols, this.rows)) if (!this.loaded(i)) return;
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w();
  }
}
