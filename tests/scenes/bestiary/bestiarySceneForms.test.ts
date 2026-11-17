/**
 * C7 test 5.4 (docs/CHAOS_FIX_PLAN.md 3; C6-3, C6-13): the bestiary scene on the real data lists the Chaos forms as
 * sub-entries under 128 Chaos, the title total stays 127, `?bestiary=chaos_orrery | chaos_horizon | chaos_horizon_core`
 * open those stills (F4 on the Horizon entry's 4th page), C pages from F3 into F4 and back, `mode: seen` hides each form
 * until its SEEN flag, and the forms stand on the rim. The colossus art is the real colossus.json on blank textures.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Rectangle, Texture, TextureSource } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { BestiaryScene, PREVIEW_DEBOUNCE_FRAMES } from '../../../src/scenes/bestiary/BestiaryScene.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import { GameFlags } from '../../../src/core/GameFlags.js';
import { colossusArt } from '../../../src/rendering/ColossusArt.js';
import { resetBestiaryDeepLink, takeBestiaryDeepLink } from '../../../src/scenes/bestiary/bestiaryLink.js';
import { BOSS_FRAMES, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import type { MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import type { MonsterFrames } from '../../../src/rendering/BattleArt.js';
import type { InputAction } from '../../../src/core/InputManager.js';
import type { Game } from '../../../src/core/Game.js';
import type { BestiaryData } from '../../../src/types/bestiaryData.js';
import { visibleLabels } from '../../helpers/realData.js';
import { fixtureIo } from '../../helpers/colossusFixture.js';

const read = <T>(f: string): T => parse(readFileSync(f, 'utf-8')) as T;
const source = new TextureSource({ width: 4096, height: 4096 });

/** One 80-cell sheet for every sprite (the colossus forms draw their stills, not the atlas). */
const art: MonsterArtSource = {
  getMonsterFrames(): MonsterFrames {
    const textures = {} as Record<MonsterFrame, Texture>;
    BOSS_FRAMES.forEach((n, k) => { textures[n] = new Texture({ source, frame: new Rectangle(k * 10, 0, 80, 80) }); });
    textures.daze = textures.hurt_in1;
    textures.daze_b = textures.hurt_in1;
    return { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: 2,
      artScale: 2, cell: [80, 80], footRow: 77, floating: false, hasCast: true, hasRaise: false, lungePx: 24, anim: true,
      opaqueRight: 68 };
  },
};

function input() {
  const fresh = new Set<InputAction>();
  return { isPressed: (a: InputAction) => fresh.has(a), isJustPressed: (a: InputAction) => fresh.has(a),
    press(a: InputAction) { fresh.add(a); }, endFrame() { fresh.clear(); } };
}

let io: ReturnType<typeof fixtureIo>;
let restore: () => void;
beforeEach(() => {
  io = fixtureIo(JSON.parse(readFileSync('assets/sprites/colossus.json', 'utf-8')));
  restore = colossusArt.setIo(io);
});
afterEach(() => { restore(); resetBestiaryDeepLink(); vi.restoreAllMocks(); });

function setup(opts: { link?: string; mode?: BestiaryData['mode']; seen?: string[] } = {}) {
  const inp = input();
  const backgrounds: string[] = [];
  const loadTexture = (path: string) => { backgrounds.push(path); return Promise.resolve(new Texture({ source: new TextureSource({ width: 1920, height: 1080 }) })); };
  const gameFlags = new GameFlags();
  for (const id of opts.seen ?? []) gameFlags.set(`SEEN:${id}`);
  const game = {
    input: inp,
    scenes: { pop: vi.fn().mockResolvedValue(undefined) },
    gameFlags,
    data: {
      loadBestiary: async () => ({ ...validateBestiary(read('assets/data/bestiary.yaml')), ...(opts.mode ? { mode: opts.mode } : {}) }),
      loadEnemies: async () => read('assets/data/enemies.yaml'),
      loadSpells: async () => read('assets/data/spells.yaml'),
      loadMap: async (p: string) => read(p),
      loadMapManifest: async (p: string) => read(p),
    },
  };
  if (opts.link) { resetBestiaryDeepLink(); takeBestiaryDeepLink(`?bestiary=${opts.link}`); }
  const scene = new BestiaryScene(game as unknown as Game, { art, loadTexture });
  const frame = (n = 1): void => { for (let i = 0; i < n; i++) { scene.update(1); inp.endFrame(); } };
  const tap = (a: InputAction): void => { inp.press(a); frame(); };
  return { scene, frame, tap, backgrounds, gameFlags };
}

