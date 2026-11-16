/**
 * ColossusView on the 900x520 art px fixture (docs/CHAOS_FORMS_PLAN.md 4.2-4.4, 9.2): placement and scale from the
 * json, nearest textures, every timeline frame at whole screen px with |dx| <= 12, coverage of the field band under the
 * R14 scope, the per-layer white hurt flash (no composite texture, R15) and no layout-engine call for colossus data.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container, RenderTexture, Sprite } from 'pixi.js';
import { ColossusView } from '../../../src/scenes/battle/colossus/ColossusView.js';
import { ColossusPoseController } from '../../../src/scenes/battle/colossus/ColossusPoseController.js';
import { TIMELINE_FRAMES, panAt, poseAt, type ColossusTimeline } from '../../../src/scenes/battle/colossus/colossusChoreography.js';
import { coversField, panLimits, type ColossusFormSpec } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { AiEnemyView } from '../../../src/scenes/battle/AiEnemyView.js';
import * as layout from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { colossusEnemy, fixtureArt, fixtureIndex, HORIZON } from '../../helpers/colossusFixture.js';

vi.mock('../../../src/scenes/battle/EnemyLayoutAi.js', async (orig) => {
  const m = await orig<typeof import('../../../src/scenes/battle/EnemyLayoutAi.js')>();
  return { ...m, computeEnemyLayoutAi: vi.fn(m.computeEnemyLayoutAi), formationFits: vi.fn(m.formationFits) };
});

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

const form = (): ColossusFormSpec => fixtureIndex().forms[HORIZON];

async function view(): Promise<{ v: ColossusView; ctl: ColossusPoseController }> {
  const art = await fixtureArt([HORIZON]);
  const v = new ColossusView(HORIZON, form(), art);
  return { v, ctl: new ColossusPoseController(v.layerInfo) };
}

/** Every drawn tile sprite under the view's root. */
function tiles(root: Container): Sprite[] {
  const out: Sprite[] = [];
  const walk = (c: Container): void => { for (const k of c.children) { if (k instanceof Sprite) out.push(k); walk(k); } };
  walk(root);
  return out;
}

/** Drawn: the sprite and every ancestor up to the root are visible (other frames of a layer are hidden). */
function shown(root: Container): Sprite[] {
  return tiles(root).filter((s) => { for (let c: Container | null = s; c && c !== root; c = c.parent) if (!c.visible) return false; return true; });
}

const TIMELINES: ColossusTimeline[] = ['idle', 'slam', 'beam', 'cast', 'hurt', 'roar', 'dying'];

describe('ColossusView: placement, scale and textures', () => {
  it('places the canvas at the json place with its integer scale; the art is scaled, not resampled', async () => {
    const { v } = await view();
    const f = form();
    expect(Number.isInteger(f.scale)).toBe(true);
    expect(v.art.scale.x).toBe(f.scale);
    expect(v.art.scale.y).toBe(f.scale);
    expect({ x: v.art.x, y: v.art.y }).toEqual({ x: f.place[0], y: f.place[1] });
    const body = v.layerNode('body')!;
    const b = body.getBounds();
    expect({ x: b.x, y: b.y, w: b.width, h: b.height }).toEqual({ x: -390, y: -302, w: 2700, h: 1560 });
  });

  it('every tile texture uses scaleMode nearest', async () => {
    const { v } = await view();
    const ts = tiles(v.root);
    expect(ts.length).toBeGreaterThan(10);
    for (const s of ts) expect(s.texture.source.scaleMode).toBe('nearest');
  });

  it('the proxy is a measurable, never-drawn box at the target rect (screen px), inside the field', async () => {
    const { v } = await view();
    const b = v.proxy.getBounds();
    expect({ x: b.x, y: b.y, w: b.width, h: b.height }).toEqual({ x: 750, y: 238, w: 420, h: 360 });
    expect(v.proxy.visible).toBe(true);
    expect(v.proxy.alpha).toBe(1);
    for (const c of v.proxy.children) expect(c.renderable).toBe(false);
  });
});

