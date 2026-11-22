/**
 * FX-S (the scene-change crash): Pixi 8 draws every unbatched mesh without its own shader (the ground strips) through
 * ONE shared shader of the mesh pipe, whose bind group listens to the last texture source drawn. Destroying that
 * source (the far atlas or the near detail's render texture, when the flight view is dropped) makes the group destroy
 * itself (`BindGroup.onResourceChange` on a destroyed resource), and the next unbatched mesh drawn anywhere throws
 * "Cannot read properties of null (reading '0')" in `BindGroup.setResource`, every frame: the game loop halts.
 *
 * `releaseMeshTextures` draws one unbatched quad of `Texture.EMPTY` into a 1x1 target, which rebinds the shared shader
 * to the empty texture; call it after the meshes are gone and before their textures are destroyed.
 */
import { Mesh, MeshGeometry, RenderTexture, Texture, type Renderer } from 'pixi.js';

/** The part of the renderer this needs (a test's stub renderer may have no `render`). */
export type MeshReleaseRenderer = Pick<Renderer, 'render'> | null | undefined;

export function releaseMeshTextures(renderer: MeshReleaseRenderer): void {
  if (typeof renderer?.render !== 'function') return;
  const geometry = new MeshGeometry({
    positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  geometry.batchMode = 'no-batch';   // the shared mesh shader's path, not the batcher's
  const mesh = new Mesh({ geometry, texture: Texture.EMPTY });
  const target = RenderTexture.create({ width: 1, height: 1 });
  try {
    renderer.render({ container: mesh, target, clear: true });
  } catch (err) {
    console.error('Mode 7: could not release the shared mesh texture before freeing the flight textures', err);
  } finally {
    mesh.destroy();
    geometry.destroy();
    target.destroy(true);
  }
}
