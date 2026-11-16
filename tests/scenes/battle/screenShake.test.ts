/**
 * Pass F item 7 (docs/FEEDBACK_PLAN_2026-11-14.md §3.7): the heavy slam's screen shake. 8 frames within [-6, 6],
 * decaying to 0; it moves `actors`, `fx` and (pass C, docs/CHAOS_FORMS_PLAN.md 4.1) `colossus`, never `bg`, `ui`
 * or `hud`. Old code: no shake.
 */
import { describe, it, expect } from 'vitest';
import { Container } from 'pixi.js';
import { ScreenShake, SHAKE_FRAMES, SHAKE_PX } from '../../../src/scenes/battle/screenShake.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';

describe('ScreenShake', () => {
  it('offsets stay in [-6, 6], the amplitude decays, and it is 0 from frame 8 on', () => {
    const s = new ScreenShake();
    expect(s.offset()).toEqual({ x: 0, y: 0 });
    s.start();
    const xs: number[] = [];
    for (let f = 0; f < SHAKE_FRAMES + 4; f++) {
      const o = s.offset();
      expect(Math.abs(o.x)).toBeLessThanOrEqual(SHAKE_PX);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(SHAKE_PX);
      xs.push(o.x);
      s.update(1);
    }
    expect(Math.abs(xs[0])).toBe(SHAKE_PX);
    for (let f = 1; f < SHAKE_FRAMES; f++) expect(Math.abs(xs[f])).toBeLessThanOrEqual(Math.abs(xs[f - 1]));
    expect(xs.slice(SHAKE_FRAMES)).toEqual([0, 0, 0, 0]);
    expect(new Set(xs.slice(0, 4).map(Math.sign))).toEqual(new Set([1, -1]));
    expect(s.active).toBe(false);
  });

  it('step mode (dt 0) holds the offset; a restart begins again at full size', () => {
    const s = new ScreenShake();
    s.start();
    s.update(3);
    const held = s.offset();
    s.update(0);
    expect(s.offset()).toEqual(held);
    s.start();
    expect(Math.abs(s.offset().x)).toBe(SHAKE_PX);
  });
});

describe('BattleLayers applies the shake to actors, fx and colossus only', () => {
  it('ui, hud and bg never move; actors, fx and colossus move together and return to 0', () => {
    const layers = BattleLayers.of(new Container());
    layers.shake.start();
    let moved = 0;
    for (let f = 0; f < SHAKE_FRAMES + 3; f++) {
      layers.update(1);
      if (layers.actors.x !== 0 || layers.actors.y !== 0) moved++;
      expect({ x: layers.fx.x, y: layers.fx.y }).toEqual({ x: layers.actors.x, y: layers.actors.y });
      expect({ x: layers.colossus.x, y: layers.colossus.y }).toEqual({ x: layers.actors.x, y: layers.actors.y });
      for (const still of [layers.ui, layers.hud, layers.bg]) expect(still.position).toMatchObject({ x: 0, y: 0 });
    }
    expect(moved).toBeGreaterThanOrEqual(SHAKE_FRAMES - 1);
    expect(layers.actors.position).toMatchObject({ x: 0, y: 0 });
    expect(layers.fx.position).toMatchObject({ x: 0, y: 0 });
    expect(layers.colossus.position).toMatchObject({ x: 0, y: 0 });
  });

  it('BattleLayers.containing finds the layers from an actor sprite', () => {
    const root = new Container();
    const layers = BattleLayers.of(root);
    const sprite = new Container();
    layers.actors.addChild(sprite);
    expect(BattleLayers.containing(sprite)).toBe(layers);
    expect(BattleLayers.containing(new Container())).toBeNull();
  });
});