const stills = (): string[] => vi.mocked(io.load).mock.calls.map((c) => c[0]);
const labels = (scene: BestiaryScene): string[] => visibleLabels(scene.container);
const settle = async (frame: (n?: number) => void): Promise<void> => {
  frame(PREVIEW_DEBOUNCE_FRAMES + 1);
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('C7 5.4: the bestiary scene wires the Chaos forms', () => {
  it('the list shows 128 Chaos, then Chaos (Orrery) and Chaos (Horizon); the title total stays 127', async () => {
    const { scene, tap } = setup({ link: 'chaos' });
    await scene.enter();
    expect(labels(scene)).toContain('128 Chaos  127/127');
    tap('down');
    expect(labels(scene)).toContain('128 Chaos (Orrery)  127/127');
    tap('down');
    expect(labels(scene)).toContain('128 Chaos (Horizon)  127/127');
  });

  it.each([
    ['chaos_orrery', '128 Chaos (Orrery)  127/127', 0, 'colossus/chaos_orrery/preview.png'],
    ['chaos_horizon', '128 Chaos (Horizon)  127/127', 0, 'colossus/chaos_horizon/preview.png'],
    ['chaos_horizon_core', '128 Chaos (Core)  127/127', 2, 'colossus/chaos_horizon_core/preview.png'],
  ])('?bestiary=%s opens its entry and page with its still on the rim', async (link, title, page, still) => {
    vi.spyOn(io, 'load');
    const { scene, frame, backgrounds } = setup({ link });
    await scene.enter();
    await settle(frame);
    expect(labels(scene)).toContain(title);
    expect(scene.panelPage).toBe(page);
    expect(stills()).toContain(still);
    expect(backgrounds[backgrounds.length - 1]).toBe('assets/backgrounds/rim.webp');
  });

  it('C pages the Horizon entry from F3 into F4 (title, stats and still change) and back to F3', async () => {
    vi.spyOn(io, 'load');
    const { scene, frame, tap } = setup({ link: 'chaos_horizon' });
    await scene.enter();
    await settle(frame);
    expect(scene.stats!.shown.join('\n')).toContain('Attack     120');
    tap('start');
    tap('start');
    expect(scene.panelPage).toBe(2);
    expect(labels(scene)).toContain('128 Chaos (Core)  127/127');
    expect(scene.stats!.shown.join('\n')).toContain('Attack     130');
    await settle(frame);
    expect(stills()[stills().length - 1]).toBe('colossus/chaos_horizon_core/preview.png');
    tap('start');
    expect(scene.stats!.shown[0]).toBe('Info');
    tap('start');
    expect(scene.panelPage).toBe(0);
    expect(labels(scene)).toContain('128 Chaos (Horizon)  127/127');
    await settle(frame);
    expect(stills()[stills().length - 1]).toBe('colossus/chaos_horizon/preview.png');
  });

  it('mode: seen: a form and the F4 page show ??? with no still until SEEN:<id> is set', async () => {
    vi.spyOn(io, 'load');
    const { scene, frame, tap } = setup({ link: 'chaos_horizon_core', mode: 'seen', seen: ['chaos', 'chaos_orrery', 'chaos_horizon'] });
    await scene.enter();
    await settle(frame);
    expect(labels(scene)).toContain('128 ???  127/127');
    expect(stills()).not.toContain('colossus/chaos_horizon_core/preview.png');
    tap('up');
    expect(labels(scene)).toContain('128 Chaos (Orrery)  127/127');
    const later = setup({ link: 'chaos_horizon_core', mode: 'seen', seen: ['chaos', 'chaos_orrery', 'chaos_horizon', 'chaos_horizon_core'] });
    scene.exit();
    await later.scene.enter();
    await settle(later.frame);
    expect(labels(later.scene)).toContain('128 Chaos (Core)  127/127');
    expect(stills()).toContain('colossus/chaos_horizon_core/preview.png');
  });
});
