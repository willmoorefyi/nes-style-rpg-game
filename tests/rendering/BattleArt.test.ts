import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { BattleArt, monsterSpriteKey } from '../../src/rendering/BattleArt.js';
import { BOSS_FRAMES, FRAME_SOURCE } from '../../src/scenes/battle/enemyChoreography.js';

const aiMonsters = {
  scale: 2,
  sheets: {
    goblin: { cell: [80, 80], footRow: 76, floating: false, frames: { idle: [0, 0], attack: [80, 0], hurt: [160, 0] } },
  },
};

function fakeTexture(w = 96, h = 96): Texture {
  return { width: w, height: h, source: { scaleMode: 'linear', width: 2000, height: 2000 } } as unknown as Texture;
}

function respond(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body, json: async () => JSON.parse(body) } as unknown as Response;
}

describe('monsterSpriteKey', () => {
  it('uses the sprite name (so palette-swap variants get their own art), without an extension', () => {
    expect(monsterSpriteKey({ id: 'hobgoblin', sprite: 'goblin_red' })).toBe('goblin_red');
    expect(monsterSpriteKey({ id: 'goblin', sprite: 'goblin.png' })).toBe('goblin');
    expect(monsterSpriteKey({ id: 'goblin' })).toBe('goblin');
  });
});

describe('BattleArt monster frames', () => {
  let atlasJson: () => Response;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Assets, 'load').mockImplementation(async () => fakeTexture() as never);
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      const file = path.split('/').pop();
      if (file === 'monsters-ai.json') return atlasJson();
      return respond('', false, 404);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('slices idle, attack and hurt at 2x with the atlas feet row; cast falls back to attack', async () => {
    atlasJson = () => respond(JSON.stringify(aiMonsters));
    const art = new BattleArt();
    await art.load();
    const f = art.getMonsterFrames('goblin')!;
    expect(f.scale).toBe(2);
    expect(f.footRow).toBe(76);
    expect(f.idle).not.toBe(f.attack);
    expect(f.attack.frame.x).toBe(160);
    expect(f.hurt.frame.x).toBe(320);
    expect(f.idle.frame.width).toBe(160);
    expect(f.cast.frame.x).toBe(f.attack.frame.x);
    expect(art.getMonsterFrames('wolf')).toBeNull();      // no art: the battle shows a placeholder box
  });

  it('an old atlas (no texScale, no new keys): every frame falls back to its source keyframe, sliced at scale', async () => {
    atlasJson = () => respond(JSON.stringify(aiMonsters));
    const art = new BattleArt();
    await art.load();
    const f = art.getMonsterFrames('goblin')!;
    for (const n of BOSS_FRAMES) expect(f.textures[n], n).toBeDefined();
    expect(f.textures.atk_wind1.frame.x).toBe(f.idle.frame.x);
    expect(f.textures.atk_mid.frame.x).toBe(f.attack.frame.x);
    expect(f.textures.hurt_in2.frame.x).toBe(f.hurt.frame.x);
    expect(f.textures.cast_rise.frame.x).toBe(f.attack.frame.x);     // no cast keyframe: attack
    for (const n of BOSS_FRAMES) if (FRAME_SOURCE[n] !== 'cast') expect(f.textures[n]).toBe(f.textures[FRAME_SOURCE[n]]);
    expect(f.artScale).toBe(1);                       // the PNG is pre-scaled
    expect(f.lungePx).toBe(24);
    expect(f.hasCast).toBe(false);
    expect(f.anim).toBe(false);
  });

  it('a native atlas (texScale 1) is sliced in art px and scaled at runtime (artScale = scale / texScale)', async () => {
    const native = {
      scale: 2, texScale: 1,
      sheets: {
        lich: { cell: [200, 200], footRow: 192, floating: false, anim: true, holds: [], lungePx: 40,
          frames: { idle: [0, 0], attack: [200, 0], hurt: [400, 0], cast: [600, 0], atk_mid: [800, 0], cast_rise: [1000, 0] } },
      },
    };
    atlasJson = () => respond(JSON.stringify(native));
    const art = new BattleArt();
    await art.load();
    const f = art.getMonsterFrames('lich')!;
    expect(f.scale).toBe(2);
    expect(f.artScale).toBe(2);
    expect(f.idle.frame.width).toBe(200);
    expect(f.textures.atk_mid.frame.x).toBe(800);
    expect(f.textures.cast_rise.frame.x).toBe(1000);
    expect(f.textures.cast_release.frame.x).toBe(600);  // a boss frame without its own rect: the cast keyframe
    expect(f.textures.idle_b.frame.x).toBe(0);
    expect(f.hasCast).toBe(true);
    expect(f.lungePx).toBe(40);
    expect(f.anim).toBe(true);
  });

  it('E16: warns once per sprite when the loaded atlas lacks its sheet; no warning before load()', async () => {
    atlasJson = () => respond(JSON.stringify(aiMonsters));
    // only the per-sheet warnings (the party atlas fetch, a 404 here, warns on its own)
    const sheetWarnings = () => vi.mocked(console.warn).mock.calls.map((c) => String(c[0])).filter((m) => m.includes('no sheet'));
    const art = new BattleArt();
    expect(art.getMonsterFrames('wolf')).toBeNull();      // late-load path (A15): not loaded yet, so no warning
    expect(sheetWarnings()).toEqual([]);
    await art.load();
    expect(art.getMonsterFrames('wolf')).toBeNull();
    expect(art.getMonsterFrames('wolf')).toBeNull();
    expect(art.getMonsterFrames('goblin')).not.toBeNull();
    expect(sheetWarnings()).toHaveLength(1);
    expect(sheetWarnings()[0]).toContain('"wolf"');
    art.getMonsterFrames('ogre');
    expect(sheetWarnings()).toHaveLength(2);
  });

  it('a missing or broken atlas does not block battle', async () => {
    atlasJson = () => respond('<!doctype html>');
    const art = new BattleArt();
    await art.load();
    expect(art.isLoaded).toBe(true);
    expect(art.getMonsterFrames('goblin')).toBeNull();
  });
});
