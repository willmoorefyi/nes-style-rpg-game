import { describe, it, expect, vi, afterEach } from 'vitest';
import { Assets, BindGroup, Container, Mesh, Texture, type Renderer, type TextureSource } from 'pixi.js';
import { createFlightRenderer, type FlightFrame } from '../../../src/scenes/exploration/mode7/FlightRenderer.js';
import { releaseMeshTextures } from '../../../src/scenes/exploration/mode7/meshRelease.js';
import { FLIGHT_VIEW } from '../../../src/scenes/exploration/mode7/mode7Tilt.js';
import type { MapData } from '../../../src/types/index.js';
import { SIDE_RIGHT } from '../../../src/scenes/exploration/airshipHeading.js';

/**
 * FX-S: the crash "Cannot read properties of null (reading '0')" on a scene change or a teleport mid-flight. Pixi 8
 * draws every unbatched mesh without a shader of its own (the ground strips) through ONE shared shader of the mesh
 * pipe; its bind group listens to the last texture source set and destroys itself when that source is destroyed. The
 * flight view's drop destroyed the far atlas and the near detail right after the strips drew them, so the next strip
 * drawn (the next flight) threw in `BindGroup.setResource`, every frame.
 *
 * The stub renderer below binds each drawn unbatched mesh's texture as `GlMeshAdaptor`
 * does (into a real Pixi `BindGroup`), so the real bind-group teardown runs here without a GPU.
 */
function adaptorRenderer() {
  const group = new BindGroup({ 0: Texture.EMPTY.source });
  const shared = {
    get uTexture(): TextureSource { return group.resources[0] as TextureSource; },
    set uTexture(s: TextureSource) { group.setResource(s, 0); },   // what `shader.resources.uTexture = ...` does
  };
  const bind = (c: Container): void => {
    if (!c.visible) return;
    if (c instanceof Mesh && !c.batched) shared.uTexture = c.texture.source;   // GlMeshAdaptor.execute
    for (const child of c.children) bind(child);
  };
  return { shared, render: vi.fn(({ container }: { container: Container }) => bind(container)) };
}

function world(): MapData {
  return {
    id: 'overworld', width: 16, height: 16, layers: [], tilesets: [], npcs: [], transitions: [],
    art: { tile: 48, chunk: 16, below: ['assets/maps/ai/overworld/below_0_0.png'], above: [null], patches: {} },
  } as unknown as MapData;
}

function frame(): FlightFrame {
  return { view: { ...FLIGHT_VIEW, px: 8.5, py: 8.5 }, near: null, chunks: null, marker: null,
    shadow: { x: 960, y: 700, scale: 48 }, props: [],
    ship: { x: 960, footY: 750, heading: { ...SIDE_RIGHT, seenDir: 'right', seenMoving: false }, tMs: 0, sinceBoard: 1000 } } as unknown as FlightFrame;
}

/** One flight: load (the atlas over stubbed assets), draw, render the view; returns the renderer to drop. */
async function fly(gl: ReturnType<typeof adaptorRenderer>, parent: Container) {
  const r = createFlightRenderer({ parent, at: 0, map: world(), profile: 'full', webgl2: false,
    renderer: gl as unknown as Renderer, hasFlag: () => false });
  await r.load();
  r.setVisible(true);
  r.draw(frame());
  gl.render({ container: parent });
  return r;
}

describe('FX-S: the flight view torn down mid-flight', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('the stub reproduces Pixi: freeing the texture the shared mesh shader holds breaks the next mesh draw', () => {
    const gl = adaptorRenderer();
    const tex = Texture.from({ resource: new Uint8Array(4), width: 1, height: 1 } as never);
    gl.shared.uTexture = tex.source;
    tex.destroy(true);
    expect(() => { gl.shared.uTexture = Texture.WHITE.source; }).toThrow(/reading '0'/);
  });

  it('a second flight after a dropped one draws (the scene change and the teleport crash)', async () => {
    vi.spyOn(Assets, 'load').mockImplementation((async (url: string) => (String(url).endsWith('.json')
      ? { version: 1, cellPx: 4, size: 64, lowCellPx: 2, lowSize: 32, inputs: 'x' } : Texture.EMPTY)) as never);
    vi.spyOn(Assets, 'unload').mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no vehicle sheet in tests'); }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error');
    const gl = adaptorRenderer();
    const parent = new Container();
    const first = await fly(gl, parent);
    expect(gl.shared.uTexture).not.toBe(Texture.EMPTY.source);   // the strips' texture is bound
    first.destroy();                                                         // the scene exits (or the map changes)
    expect(gl.shared.uTexture).toBe(Texture.EMPTY.source);         // released before the textures went
    const second = await fly(gl, parent);                                    // threw "reading '0'" before FX-S
    second.destroy();
    expect(error).not.toHaveBeenCalled();
  });

  it('releaseMeshTextures does nothing without a renderer (the mock games)', () => {
    expect(() => releaseMeshTextures(null)).not.toThrow();
    expect(() => releaseMeshTextures({} as never)).not.toThrow();
  });
});