describe('ColossusView: every timeline frame', () => {
  it('positions are whole screen px and the canvas moves at most 12 px sideways', async () => {
    const { v } = await view();
    for (const tl of TIMELINES) {
      for (let t = 0; t < TIMELINE_FRAMES[tl]; t++) {
        v.apply(poseAt(tl, t, t, v.layerInfo));
        const off = v.canvasOffset();
        expect(Math.abs(off.x), `${tl} ${t}`).toBeLessThanOrEqual(12);
        for (const name of v.layerInfo.map((l) => l.name)) {
          const node = v.layerNode(name)!;
          const g = node.getGlobalPosition();
          expect(Number.isInteger(g.x) && Number.isInteger(g.y), `${tl} ${t} ${name} ${g.x},${g.y}`).toBe(true);
        }
      }
    }
  });

  it('the art covers x 0..1920, y 120..370 at rest and in every idle / attack / cast / hurt / pan frame (R14)', async () => {
    const { v } = await view();
    const f = form();
    expect(coversField(f, v.canvasOffset())).toBe(true);
    for (const tl of ['idle', 'slam', 'beam', 'cast', 'hurt'] as ColossusTimeline[]) {
      for (let t = 0; t < TIMELINE_FRAMES[tl]; t++) {
        v.apply(poseAt(tl, t, t, v.layerInfo));
        expect(coversField(f, v.canvasOffset()), `${tl} ${t}`).toBe(true);
      }
    }
    v.apply(poseAt('idle', 0, 0, v.layerInfo));
    for (let t = 0; t <= 120; t++) {
      const p = panAt(t, 120, [0, -60], 'out');
      v.setPan(p.x, p.y);
      expect(coversField(f, v.canvasOffset()), `pan ${t}`).toBe(true);
    }
    const lim = panLimits(f);
    expect(lim).toEqual({ dx: [-128, 128], dy: [-160, 138] });
  });
});

describe('ColossusView: the hurt flash is per layer (R15)', () => {
  it('a hurt swaps every visible tile to its white silhouette on 2 / off 2, twice; no composite render texture', async () => {
    const created = vi.spyOn(RenderTexture, 'create');
    const { v, ctl } = await view();
    const before = tiles(v.root).map((s) => s.texture);
    ctl.hurt();
    const white: boolean[] = [];
    for (let t = 0; t < 10; t++) {
      v.apply(ctl.frame());
      const now = shown(v.root);
      white.push(now.every((s) => !before.includes(s.texture)));
      ctl.update(1);
    }
    expect(white).toEqual([true, true, false, false, true, true, false, false, false, false]);
    expect(created).not.toHaveBeenCalled();
  });

  it('flashWhite (the routed element flash) lights every layer for 4 frames', async () => {
    const { v } = await view();
    const base = tiles(v.root).map((s) => s.texture);
    v.flashWhite();
    v.apply(poseAt('idle', 0, 0, v.layerInfo));
    expect(shown(v.root).every((s) => !base.includes(s.texture))).toBe(true);
    for (let i = 0; i < 4; i++) v.tick(1);
    v.apply(poseAt('idle', 0, 0, v.layerInfo));
    expect(shown(v.root).every((s) => base.includes(s.texture))).toBe(true);
  });
});

describe('colossus data bypasses the layout engine (4.2)', () => {
  it('AiEnemyView never lays out or checks a colossus record, and warns nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const v = new AiEnemyView([colossusEnemy()], { getMonsterFrames: () => null });
    v.build();
    expect(layout.computeEnemyLayoutAi).not.toHaveBeenCalled();
    expect(layout.formationFits).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the variant step (R19)', () => {
  it('setVariant shows the named frame of one layer and keeps the view', async () => {
    const { v } = await view();
    v.setVariant('core', 'open');
    v.apply(poseAt('idle', 0, 0, v.layerInfo));
    expect(v.frameOf('core')).toBe('open');
    expect(v.frameOf('body')).toBe('base');
  });
});
