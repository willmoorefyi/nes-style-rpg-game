/**
 * ColossusView on the painted F3 fixture (docs/CHAOS_FORMS_PLAN.md 4.2-4.4, 9.2; rev 4: 18.3-18.7): placement and
 * scale 1 from the json, linear textures (no integer-scale or nearest assumption), the glow drawn at its texScale 2,
 * the blend and rest alpha from the json (RIG finding 2: no hard-coded 0.5), sub-pixel canvas motion with a whole-px
 * shake (|dx| <= 12), the border rules and the column span on every frame, the per-layer hurt flash as an additive copy
 * of the layer's own texture (no filter, no composite, R15) and no layout-engine call for colossus data.
 * (Rev 3's "nearest, whole px, covers the R14 band" rows are superseded by 18.1 / 18.4 and updated here.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container, RenderTexture, Sprite } from 'pixi.js';
import { ColossusView, FLASH_ALPHA } from '../../../src/scenes/battle/colossus/ColossusView.js';
import { ColossusPoseController } from '../../../src/scenes/battle/colossus/ColossusPoseController.js';
import { BREATH_PX, GLOW_PULSE_MIN, TIMELINE_FRAMES, poseAt, type ColossusTimeline } from '../../../src/scenes/battle/colossus/colossusChoreography.js';
import { borderProblems, spansColumns, touchedSides, type ColossusFormSpec } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { PAN_ENVELOPE, panLimits } from '../../../src/data/interludeScripts.js';
import { AiEnemyView } from '../../../src/scenes/battle/AiEnemyView.js';
import * as layout from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { colossusEnemy, fixtureArt, fixtureIndex, HORIZON } from '../../helpers/colossusFixture.js';

vi.mock('../../../src/scenes/battle/EnemyLayoutAi.js', async (orig) => {
  const m = await orig<typeof import('../../../src/scenes/battle/EnemyLayoutAi.js')>();
  return { ...m, computeEnemyLayoutAi: vi.fn(m.computeEnemyLayoutAi), formationFits: vi.fn(m.formationFits) };
});

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

const form = (): ColossusFormSpec => fixtureIndex().forms[HORIZON];

async function view(f: ColossusFormSpec = form()): Promise<{ v: ColossusView; ctl: ColossusPoseController }> {
  const art = await fixtureArt([HORIZON]);
  const v = new ColossusView(HORIZON, f, art);
  return { v, ctl: new ColossusPoseController(v.layerInfo) };
}

function sprites(root: Container): Sprite[] {
  const out: Sprite[] = [];
  const walk = (c: Container): void => { for (const k of c.children) { if (k instanceof Sprite) out.push(k); walk(k); } };
  walk(root);
  return out;
}
/** The drawn tile sprites (not the flash copies). */
const tiles = (root: Container): Sprite[] => sprites(root).filter((s) => s.label !== 'colossus.flash');
const flashes = (root: Container): Sprite[] => sprites(root).filter((s) => s.label === 'colossus.flash');
/** Drawn: the sprite and every ancestor up to the root are visible. */
const drawn = (root: Container, s: Container): boolean => { for (let c: Container | null = s; c && c !== root; c = c.parent) if (!c.visible) return false; return true; };
const box = (c: Container) => { const b = c.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };

const TIMELINES: ColossusTimeline[] = ['idle', 'slam', 'beam', 'cast', 'hurt', 'roar', 'dying'];

