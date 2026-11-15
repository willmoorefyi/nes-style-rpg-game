/**
 * Fh test 4 (docs/BESTIARY_PLAN.md 3.6, 5, 7): the bestiary scene on a mock game with the real data, a fake monster
 * art source and a deferred background loader (no fetch).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container, Graphics, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { BestiaryScene, PREVIEW_DEBOUNCE_FRAMES } from '../../../src/scenes/bestiary/BestiaryScene.js';
import { PREVIEW_INNER } from '../../../src/scenes/bestiary/BestiaryPreview.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import { GameFlags } from '../../../src/core/GameFlags.js';
import { BOSS_FRAMES, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import type { MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import type { MonsterFrames } from '../../../src/rendering/BattleArt.js';
import type { InputAction } from '../../../src/core/InputManager.js';
import type { Game } from '../../../src/core/Game.js';
import { visibleLabels } from '../../helpers/realData.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = <T>(f: string): T => parse(readFileSync(join(root, f), 'utf-8')) as T;

/** isPressed while held; isJustPressed only on the first frame of a hold. */
function heldInput() {
  const held = new Set<InputAction>();
  const fresh = new Set<InputAction>();
  return {
    isPressed: (a: InputAction) => held.has(a),
    isJustPressed: (a: InputAction) => fresh.has(a),
    hold(a: InputAction) { held.add(a); fresh.add(a); },
    release(a: InputAction) { held.delete(a); },
    endFrame() { fresh.clear(); },
  };
}

const atlas = new TextureSource({ width: 4096, height: 4096 });
/** 80-cell monsters (garland 200), every frame its own view of one source; daze aliases hurt_in1 (no daze art). */
function fakeArt(missing: string[] = []): MonsterArtSource {
  return {
    getMonsterFrames(sprite: string): MonsterFrames | null {
      if (missing.includes(sprite)) return null;
      const big = sprite === 'garland' || sprite === 'lich';
      const cell: [number, number] = big ? [200, 200] : [80, 80];
      const textures = {} as Record<MonsterFrame, Texture>;
      BOSS_FRAMES.forEach((n, k) => { textures[n] = new Texture({ source: atlas, frame: new Rectangle(k * 10, 0, cell[0], cell[1]) }); });
      textures.daze = textures.hurt_in1;
      textures.daze_b = textures.hurt_in1;
      return { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: 2, artScale: 2,
        cell, footRow: cell[1] - 3, floating: false, hasCast: big, hasRaise: false, lungePx: big ? 38 : 24, anim: true, opaqueRight: big ? 184 : 68 };   // the real atlas idle edges (garland 184, goblin 68)
    },
  };
}

function setup(opts: { missing?: string[] } = {}) {
  const input = heldInput();
  const requests: { path: string; resolve: (t: Texture) => void; texture: Texture }[] = [];
  const loadTexture = (path: string) => new Promise<Texture>((res) => {
    const texture = new Texture({ source: new TextureSource({ width: 1920, height: 1080 }) });
    requests.push({ path, resolve: () => res(texture), texture });
  });
  const game = {
    input,
    scenes: { pop: vi.fn().mockResolvedValue(undefined) },
    gameFlags: new GameFlags(),
    data: {
      loadBestiary: async () => validateBestiary(read('assets/data/bestiary.yaml')),
      loadEnemies: async () => read('assets/data/enemies.yaml'),
      loadSpells: async () => read('assets/data/spells.yaml'),
      loadMap: async (p: string) => read(p),
      loadMapManifest: async (p: string) => read(p),
    },
  };
  const art = fakeArt(opts.missing);
  const scene = new BestiaryScene(game as unknown as Game, { art, loadTexture });
  const frame = (n = 1): void => { for (let i = 0; i < n; i++) { scene.update(1); input.endFrame(); } };
  const tap = (a: InputAction): void => { input.hold(a); frame(); input.release(a); };
  return { scene, game, input, frame, tap, requests, art };
}

const statsText = (scene: BestiaryScene): string => scene.stats!.shown.join('\n');
const descendants = (c: Container): number => c.children.reduce((n, ch) => n + 1 + descendants(ch), 0);

afterEach(() => { vi.restoreAllMocks(); });

