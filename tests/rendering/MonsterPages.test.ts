/** FW-8 (docs/ROSTER_PLAN.md 8): page selection, dedup, shared in-flight loads, failures, refcounts and the LRU. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Texture } from 'pixi.js';
import { MonsterPages, PAGE_CACHE, type PageIo } from '../../src/rendering/MonsterPages.js';

const PAGES = [0, 1, 2, 3, 4].map((i) => ({ file: `monsters-ai-${i}.png`, w: 2048, h: 2048 }));
const PAGE_OF: Record<string, number> = { goblin: 0, wolf: 0, ashen_queen: 1, chaos: 1, zombie: 2, wraith: 3, ghost: 4 };

const tex = (): Texture => ({ source: { scaleMode: 'linear' } }) as unknown as Texture;

function fakeIo(fail: Set<string> = new Set()): PageIo & { loads: string[]; unloads: string[]; gate: Promise<void> | null } {
  const io = {
    loads: [] as string[], unloads: [] as string[], gate: null as Promise<void> | null,
    async load(url: string): Promise<Texture> {
      io.loads.push(url);
      if (io.gate) await io.gate;
      if (fail.has(url)) throw new Error(`404 ${url}`);
      return tex();
    },
    unload(url: string): void { io.unloads.push(url); },
  };
  return io;
}

function pages(io: PageIo): MonsterPages {
  const p = new MonsterPages('assets/sprites/', io);
  p.setIndex(PAGES, (s) => PAGE_OF[s]);
  return p;
}

describe('MonsterPages', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('ensure loads only the pages the sprites live on, once each, with nearest scaling', async () => {
    const io = fakeIo();
    const p = pages(io);
    await p.ensure(['goblin', 'wolf', 'goblin', 'chaos', 'unknown']);
    expect(io.loads).toEqual(['assets/sprites/monsters-ai-0.png', 'assets/sprites/monsters-ai-1.png']);
    expect(p.isReady('wolf') && p.isReady('ashen_queen')).toBe(true);
    expect(p.isReady('zombie')).toBe(false);
    expect(p.texture(0)?.source.scaleMode).toBe('nearest');
    await p.ensure(['goblin']);
    expect(io.loads).toHaveLength(2);                     // already loaded: no new request
  });

  it('shares a load in flight and reports busy until it settles', async () => {
    const io = fakeIo();
    let open!: () => void;
    io.gate = new Promise<void>((r) => { open = r; });
    const p = pages(io);
    const a = p.ensure(['zombie']);
    const b = p.ensure(['zombie']);
    expect(io.loads).toEqual(['assets/sprites/monsters-ai-2.png']);
    expect(p.busy).toBe(true);
    open();
    await Promise.all([a, b, p.settled()]);
    expect(p.busy).toBe(false);
    expect(p.isReady('zombie')).toBe(true);
  });

  it('a failed page warns, never rejects, leaves its sprites not ready; a later ensure retries it', async () => {
    const io = fakeIo(new Set(['assets/sprites/monsters-ai-3.png']));
    const p = pages(io);
    await expect(p.ensure(['wraith', 'goblin'])).resolves.toBeUndefined();
    expect(p.isReady('wraith')).toBe(false);
    expect(p.hasFailed('wraith')).toBe(true);
    expect(p.isReady('goblin')).toBe(true);
    expect(console.warn).toHaveBeenCalledTimes(1);
    await p.ensure(['wraith']);
    expect(io.loads.filter((u) => u.endsWith('-3.png'))).toHaveLength(2);
  });

  it(`keeps at most ${PAGE_CACHE} unheld pages: the least recently used unheld page is freed`, async () => {
    const io = fakeIo();
    const p = pages(io);
    await p.ensure(['goblin']);
    await p.ensure(['chaos']);
    await p.ensure(['zombie']);
    expect(p.loadedPages()).toEqual([1, 2]);
    expect(io.unloads).toEqual(['assets/sprites/monsters-ai-0.png']);
  });

  it('never frees a held page, and frees it once released (when over capacity)', async () => {
    const io = fakeIo();
    const p = pages(io);
    await p.ensure(['goblin']);
    const release = p.hold('goblin');
    expect(p.refCount(0)).toBe(1);
    await p.ensure(['chaos']);
    await p.ensure(['zombie']);
    await p.ensure(['wraith']);
    expect(p.loadedPages()).toEqual([0, 2, 3]);           // 0 is held; two unheld pages kept
    release();
    release();                                             // idempotent
    expect(p.refCount(0)).toBe(0);
    expect(p.loadedPages()).toEqual([2, 3]);
  });

  it('never frees a page the latest ensure asked for, even above capacity (a 3-page formation before its view holds)', async () => {
    const io = fakeIo();
    const p = pages(io);
    await p.ensure(['goblin', 'chaos', 'zombie']);
    expect(p.loadedPages()).toEqual([0, 1, 2]);
    const holds = ['goblin', 'chaos', 'zombie'].map((s) => p.hold(s));
    await p.ensure(['wraith', 'ghost']);
    expect(p.loadedPages()).toEqual([0, 1, 2, 3, 4]);
    for (const r of holds) r();
    expect(p.loadedPages()).toEqual([3, 4]);              // the battle ended: back to the 2 most recent
  });
});
