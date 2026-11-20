/**
 * The Mode 7 ground as scanline strips (docs/MODE7_PLAN.md 2.3, R5): one `Mesh` of fixed row quads, one per screen
 * row, whose UVs (and, for rows that miss the ground, collapsed positions) are rewritten from the pure row table each
 * update and re-uploaded with `buffer.update()`. M7-0 builds the far mesh only (the whole ground from the atlas); the
 * near mesh and the 8 seam meshes come in M7-3.
 */
import { Mesh, MeshGeometry, type Texture } from 'pixi.js';
import { SCREEN_H, SCREEN_W, fillStrips, rowTable, type RowTable, type ViewParams } from './mode7Math.js';

/** Index buffer of `rows` quads (two triangles each over the 4 vertices of `fillStrips`). */
export function quadIndices(rows: number): Uint32Array {
  const out = new Uint32Array(rows * 6);
  for (let r = 0; r < rows; r++) {
    const v = r * 4;
    out.set([v, v + 1, v + 2, v, v + 2, v + 3], r * 6);
  }
  return out;
}

export class GroundStrips {
  readonly far: Mesh;
  private readonly geometry: MeshGeometry;
  private readonly positions: Float32Array;
  private readonly uvs: Float32Array;
  private uploads = 0;

  constructor(texture: Texture, private readonly mapW: number, private readonly mapH: number,
    private readonly rows = SCREEN_H, private readonly width = SCREEN_W) {
    this.positions = new Float32Array(rows * 8);
    this.uvs = new Float32Array(rows * 8);
    this.geometry = new MeshGeometry({ positions: this.positions, uvs: this.uvs, indices: quadIndices(rows) });
    this.far = new Mesh({ geometry: this.geometry, texture });
    // 4320 vertices: never batched, so the texture's own style (mips, anisotropy) samples it
    this.geometry.batchMode = 'no-batch';
  }

  /** How many times the buffers were uploaded (the pilot's dynamic-buffer check reads it). */
  get uploadCount(): number { return this.uploads; }

  /** Rewrite and upload both buffers for view `p`; returns the row table it drew. */
  update(p: ViewParams): RowTable {
    const table = rowTable(p, this.rows);
    fillStrips(p, table, 0, this.rows, this.mapW, this.mapH, this.positions, this.uvs, this.width);
    this.geometry.getBuffer('aPosition').update();
    this.geometry.getBuffer('aUV').update();
    this.uploads++;
    return table;
  }

  destroy(): void {
    this.far.destroy();
    this.geometry.destroy();
  }
}
