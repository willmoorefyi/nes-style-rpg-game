/**
 * WR fix 1 (docs/WORLD_WRAP_PLAN.md 5, D-WR-9): a parked vehicle across the seam. WrapImages skips every part
 * FieldVehicleSprites owns (`vehicleParts`); `placeParked` runs from `onRender`, after `apply`, and adds the scene's
 * wrap offset, so the ship draws at its image, `restore` leaves it where `placeParked` put it (nothing is
 * double-subtracted), and the next frame's `apply` plus `onRender` is the same.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { Container } from 'pixi.js';
import { TILE_SIZE } from '../../../src/core/LayoutConstants.js';
import {
  FieldVehicleSprites, setVehicleWrapOffset, vehicleParts,
} from '../../../src/scenes/exploration/FieldVehicleSprites.js';
import { WrapImages } from '../../../src/rendering/wrapImages.js';
import { nearestImage } from '../../../src/systems/worldWrap.js';

const W = 256;
const P = W * TILE_SIZE;

afterEach(() => setVehicleWrapOffset(null));

describe('WR: a parked ship across the seam', () => {
  it('draws at its image after apply and onRender; restore leaves it; the next frame is the same', () => {
    const world = new Container();
    const sprites = new FieldVehicleSprites(world, () => 0, () => Promise.reject(new Error('no sheet in this test')));
    const cam = { x: 250 * TILE_SIZE, y: 100 * TILE_SIZE, w: 20 * TILE_SIZE, h: 11 * TILE_SIZE };
    setVehicleWrapOffset((x, y) => ({ dx: nearestImage(x, cam.x + cam.w / 2, P) - x,
      dy: nearestImage(y, cam.y + cam.h / 2, P) - y }));
    sprites.showParked([{ type: 'ship', map: 'overworld', x: 2, y: 105 }]);
    const main = sprites.views.parked[0].main;
    expect(vehicleParts.has(main)).toBe(true);
    const wrap = new WrapImages();
    const render = (): number => {
      wrap.apply(world, { x: cam.x, y: cam.y, width: cam.w, height: cam.h }, { x: P, y: P }, (c) => vehicleParts.has(c));
      main.onRender?.(undefined as never);   // as Pixi does at render, after apply
      return main.x;
    };
    const first = render();
    expect(first).toBe((W + 2) * TILE_SIZE + TILE_SIZE / 2);   // the image east of the camera, not x 2
    wrap.restore();
    expect(main.x).toBe(first);
    expect(render()).toBe(first);
    // the camera crosses back west of the seam: the canonical image again
    cam.x = 0;
    expect(render()).toBe(2 * TILE_SIZE + TILE_SIZE / 2);
  });

  it('a flat map (no offset) draws the parked ship at its own cell', () => {
    const world = new Container();
    const sprites = new FieldVehicleSprites(world, () => 0, () => Promise.reject(new Error('no sheet in this test')));
    sprites.showParked([{ type: 'ship', map: 'overworld', x: 2, y: 105 }]);
    const main = sprites.views.parked[0].main;
    main.onRender?.(undefined as never);
    expect(main.x).toBe(2 * TILE_SIZE + TILE_SIZE / 2);
  });
});
