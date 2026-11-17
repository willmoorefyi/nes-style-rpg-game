import { Sprite, Texture, type Container } from 'pixi.js';
import type { BakedMapArt, MapData } from '../types/index.js';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from './Camera.js';
import { TILE_SIZE } from '../core/LayoutConstants.js';
import { chunkRect, ChunkStreamer, dominantColour, MISS_HOLD_FRAMES, STREAM_TEXTURE_CAP, viewSpan, type ChunkRect,
  type ChunkSource } from './chunkStreaming.js';

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

  constructor(private readonly map: MapData, private readonly art: BakedMapArt, source: ChunkSource,
    private readonly below: Container, private readonly above: Container, private readonly sprite: ChunkSpriteFactory) {
    this.cols = Math.ceil(map.width / art.chunk);
    this.rows = Math.ceil(map.height / art.chunk);
    this.streamer = new ChunkStreamer(source, STREAM_TEXTURE_CAP, (url) => this.evicted(url), () => this.checkReady());
    art.below.forEach((url, i) => {
      this.slots.push({ below: null, above: null, placeholder: null, missAt: null, logged: false });
      this.urlSlot.set(url, { i, layer: 'below' });
      const up = art.above[i];
      if (up) this.urlSlot.set(up, { i, layer: 'above' });
    });
  }

  /** Resident chunk textures (loaded or loading), both layers. */
  get count(): number { return this.streamer.count; }

  /** One frame: `vis` is the chunks in view, (`camX`, `camY`) the camera, whose motion gives the direction of travel. */
  update(vis: ChunkRect, camX: number, camY: number): void {
    this.frame++;
    if (this.last) {
      if (camX !== this.last.x) this.dir.x = Math.sign(camX - this.last.x);
      if (camY !== this.last.y) this.dir.y = Math.sign(camY - this.last.y);
    }
    this.last = { x: camX, y: camY };
    const win: ChunkRect = {
      c0: Math.max(0, vis.c0 - 1 - (this.dir.x < 0 ? 1 : 0)), c1: Math.min(this.cols - 1, vis.c1 + 1 + (this.dir.x > 0 ? 1 : 0)),
      r0: Math.max(0, vis.r0 - 1 - (this.dir.y < 0 ? 1 : 0)), r1: Math.min(this.rows - 1, vis.r1 + 1 + (this.dir.y > 0 ? 1 : 0)),
    };
    const isVisible = (i: number): boolean => inRect(vis, i % this.cols, Math.floor(i / this.cols));
    const order: number[] = [];
    for (let row = win.r0; row <= win.r1; row++) for (let col = win.c0; col <= win.c1; col++) order.push(row * this.cols + col);
    order.sort((a, b) => Number(isVisible(b)) - Number(isVisible(a)));   // the visible chunks load first
    this.window = new Set(order);
    this.visible = vis;
    const urls: string[] = order.map((i) => this.art.below[i]);
    for (const i of order) { const up = this.art.above[i]; if (up) urls.push(up); }
    this.streamer.want(urls, this.frame);
    this.slots.forEach((slot, i) => this.updateSlot(slot, i, isVisible(i)));
    this.checkReady();
  }

  /** A step onto (x, y) waits while a window chunk the view there needs is missing, for at most MISS_HOLD_FRAMES. */
  stepHeld(x: number, y: number): boolean {
    if (!this.visible) return false;
    const [x0, x1] = viewSpan(x, VIEWPORT_WIDTH / TILE_SIZE, this.map.width);
    const [y0, y1] = viewSpan(y, VIEWPORT_HEIGHT / TILE_SIZE, this.map.height);
    const r = chunkRect(x0, y0, x1, y1, this.art.chunk, this.cols, this.rows);
    let held = false;
    for (let row = r.r0; row <= r.r1; row++) {
      for (let col = r.c0; col <= r.c1; col++) {
        const i = row * this.cols + col;
        if (!this.window.has(i) || this.loaded(i)) continue;   // chunks outside the window never hold a step
        const slot = this.slots[i];
        slot.missAt ??= this.frame;
        if (this.frame - slot.missAt < MISS_HOLD_FRAMES) held = true;
      }
    }
    return held;
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

  private checkReady(): void {
    const vis = this.visible;
    if (!vis || this.waiters.length === 0) return;
    for (let row = vis.r0; row <= vis.r1; row++) for (let col = vis.c0; col <= vis.c1; col++) {
      if (!this.loaded(row * this.cols + col)) return;
    }
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w();
  }
}

function inRect(r: ChunkRect, col: number, row: number): boolean {
  return col >= r.c0 && col <= r.c1 && row >= r.r0 && row <= r.r1;
}
