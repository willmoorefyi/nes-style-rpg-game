/**
 * The centrepiece geometry (docs/CHAOS_FORMS_PLAN.md 3.0, R12-R14, A2) on the F3-like fixture: the canvas spans the
 * world, the overhang hand sits over the floor front and under every window and actor, the reveal pan starts with the
 * hand in the field and ends with it on the rim, and a layer wider than 2048 px is tiled without gaps.
 */
import { describe, it, expect } from 'vitest';
import { Container } from 'pixi.js';
import { ColossusView } from '../../../src/scenes/battle/colossus/ColossusView.js';
import { panAt } from '../../../src/scenes/battle/colossus/colossusChoreography.js';
import { canvasRect, coversField, visibleFraction } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { fixtureArt, fixtureIndex, HORIZON, WIDE } from '../../helpers/colossusFixture.js';
import { descendants } from '../../helpers/battleLayers.js';

const PAN_FROM: [number, number] = [0, -60];
const PAN_FRAMES = 120;

async function horizon(): Promise<ColossusView> {
  return new ColossusView(HORIZON, fixtureIndex().forms[HORIZON], await fixtureArt([HORIZON]));
}

describe('F3 spans the world (R12)', () => {
  it('the canvas is at least 1.4x the screen, passes the left, right and top edges, and <= 45 % of it is visible', () => {
    const f = fixtureIndex().forms[HORIZON];
    const c = canvasRect(f);
    expect(c.w).toBeGreaterThanOrEqual(2688);
    expect(c.h).toBeGreaterThanOrEqual(1512);
    expect(c.x).toBeLessThan(0);
    expect(c.x + c.w).toBeGreaterThan(1920);
    expect(c.y).toBeLessThan(0);
    expect(visibleFraction(f)).toBeLessThanOrEqual(0.45);
    expect(visibleFraction(f)).toBeCloseTo((1920 * 780) / (2700 * 1560), 3);
    expect(coversField(f)).toBe(true);
  });
});

describe('draw order inside the colossus layer', () => {
  it('art < floorFront < overhang; the overhang is below every ui and actors child of the battle', async () => {
    const root = new Container();
    const layers = BattleLayers.of(root);
    const v = await horizon();
    layers.colossus.addChild(v.root);
    layers.ui.addChild(new Container());
    layers.actors.addChild(new Container());
    const order = [root, ...descendants(root, (c): c is Container => c instanceof Container)];
    const hand = v.layerNode('hand')!;
    expect(v.root.children).toEqual([v.art, v.floorFront, v.over]);
    expect(order.indexOf(hand)).toBeGreaterThan(order.indexOf(v.floorFront));
    expect(order.indexOf(v.layerNode('body')!)).toBeLessThan(order.indexOf(v.floorFront));
    for (const c of [...layers.ui.children, ...layers.actors.children]) expect(order.indexOf(hand)).toBeLessThan(order.indexOf(c));
  });
});

describe('the reveal pan (A2, R13)', () => {
  it('at the first pan frame the hand is inside the field; at the last it lies on the rim', async () => {
    const v = await horizon();
    const f = fixtureIndex().forms[HORIZON];
    const first = panAt(0, PAN_FRAMES, PAN_FROM, 'out');
    expect(first).toEqual({ x: 0, y: -60 });
    v.setPan(first.x, first.y);
    const hb = v.layerNode('hand')!.getBounds();
    expect(hb.y).toBeGreaterThanOrEqual(120);
    expect(hb.y + hb.height).toBeLessThanOrEqual(780);
    expect(hb.x).toBeGreaterThanOrEqual(0);
    expect(hb.x + hb.width).toBeLessThanOrEqual(1920);
    const last = panAt(PAN_FRAMES, PAN_FRAMES, PAN_FROM, 'out');
    expect(last).toEqual({ x: 0, y: 0 });
    v.setPan(last.x, last.y);
    expect(v.rimY()).toBe(370);
    expect(v.rimY()).toBe(f.floor?.y ?? 370);
    const rest = v.layerNode('hand')!.getBounds();
    expect(rest.y).toBeLessThan(370);
    expect(rest.y + rest.height).toBeGreaterThan(370);
  });
});

describe('tiles (4.2: a layer wider than 2048 px)', () => {
  it('the wide fixture body is two tiles that abut with no gap or overlap', async () => {
    const f = fixtureIndex().forms[WIDE];
    const v = new ColossusView(WIDE, f, await fixtureArt([WIDE]));
    const body = v.layerNode('body')!;
    const [a, b] = body.children.flatMap((c) => c.children);
    expect(a.getBounds().width).toBe(2048);
    expect(a.getBounds().x + a.getBounds().width).toBe(b.getBounds().x);
    expect(a.getBounds().y).toBe(b.getBounds().y);
    expect(a.getBounds().width + b.getBounds().width).toBe(2600);
  });
});
