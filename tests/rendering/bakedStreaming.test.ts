import { afterEach, describe, expect, it, vi } from 'vitest';
import { Assets, Container, Sprite, Texture, TextureSource } from 'pixi.js';

// the streaming window is sized for the 2x field (96 px tiles, a 20x11-tile view), as the game plays it
vi.mock('../../src/core/LayoutConstants.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/core/LayoutConstants.js')>()), TILE_SIZE: 96,
}));

import { BakedMapRenderer, loadBakedTextures } from '../../src/rendering/BakedMapRenderer.js';
import { Camera } from '../../src/rendering/Camera.js';
import { assetChunkSource, MISS_HOLD_FRAMES, STREAM_MIN_CHUNKS, STREAM_TEXTURE_CAP, type ChunkSource } from '../../src/rendering/chunkStreaming.js';
import { MapLoader } from '../../src/systems/MapLoader.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import { TerrainType, type MapData } from '../../src/types/index.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { PlaceholderTextures } from '../../src/rendering/PlaceholderTextures.js';

const TILE = 96;
const AIRSHIP_PX_PER_FRAME = TILE / 6;   // moveSpeed 200 ms at x2: a tile in 6 frames of 16.67 ms

/** The 192x192 world in 16-tile chunks (12x12 = 144), every chunk with an above layer (the worst case). */
function world(terrain = TerrainType.Water): MapData {
  const n = 144;
  const at = (i: number): string => `assets/maps/ai/overworld/${Math.floor(i / 12)}_${i % 12}`;
  return {
    id: 'overworld', width: 192, height: 192, layers: [], tilesets: [],
    collision: new Array(192 * 192).fill(terrain), npcs: [], transitions: [],
    patches: [{ id: 'canal', flag: 'CANAL_OPEN', cells: [[50, 90], [51, 90], [50, 91]], terrain: TerrainType.Water }],
    art: {
      tile: 48, chunk: 16,
      below: Array.from({ length: n }, (_, i) => `${at(i)}_below.png`),
      above: Array.from({ length: n }, (_, i) => `${at(i)}_above.png`),
      patches: { canal: 'assets/maps/ai/overworld/patch_canal.png' },
    },
  };
}

/** A chunk source whose loads finish `latency` frames after they start (`Infinity`: never); counts residency. */
class FakeSource implements ChunkSource {
  frame = 0;
  resident = new Set<string>();
  maxResident = 0;
  unloaded: string[] = [];
  private pending: { url: string; due: number; resolve: (t: Texture) => void }[] = [];
  constructor(private readonly latency: (url: string) => number) {}

  load(url: string): Promise<Texture> {
    this.resident.add(url);
    this.maxResident = Math.max(this.maxResident, this.resident.size);
    return new Promise((resolve) => this.pending.push({ url, due: this.frame + this.latency(url), resolve }));
  }

  unload(url: string): void {
    this.unloaded.push(url);
    this.resident.delete(url);
  }

  /** Advance one frame; resolves the loads due by then. */
  async tick(): Promise<void> {
    this.frame++;
    const due = this.pending.filter((p) => p.due <= this.frame);
    this.pending = this.pending.filter((p) => p.due > this.frame);
    for (const p of due) p.resolve(Texture.WHITE);
    if (due.length) await new Promise((r) => setTimeout(r, 0));
  }
}

function setup(source: ChunkSource, map = world(), hasFlag?: (f: string) => boolean) {
  const r = new BakedMapRenderer(map, { below: [], above: [], patches: { canal: Texture.WHITE } }, { source, hasFlag });
  const cam = new Camera(new Container());
  cam.setMapBounds(map.width, map.height);
  const target = { x: TILE / 2, y: TILE / 2 };
  cam.follow(target);
  r.setCamera(cam);
  const frame = (): void => { cam.update(); r.render(); };
  return { r, cam, target, frame };
}

/** The serpentine airship path over the whole world: rows 10 tiles apart, at 1/6 tile per frame. */
function* sweep(): Generator<{ x: number; y: number }> {
  const max = 192 * TILE - TILE / 2;
  let x = TILE / 2;
  let y = TILE / 2;
  let right = true;
  for (;;) {
    const goal = right ? max : TILE / 2;
    while (x !== goal) { x = right ? Math.min(goal, x + AIRSHIP_PX_PER_FRAME) : Math.max(goal, x - AIRSHIP_PX_PER_FRAME); yield { x, y }; }
    if (y >= max) return;
    const ny = Math.min(max, y + 10 * TILE);
    while (y !== ny) { y = Math.min(ny, y + AIRSHIP_PX_PER_FRAME); yield { x, y }; }
    right = !right;
  }
}