describe('ColossusView: placement, scale and textures (18.1, 18.4)', () => {
  it('places the 2700x1080 canvas at the json place (-527, -60) at scale 1; the body is cropped to rows 360-1079', async () => {
    const { v } = await view();
    const f = form();
    expect(f.scale).toBe(1);
    expect(v.art.scale.x).toBe(1);
    expect({ x: v.art.x, y: v.art.y }).toEqual({ x: -527, y: -60 });
    expect(box(v.layerNode('body')!)).toEqual({ x: -527, y: 300, w: 2700, h: 720 });
  });

  it('the glow is stored at half res and drawn at its texScale 2 over the whole canvas', async () => {
    const { v } = await view();
    const glow = v.layerNode('glow')!;
    const [t] = tiles(glow);
    expect({ w: t.texture.width, h: t.texture.height }).toEqual({ w: 1350, h: 540 });
    expect(box(glow)).toEqual({ x: -527, y: -60, w: 2700, h: 1080 });
  });

  it('every tile texture is linear-filtered with no mipmaps', async () => {
    const { v } = await view();
    const ts = tiles(v.root);
    expect(ts.length).toBeGreaterThanOrEqual(6);
    for (const s of ts) {
      expect(s.texture.source.scaleMode).toBe('linear');
      expect(s.texture.source.autoGenerateMipmaps).toBe(false);
    }
  });

  it('the glow and corona blend additively from the json; body and core are normal', async () => {
    const { v } = await view();
    for (const name of ['glow', 'corona']) {
      expect(v.layerNode(name)!.blendMode, name).toBe('add');
      for (const s of tiles(v.layerNode(name)!)) expect(s.blendMode, name).toBe('add');
    }
    for (const name of ['body', 'core']) for (const s of tiles(v.layerNode(name)!)) expect(s.blendMode, name).toBe('normal');
  });

  it('the rest alpha comes from the json (glow 1.0 in the fixture, pulsing 1 <-> 0.7; a 0.7 entry rests at 0.7), never 0.5', async () => {
    const { v } = await view();
    v.apply(poseAt('idle', 0, 0, v.layerInfo));
    expect(v.layerNode('glow')!.alpha).toBe(1);
    expect(GLOW_PULSE_MIN).toBe(0.7);
    const rest: number[] = [];
    for (let c = 0; c < 288; c++) { v.apply(poseAt('idle', c % 144, c, v.layerInfo)); rest.push(v.layerNode('glow')!.alpha); }
    expect(Math.min(...rest)).toBeCloseTo(0.7, 3);
    expect(Math.max(...rest)).toBeCloseTo(1, 3);
    const f = form();
    const dim: ColossusFormSpec = { ...f, layers: f.layers.map((l) => (l.name === 'glow' ? { ...l, alpha: 0.7 } : l)) };
    const { v: w } = await view(dim);
    const alphas: number[] = [];
    for (let c = 0; c < 288; c++) { w.apply(poseAt('idle', c % 144, c, w.layerInfo)); alphas.push(w.layerNode('glow')!.alpha); }
    expect(alphas[0]).toBeCloseTo(0.7, 6);
    expect(Math.min(...alphas)).toBeCloseTo(0.7 * GLOW_PULSE_MIN, 3);
    expect(alphas).not.toContain(0.5);
  });

  it('the core base frame is empty (the body carries it) and draws nothing; crack and open are frames', async () => {
    const { v } = await view();
    expect(v.frameOf('core')).toBe('base');
    expect(tiles(v.layerNode('core')!).filter((s) => drawn(v.root, s))).toHaveLength(0);
    v.setVariant('core', 'crack');
    expect(v.frameOf('core')).toBe('crack');
    expect(tiles(v.layerNode('core')!).filter((s) => drawn(v.root, s))).toHaveLength(1);
  });

  it('the proxy is a measurable, never-drawn box at the target rect (screen x 643-1003, y 285-780)', async () => {
    const { v } = await view();
    expect(box(v.proxy)).toEqual({ x: 643, y: 285, w: 360, h: 495 });
    for (const c of v.proxy.children) expect(c.renderable).toBe(false);
  });
});

