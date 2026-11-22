/**
 * The Mode 7 ground as scanline strips (docs/MODE7_PLAN.md 2.3, 2.5, R5): fixed row quads, one per screen row, whose
 * UVs (and, for rows that do not draw, collapsed positions) are rewritten from the pure row table each update and
 * re-uploaded with `buffer.update()`. Three parts, one texture and one `alpha` each (Pixi 8's mesh shader has no
 * vertex alpha):
 * - the far mesh: the rows farther than the split, from the far atlas (the whole map);
 * - the near mesh: the rows from the split down, from the near detail (the window's square);
 * - 8 one-row seam meshes just above the split, from the near detail at alpha 1/9 to 8/9, over the far mesh.
 * Without a near window (no streamed chunks) the far mesh draws every row.
 */
import { Container, Mesh, MeshGeometry, type Texture } from 'pixi.js';
import { SCREEN_H, SCREEN_W, collapseRows, fillStrips, nearSplit, rowFits, rowOffMap, rowTable, type RowTable,
  type ViewParams } from './mode7Math.js';

/** One-row seam meshes between the far and the near ground (2.5). */
export const SEAM_ROWS = 8;

/** Index buffer of `rows` quads (two triangles each over the 4 vertices of `fillStrips`). */
export function quadIndices(rows: number): Uint32Array {
  const out = new Uint32Array(rows * 6);
  for (let r = 0; r < rows; r++) {
    const v = r * 4;
    out.set([v, v + 1, v + 2, v, v + 2, v + 3], r * 6);
  }
  return out;
}

/** Where the near texture covers: its square's origin and side in cells, and the split distance. */
export interface NearSquare { x0: number; y0: number; cells: number; dSplit: number }

class Strip {
  readonly mesh: Mesh;
  readonly positions: Float32Array;
  readonly uvs: Float32Array;
  private readonly geometry: MeshGeometry;

  constructor(texture: Texture, readonly rows: number) {
    this.positions = new Float32Array(rows * 8);
    this.uvs = new Float32Array(rows * 8);
    this.geometry = new MeshGeometry({ positions: this.positions, uvs: this.uvs, indices: quadIndices(rows) });
    this.mesh = new Mesh({ geometry: this.geometry, texture });
    // never batched, so the texture's own style (mips, anisotropy, nearest) samples it
    this.geometry.batchMode = 'no-batch';
  }

  upload(): void {
    this.geometry.getBuffer('aPosition').update();
    this.geometry.getBuffer('aUV').update();
  }

  destroy(): void {
    this.mesh.destroy();
    this.geometry.destroy();
  }
}

export class GroundStrips {
  /** The meshes in draw order (far, seams, near), in one container. */
  readonly view = new Container();
  private readonly farStrip: Strip;
  private readonly nearStrip: Strip | null;
  private readonly seams: Strip[] = [];
  private uploads = 0;
  /** The near mesh's first row of the last update (`rows` when the near mesh draws nothing). */
  split: number;

  constructor(texture: Texture, private readonly mapW: number, private readonly mapH: number,
    near: Texture | null = null, private readonly rows = SCREEN_H, private readonly width = SCREEN_W,
    private readonly wrap = false) {
    this.split = rows;
    this.farStrip = new Strip(texture, rows);
    this.view.addChild(this.farStrip.mesh);
    this.nearStrip = near ? new Strip(near, rows) : null;
    if (!near || !this.nearStrip) return;
    for (let k = 1; k <= SEAM_ROWS; k++) {
      const seam = new Strip(near, 1);
      seam.mesh.alpha = k / (SEAM_ROWS + 1);
      this.seams.push(seam);
      this.view.addChild(seam.mesh);
    }
    this.view.addChild(this.nearStrip.mesh);
  }

  /** The far mesh (the pilot draws it alone). */
  get far(): Mesh { return this.farStrip.mesh; }

  /** How many times the buffers were uploaded (the pilot's dynamic-buffer check reads it). */
  get uploadCount(): number { return this.uploads; }

  /** Rewrite and upload the buffers for view `p` and the near square (none: the far mesh draws all); the table drawn. */
  update(p: ViewParams, sq: NearSquare | null = null): RowTable {
    const table = rowTable(p, this.rows);
    const { rows, width } = this;
    const far = this.farStrip;
    fillStrips(p, table, 0, rows, this.mapW, this.mapH, far.positions, far.uvs, width);
    const near = this.nearStrip;
    const map = { w: this.mapW, h: this.mapH, wrap: this.wrap };   // WR: a wrapped map has no open sides
    this.split = near && sq ? nearSplit(p, table, sq.dSplit, sq.x0, sq.y0, sq.cells, rows, width, map) : rows;
    if (near && sq) {
      fillStrips(p, table, 0, rows, sq.cells, sq.cells, near.positions, near.uvs, width, sq.x0, sq.y0);
      collapseRows(near.positions, 0, this.split);
      // below the split the near mesh draws, but a row wholly off the map stays the far atlas's (its softer edge sea)
      for (let r = this.split; r < rows; r++) {
        collapseRows(rowOffMap(p, table, r, map, width) ? near.positions : far.positions, r, r + 1);
      }
      near.upload();
      this.seams.forEach((seam, i) => {
        const r = this.split - SEAM_ROWS + i;   // alpha 1/9 farthest, 8/9 next to the near mesh
        seam.mesh.visible = r >= 0 && this.split < rows && rowFits(p, table, r, sq.x0, sq.y0, sq.cells, width, map);
        if (!seam.mesh.visible) return;
        fillStrips(p, table, r, r + 1, sq.cells, sq.cells, seam.positions, seam.uvs, width, sq.x0, sq.y0);
        seam.upload();
      });
    } else {
      if (near) collapseRows(near.positions, 0, rows);
      for (const seam of this.seams) seam.mesh.visible = false;
      near?.upload();
    }
    far.upload();
    this.uploads++;
    return table;
  }

  destroy(): void {
    this.farStrip.destroy();
    this.nearStrip?.destroy();
    for (const s of this.seams) s.destroy();
    this.view.destroy();
  }
}
