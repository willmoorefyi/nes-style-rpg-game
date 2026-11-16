/**
 * The centrepiece geometry (docs/CHAOS_FORMS_PLAN.md 3.0, R12; rev 4: 18.4, D-O18) on the painted F3 fixture: the
 * 2700x1080 canvas spans the world at scale 1 with <= 55 % of it visible, the arms span every screen column, the form
 * draws no floor front (rev 3's overhang hand and floor front are superseded) and sits under every window and actor,
 * the chaos_i2 reveal rises to the pan's start (+480, +120) and pans to rest with the disc in the field and every border
 * rule held on every frame, and a layer wider than 2048 px is tiled without gaps.
 */
import { describe, it, expect } from 'vitest';
import { Container } from 'pixi.js';
import { ColossusView } from '../../../src/scenes/battle/colossus/ColossusView.js';
import { canvasRect, borderProblems, spansColumns, visibleFraction, FIELD } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { FormInterludePlayer, type InterludeHost } from '../../../src/scenes/battle/FormInterludePlayer.js';
import type { InterludeStep } from '../../../src/scenes/battle/formInterlude.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { fixtureArt, fixtureIndex, HORIZON, WIDE } from '../../helpers/colossusFixture.js';
import { descendants } from '../../helpers/battleLayers.js';

async function horizon(): Promise<ColossusView> {
  return new ColossusView(HORIZON, fixtureIndex().forms[HORIZON], await fixtureArt([HORIZON]));
}

describe('F3 spans the world (R12, 18.4)', () => {
  it('the canvas is >= 2688 px wide, passes the left, right and top edges, and <= 55 % of it is visible', () => {
    const f = fixtureIndex().forms[HORIZON];
    const c = canvasRect(f);
    expect(c.w).toBeGreaterThanOrEqual(2688);
    expect(c).toEqual({ x: -527, y: -210, w: 2700, h: 1080 });
    expect(visibleFraction(f)).toBeLessThanOrEqual(0.55);
    expect(visibleFraction(f)).toBeCloseTo((1920 * 780) / (2700 * 1080), 3);
    expect(spansColumns(f)).toBe(true);
    expect(borderProblems(f, { x: 0, y: 0 }, 6)).toEqual([]);
  });
});

describe('draw order inside the colossus layer (D-O18: no floor front)', () => {
  it('the view holds only its art; every ui and actors child of the battle draws over it', async () => {
    const root = new Container();
    const layers = BattleLayers.of(root);
    const v = await horizon();
    layers.colossus.addChild(v.root);
    layers.ui.addChild(new Container());
    layers.actors.addChild(new Container());
    const order = [root, ...descendants(root, (c): c is Container => c instanceof Container)];
    expect(v.root.children).toEqual([v.art]);
    const top = Math.max(...[v.root, ...descendants(v.root, (_c): _c is Container => true)].map((c) => order.indexOf(c)));
    for (const c of [...layers.ui.children, ...layers.actors.children]) expect(order.indexOf(c)).toBeGreaterThan(top);
  });
});

/** chaos_i2's reveal (18.4): the swap, the rise of 700 over 120 frames, then the pan from (+480, +120) to rest. */
const REVEAL: InterludeStep[] = [
  { type: 'swap' },
  { type: 'rise', frames: 120, from_dy: 700 },
  { type: 'shake', times: 2, with: 'previous' },
  { type: 'pan', from: [480, 120], frames: 120, ease: 'out' },
];

describe('the chaos_i2 reveal (18.4)', () => {
  it('the rise ends at the pan start (no jump); at the first pan frame the disc is in the field; borders hold on every pan frame', async () => {
    const v = await horizon();
    const f = fixtureIndex().forms[HORIZON];
    const host: InterludeHost = {
      message: () => {}, flash: () => {}, shake: () => {}, tint: () => {}, fade: () => {}, dissolve: () => {}, pose: () => {},
      variant: () => {}, music: () => {}, end: () => {},
      swap: (riseFrom) => v.setRise(riseFrom), rise: (dy) => v.setRise(dy), pan: (x, y) => v.setPan(x, y),
    };
    const player = new FormInterludePlayer(REVEAL, host);
    const offsets: { x: number; y: number }[] = [];
    for (let fr = 0; fr < 300 && !player.update(1, false); fr++) offsets.push(v.canvasOffset());
    expect(offsets[0].x).toBe(480);
    expect(offsets[0].y).toBeGreaterThanOrEqual(120 + 690);   // from_dy 700 below the pan start (its first frame drawn)
    const panStart = offsets.findIndex((o, i) => i > 0 && o.y === 120 && o.x === 480);
    expect(panStart).toBeGreaterThan(100);
    for (let i = 1; i < offsets.length; i++) {
      expect(Math.abs(offsets[i].y - offsets[i - 1].y), `frame ${i}`).toBeLessThanOrEqual(12);
      expect(Math.abs(offsets[i].x - offsets[i - 1].x), `frame ${i}`).toBeLessThanOrEqual(12);
    }
    const first = offsets[panStart];
    const core = v.anchors().core;
    expect(core).toEqual({ x: 820, y: 300 });
    v.setRise(0);
    v.setPan(first.x, first.y);
    const c = v.anchors().target;
    expect(c.x).toBeGreaterThanOrEqual(FIELD.x0);
    expect(c.x).toBeLessThanOrEqual(FIELD.x1);
    expect(c.y).toBeGreaterThanOrEqual(FIELD.y0);
    expect(c.y).toBeLessThanOrEqual(FIELD.y1);
    for (const o of offsets.slice(panStart)) expect(borderProblems(f, o), `${o.x},${o.y}`).toEqual([]);
    for (const o of offsets.slice(0, panStart)) expect(borderProblems(f, o, 0, ['left', 'right', 'bottom']), `rise ${o.x},${o.y}`).toEqual([]);
    expect(offsets[offsets.length - 1]).toEqual({ x: 0, y: 0 });
  });
});

describe('tiles (4.2: a layer wider than 2048 px)', () => {
  it('the wide fixture body is two tiles that abut with no gap or overlap', async () => {
    const f = fixtureIndex().forms[WIDE];
    const v = new ColossusView(WIDE, f, await fixtureArt([WIDE]));
    const body = v.layerNode('body')!;
    const [a, b] = body.children.flatMap((c) => c.children).filter((c) => c.label !== 'colossus.flash');
    expect(a.getBounds().width).toBe(2048);
    expect(a.getBounds().x + a.getBounds().width).toBe(b.getBounds().x);
    expect(a.getBounds().y).toBe(b.getBounds().y);
    expect(a.getBounds().width + b.getBounds().width).toBe(2600);
  });
});