afterEach(() => { vi.restoreAllMocks(); });

describe('baked map streaming (QUEST 4.3, W1-E)', () => {
  it('streams maps of more than 64 chunks with a cap of 60 textures and a 6-frame miss hold', () => {
    expect([STREAM_MIN_CHUNKS, STREAM_TEXTURE_CAP, MISS_HOLD_FRAMES]).toEqual([64, 60, 6]);
  });

  it('keeps at most 60 chunk textures resident during an airship sweep of the 192x192 world, seeing every chunk', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const src = new FakeSource(() => 12);   // 200 ms per chunk
    const { r, target, frame } = setup(src);
    frame();
    const first = r.ready();
    while (src.frame < 20) { await src.tick(); frame(); }
    await first;
    warn.mockClear();   // the first view loads in 12 frames (> 6): its placeholders are not the sweep's
    const seen = new Set<string>();
    let held = 0;
    for (const p of sweep()) {
      // a step starts on each tile boundary: it must not wait once the window is primed
      if (p.x % TILE === TILE / 2 && p.y % TILE === TILE / 2 && r.stepHeld(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) held++;
      target.x = p.x;
      target.y = p.y;
      frame();
      await src.tick();
      expect(r.residentTextures).toBeLessThanOrEqual(60);
      for (const c of r.container.children as Sprite[]) {
        if (c.visible && c.zIndex === 0 && c.scale.x === TILE / 48) seen.add(`${c.x},${c.y}`);
      }
    }
    expect(src.maxResident).toBeLessThanOrEqual(60);
    expect(seen.size).toBe(144);            // the sweep covers the whole world
    expect(held).toBe(0);                   // prefetch keeps ahead of the airship
    expect(warn).not.toHaveBeenCalled();    // and no placeholder ever showed
    expect(src.unloaded.length).toBeGreaterThan(0);
  });

  it('holds a step at most 6 frames on a miss, then shows a flat placeholder in the dominant colour, logged once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const src = new FakeSource(() => Infinity);
    const { r, frame } = setup(src);
    frame();
    const holds: boolean[] = [];
    for (let f = 0; f < 10; f++) { holds.push(r.stepHeld(1, 0)); frame(); }
    expect(holds.filter(Boolean)).toHaveLength(6);
    expect(holds.slice(0, 6).every(Boolean)).toBe(true);
    const flats = (r.container.children as Sprite[]).filter((s) => s.visible && s.texture === Texture.WHITE && s.width === 16 * TILE);
    expect(flats.length).toBe(2);                       // the view at the origin: chunks (0, 0) and (1, 0)
    expect(flats.every((s) => s.tint === 0x1d4f9c)).toBe(true);   // ocean blue
    expect(warn).toHaveBeenCalledTimes(2);              // one line per missed chunk, not per frame
    for (let f = 0; f < 10; f++) frame();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('replaces a placeholder with the real chunk once it loads', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let slow = true;
    const src = new FakeSource(() => (slow ? 30 : 1));
    const { r, frame } = setup(src);
    frame();
    for (let f = 0; f < 8; f++) { await src.tick(); frame(); }
    const placeholders = () => (r.container.children as Sprite[]).filter((s) => s.width === 16 * TILE && s.tint !== 0xffffff);
    expect(placeholders().length).toBeGreaterThan(0);
    slow = false;
    for (let f = 0; f < 30; f++) { await src.tick(); frame(); }
    expect(placeholders()).toHaveLength(0);
  });

  it('frees chunks through Assets.unload, and every resident chunk when the map is left', async () => {
    const tex = (): Texture => new Texture({ source: new TextureSource({ width: 1, height: 1 }) });
    vi.spyOn(Assets, 'load').mockImplementation((async () => tex()) as unknown as typeof Assets.load);
    const unload = vi.spyOn(Assets, 'unload').mockResolvedValue(undefined);
    const { r, target, frame } = setup(assetChunkSource);
    const parent = new Container();
    parent.addChild(r.container);
    frame();
    await new Promise((res) => setTimeout(res, 0));
    for (const at of [100, 180]) {
      target.x = at * TILE;
      target.y = at * TILE;
      for (let f = 0; f < 3; f++) { frame(); await new Promise((res) => setTimeout(res, 0)); }
    }
    expect(unload).toHaveBeenCalled();                  // the window moved: the far chunks are freed
    const before = unload.mock.calls.length;
    const resident = r.residentTextures;
    parent.removeChildren();                            // ExplorationScene.loadMap leaves the map
    expect(unload.mock.calls.length - before).toBe(resident);
    expect(r.residentTextures).toBe(0);
  });

  it('draws a patch overlay at its cells over the below layer only while its flag is set', () => {
    let open = false;
    const { r, target, frame } = setup(new FakeSource(() => 1), world(), (f) => f === 'CANAL_OPEN' && open);
    target.x = 50 * TILE;
    target.y = 90 * TILE;
    const patch = (r.container.children as Sprite[]).find((s) => s.zIndex === 1);
    expect(patch?.position.x).toBe(50 * TILE);
    expect(patch?.position.y).toBe(90 * TILE);
    expect(patch?.scale.x).toBe(TILE / 48);
    frame();
    expect(patch?.visible).toBe(false);
    open = true;
    frame();
    expect(patch?.visible).toBe(true);
  });

  it('loads only the patch overlays up front for a streamed map, every chunk for a small one', async () => {
    const src = new FakeSource(() => 0);
    const loads = vi.spyOn(src, 'load');
    const pending = loadBakedTextures(world().art!, src);
    await src.tick();
    const t = await pending;
    expect(loads).toHaveBeenCalledTimes(1);
    expect(t.below.every((x) => x === null)).toBe(true);
    expect(t.patches?.canal).toBe(Texture.WHITE);
  });

  it('MapLoader: a streamed map refuses a step while its view is missing, for at most 6 frames', async () => {
    const map = world(TerrainType.Grass);
    const dl = { loadMapManifest: vi.fn().mockResolvedValue(['overworld']), loadMap: vi.fn().mockResolvedValue(map) };
    const placeholders = { getNPCTexture: vi.fn(), getNPCFrames: vi.fn().mockReturnValue(null) } as unknown as PlaceholderTextures;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const src = new FakeSource((url) => (url.includes('patch_') ? 0 : Infinity));
    const ml = new MapLoader(dl as unknown as DataLoader, placeholders, { preferCompiled: true, chunkSource: src });
    const loading = ml.loadMap('overworld', () => false);
    await new Promise((res) => setTimeout(res, 0));
    await src.tick();
    const { tilemap, collisionMap } = await loading;
    const walking = new WalkingMode();
    expect(collisionMap.isWalkable(1, 0, walking)).toBe(true);   // no camera yet: nothing to wait for
    const cam = new Camera(new Container());
    cam.setMapBounds(192, 192);
    tilemap.setCamera(cam);
    const steps: boolean[] = [];
    for (let f = 0; f < 10; f++) { tilemap.render(); steps.push(collisionMap.isWalkable(1, 0, walking)); }
    expect(steps.filter((s) => !s)).toHaveLength(6);
    expect(steps[steps.length - 1]).toBe(true);
  });
});

