import { describe, it, expect, vi } from 'vitest';
import { Texture, TextureSource } from 'pixi.js';
import { OpeningSequence, DIM_TINT, playOpening } from '../../src/scenes/partyCreation/OpeningSequence.js';
import { GameFlags } from '../../src/core/GameFlags.js';

const texture = (): Texture => new Texture({ source: new TextureSource({ width: 1920, height: 1080 }) });

describe('U16: the opening dims its first backdrop', () => {
  it("backdrop('dark_forest', { dim: 0.35 }) lays a black overlay of alpha 0.65 over a cool-tinted sprite", async () => {
    const load = vi.fn(async () => texture());
    const opening = new OpeningSequence(load);
    await opening.showBackdrop('dark_forest', { dim: 0.35 });
    expect(load).toHaveBeenCalledWith('assets/backgrounds/dark_forest.webp');
    expect(opening.backdropDimAlpha).toBeCloseTo(0.65, 5);
    const sprite = opening.layer.children[0].children[0] as unknown as { tint: number };
    expect(sprite.tint).toBe(DIM_TINT);
  });

  it("backdrop('grassland') adds no overlay and no tint", async () => {
    const opening = new OpeningSequence(async () => texture());
    await opening.showBackdrop('dark_forest', { dim: 0.35 });
    await opening.showBackdrop('grassland');
    expect(opening.backdropDimAlpha).toBe(0);
    expect(opening.layer.children[0].children).toHaveLength(1);
    const sprite = opening.layer.children[0].children[0] as unknown as { tint: number };
    expect(sprite.tint).toBe(0xffffff);
  });

  it("the cutscene's backdrop step hands its dim to the opening's backdrop", async () => {
    const backdrop = vi.fn(async () => undefined);
    await playOpening({
      showDialog: async () => undefined, fadeOut: async () => undefined, fadeIn: async () => undefined,
      backdrop, flags: new GameFlags(), party: [],
    }, [{ type: 'backdrop', image: 'dark_forest', dim: 0.35 }, { type: 'backdrop', image: null }]);
    expect(backdrop).toHaveBeenNthCalledWith(1, 'dark_forest', { dim: 0.35 });
  });
});
