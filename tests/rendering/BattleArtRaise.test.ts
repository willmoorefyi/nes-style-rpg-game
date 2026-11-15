/** F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 7): `hasRaise` and the new frames' fallback chain in the atlas slicer. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { BattleArt } from '../../src/rendering/BattleArt.js';

const atlas = {
  scale: 2, texScale: 1,
  sheets: {
    garland: { cell: [100, 100], footRow: 96, floating: false, anim: true, lungePx: 40,
      frames: { idle: [0, 0], attack: [100, 0], hurt: [200, 0], cast: [300, 0], attack_raise: [400, 0], hurt_in1: [500, 0],
        atk_wind1: [600, 0], atk_wind2: [700, 0], atk_mid: [800, 0] } },
    goblin: { cell: [80, 80], footRow: 76, floating: false, frames: { idle: [0, 100], attack: [80, 100], hurt: [160, 100] } },
  },
};

function respond(body: string, ok = true): Response {
  return { ok, status: ok ? 200 : 404, text: async () => body, json: async () => JSON.parse(body) } as unknown as Response;
}

describe('BattleArt: hasRaise and the fallback chain', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async () =>
      ({ width: 2000, height: 2000, source: { scaleMode: 'linear', width: 2000, height: 2000 } }) as unknown as never);
    vi.stubGlobal('fetch', vi.fn(async (path: string) =>
      (path.endsWith('monsters-ai.json') ? respond(JSON.stringify(atlas)) : respond('', false))));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('a sheet with its own attack_raise has hasRaise; the raise in-betweens fall back along the chain', async () => {
    const art = new BattleArt();
    await art.load();
    const g = art.getMonsterFrames('garland')!;
    expect(g.hasRaise).toBe(true);
    const x = (t: Texture) => t.frame.x;
    expect(x(g.textures.attack_raise)).toBe(400);
    expect(x(g.textures.atk_raise_b)).toBe(700);        // no own frame: atk_wind2
    expect(x(g.textures.atk_raise_in)).toBe(600);       // atk_wind1
    expect(x(g.textures.atk_swing)).toBe(800);          // atk_mid
    expect(x(g.textures.atk_swing2)).toBe(800);
    expect(x(g.textures.daze)).toBe(500);               // hurt_in1
    expect(x(g.textures.daze_b)).toBe(500);             // daze -> hurt_in1
  });

  it('an old sheet: no raise, every new frame lands on a keyframe', async () => {
    const art = new BattleArt();
    await art.load();
    const f = art.getMonsterFrames('goblin')!;
    expect(f.hasRaise).toBe(false);
    expect(f.textures.daze).toBe(f.idle);
    expect(f.textures.attack_raise).toBe(f.idle);
    expect(f.textures.atk_swing2).toBe(f.attack);
  });
});