describe('ColossusView: every timeline frame', () => {
  it('positions are finite, the shake is whole px and the canvas moves at most 12 px sideways; the breathing is sub-pixel', async () => {
    const { v } = await view();
    let subPixel = false;
    for (const tl of TIMELINES) {
      for (let t = 0; t < TIMELINE_FRAMES[tl]; t++) {
        v.apply(poseAt(tl, t, t, v.layerInfo));
        const off = v.canvasOffset();
        expect(Number.isInteger(off.x), `${tl} ${t}`).toBe(true);
        expect(Math.abs(off.x), `${tl} ${t}`).toBeLessThanOrEqual(12);
        expect(Number.isFinite(off.y)).toBe(true);
        subPixel ||= !Number.isInteger(off.y);
      }
    }
    expect(subPixel).toBe(true);
  });

  it('every border rule and the column span hold at rest and in every idle / attack / cast / hurt frame (18.4)', async () => {
    const { v } = await view();
    const f = form();
    expect(touchedSides(f).sort()).toEqual(['bottom', 'left', 'right', 'top']);
    expect(borderProblems(f, v.canvasOffset(), 6)).toEqual([]);
    for (const tl of ['idle', 'slam', 'beam', 'cast', 'hurt'] as ColossusTimeline[]) {
      for (let t = 0; t < TIMELINE_FRAMES[tl]; t++) {
        v.apply(poseAt(tl, t, t, v.layerInfo));
        expect(borderProblems(f, v.canvasOffset()), `${tl} ${t}`).toEqual([]);
        expect(spansColumns(f, v.canvasOffset()), `${tl} ${t}`).toBe(true);
      }
    }
  });

  it('the pan limits come from the json and the breathing envelope: dx [-247, +521], dy [-230, +174] (B4)', () => {
    const bobs = Array.from({ length: 144 }, (_, c) => poseAt('idle', c, c, []).bob);
    expect(Math.min(...bobs)).toBeCloseTo(-BREATH_PX, 6);
    expect(Math.max(...bobs)).toBeCloseTo(0, 6);
    expect(PAN_ENVELOPE.up).toBe(BREATH_PX);
    expect(panLimits(form())).toEqual({ dx: [-247, 521], dy: [-230, 174] });
  });
});

describe('ColossusView: the hurt flash is an additive copy of each layer (18.3, R15)', () => {
  it('a hurt shows the copies 2 on / 2 off, twice: same texture, add, white tint, alpha 0.6; no filter, no render texture', async () => {
    const created = vi.spyOn(RenderTexture, 'create');
    const { v, ctl } = await view();
    const copies = flashes(v.root);
    expect(copies.length).toBeGreaterThan(0);
    const base = tiles(v.root);
    for (const c of copies) {
      expect(c.blendMode).toBe('add');
      expect(c.alpha).toBe(FLASH_ALPHA);
      expect(c.tint).toBe(0xffffff);
      expect(base.some((b) => b.texture === c.texture && b.parent === c.parent)).toBe(true);
    }
    expect(flashes(v.layerNode('glow')!)).toHaveLength(0);
    ctl.hurt();
    const lit: boolean[] = [];
    for (let t = 0; t < 10; t++) {
      v.apply(ctl.frame());
      const body = flashes(v.layerNode('body')!);
      lit.push(body.every((s) => drawn(v.root, s)) && body.length === 2);
      ctl.update(1);
    }
    expect(lit).toEqual([true, true, false, false, true, true, false, false, false, false]);
    expect(created).not.toHaveBeenCalled();
    const all: Container[] = [v.root, ...sprites(v.root)];
    for (const c of all) expect(c.filters ?? []).toHaveLength(0);
  });

  it('flashWhite (the routed element flash) lights the normal layers for 4 frames', async () => {
    const { v } = await view();
    v.flashWhite();
    v.apply(poseAt('idle', 0, 0, v.layerInfo));
    expect(flashes(v.layerNode('body')!).every((s) => drawn(v.root, s))).toBe(true);
    expect(v.flashing).toBe(true);
    for (let i = 0; i < 4; i++) v.tick(1);
    v.apply(poseAt('idle', 0, 0, v.layerInfo));
    expect(flashes(v.root).some((s) => drawn(v.root, s))).toBe(false);
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