describe('BestiaryScene', () => {
  it('opens on 001 Goblin; Down shows Gr.Imp at once and rebuilds the preview after 8 stable frames', async () => {
    const { scene, tap, frame } = setup();
    await scene.enter();
    expect(visibleLabels(scene.container)).toContain('001 Goblin');
    expect(statsText(scene)).toContain('HP         8');
    const goblinSprite = scene.preview!.enemySprite;
    tap('down');
    expect(statsText(scene)).toContain('HP         16');
    frame(PREVIEW_DEBOUNCE_FRAMES - 1);
    expect(scene.preview!.enemySprite).toBe(goblinSprite);
    frame(1);
    expect(scene.preview!.enemySprite).not.toBe(goblinSprite);
  });

  it('Right moves 6 entries, stays on the last; Left goes back', async () => {
    const { scene, tap } = setup();
    await scene.enter();
    tap('right');
    expect(scene.selectedIndex).toBe(6);
    tap('right');
    tap('right');
    expect(scene.selectedIndex).toBe(13);
    tap('right');
    expect(scene.selectedIndex).toBe(13);
    tap('left');
    expect(scene.selectedIndex).toBe(7);
  });

  it('a held Down moves again after 20 frames, then every 5', async () => {
    const { scene, input, frame } = setup();
    await scene.enter();
    input.hold('down');
    frame();
    expect(scene.selectedIndex).toBe(1);
    frame(20);
    expect(scene.selectedIndex).toBe(1);
    frame(5);
    expect(scene.selectedIndex).toBe(2);
    frame(5);
    expect(scene.selectedIndex).toBe(3);
  });

  it('X pops once; Z starts the attack', async () => {
    const { scene, game, tap } = setup();
    await scene.enter();
    tap('confirm');
    expect(scene.previewPoses!.debug(0).mode).toBe('attack');
    tap('cancel');
    tap('cancel');
    expect(game.scenes.pop).toHaveBeenCalledTimes(1);
  });

  it('never off-panel: goblin and garland stay inside the preview on every attack frame', async () => {
    for (const index of [0, 12]) {
      const { scene, tap, frame, art } = setup();
      await scene.enter();
      if (index) { tap('right'); tap('right'); frame(PREVIEW_DEBOUNCE_FRAMES); }
      const id = index ? 'garland' : 'goblin';
      expect(scene.stats!.shown.join()).toBeTruthy();
      const f = art.getMonsterFrames(id)!;
      tap('confirm');
      let n = 0;
      let maxTravel = 0;
      while (scene.previewPoses!.isAttacking(0)) {
        const s = scene.preview!.enemySprite!;
        expect(s.x + f.opaqueRight! * f.scale).toBeLessThanOrEqual(PREVIEW_INNER.right);
        expect(s.x).toBeGreaterThanOrEqual(PREVIEW_INNER.left);
        maxTravel = Math.max(maxTravel, scene.previewPoses!.state(0).travelDx ?? 0);
        frame();
        n++;
      }
      expect(n).toBeGreaterThan(20);
      expect(maxTravel).toBeGreaterThan(0);
    }
  });

  it('scroll and leak: two walks over all 14 entries leave one enemy sprite and the same descendant count', async () => {
    const { scene, tap, frame, requests } = setup();
    await scene.enter();
    for (const r of requests) r.resolve(r.texture);
    await Promise.resolve();
    const before = descendants(scene.container);
    for (let walk = 0; walk < 2; walk++) {
      for (let i = 0; i < 14; i++) { tap('down'); frame(PREVIEW_DEBOUNCE_FRAMES + 2); }
      for (const r of requests) r.resolve(r.texture);
      await new Promise((res) => setTimeout(res, 0));
    }
    expect(scene.selectedIndex).toBe(0);
    const stage = scene.preview!.stage;
    const actors = stage.children.find((c) => c.children.includes(scene.preview!.phantomTarget))!;
    expect(actors.children.filter((c) => c !== scene.preview!.phantomTarget)).toHaveLength(1);
    expect(descendants(scene.container)).toBe(before);
  });

  it('background race: A then B, resolved B then A, B stays; a load resolved after exit adds nothing', async () => {
    const { scene, tap, frame, requests } = setup();
    await scene.enter();
    tap('right');
    tap('right');                                   // garland: temple
    frame(PREVIEW_DEBOUNCE_FRAMES);
    const [a, b] = requests;
    expect([a.path, b.path]).toEqual(['assets/backgrounds/grassland.webp', 'assets/backgrounds/temple.webp']);
    b.resolve(b.texture);
    await Promise.resolve();
    a.resolve(a.texture);
    await new Promise((res) => setTimeout(res, 0));
    const textures = scene.preview!.stage.children.filter((c): c is Sprite => c instanceof Sprite).map((s) => s.texture);
    expect(textures).toEqual([b.texture]);
    tap('left');
    frame(PREVIEW_DEBOUNCE_FRAMES);
    const pending = requests[requests.length - 1];
    scene.exit();
    expect(() => pending.resolve(pending.texture)).not.toThrow();
    await new Promise((res) => setTimeout(res, 0));
    expect(scene.container.children).toHaveLength(0);
  });

  it('exit destroys every cached texture view but not the atlas source, and empties the cache', async () => {
    const { scene, tap, frame } = setup();
    await scene.enter();
    tap('down');
    frame(PREVIEW_DEBOUNCE_FRAMES);
    const preview = scene.preview!;
    const textures = [...preview.art.textures()];
    expect(textures.length).toBeGreaterThan(10);
    scene.exit();
    expect(textures.every((t) => t.destroyed)).toBe(true);
    expect(atlas.destroyed).toBe(false);
    expect(preview.art.size).toBe(0);
  });

  it('a missing sheet shows the placeholder box and "No art yet", with no console.error', async () => {
    const error = vi.spyOn(console, 'error');
    const { scene, frame } = setup({ missing: ['goblin'] });
    await scene.enter();
    frame();
    expect(scene.preview!.enemySprite).toBeInstanceOf(Graphics);
    expect(visibleLabels(scene.container)).toContain('No art yet');
    expect(error).not.toHaveBeenCalled();
  });
});