// WR (docs/WORLD_WRAP_PLAN.md 5, D-WR-10): patch images and the layer sentinels on a wrapped map
describe('WR: a wrapped streamed map', () => {
  const torus = (): MapData => {
    const m = world();
    m.patches = [{ id: 'canal', flag: 'CANAL_OPEN', cells: [[2, 90], [3, 90]], terrain: TerrainType.Water }];
    return { ...m, wrap: true };
  };

  it('draws a patch at its image nearest the camera, and shows it across the seam', () => {
    const map = torus();
    const r = new BakedMapRenderer(map, { below: [], above: [], patches: { canal: Texture.WHITE } },
      { source: new FakeSource(() => 1), hasFlag: () => true });
    const cam = new Camera(new Container());
    cam.setMapBounds(map.width, map.height, true);
    const target = { x: 190 * TILE, y: 90 * TILE };
    cam.follow(target);
    r.setCamera(cam);
    cam.update();
    r.render();
    const patch = (r.container.children as Sprite[]).find((s) => s.zIndex === 1)!;
    expect(patch.position.x).toBe((192 + 2) * TILE);
    expect(patch.visible).toBe(true);
    target.x = 10 * TILE;
    cam.update();
    r.render();
    expect(patch.position.x).toBe(2 * TILE);
  });

  it('takes the sentinel z on a wrapped map and keeps -1 and (H + 2) x TILE on a flat one', () => {
    const wrapped = new BakedMapRenderer(torus(), { below: [], above: [] }, { source: new FakeSource(() => 1) });
    expect([wrapped.container.zIndex, wrapped.aboveContainer.zIndex]).toEqual([-1_000_000, 1_000_000]);
    const flat = new BakedMapRenderer(world(), { below: [], above: [] }, { source: new FakeSource(() => 1) });
    expect([flat.container.zIndex, flat.aboveContainer.zIndex]).toEqual([-1, (192 + 2) * TILE]);
  });
});
