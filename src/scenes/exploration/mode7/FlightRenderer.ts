/**
 * The Pixi part of the flight view (docs/MODE7_PLAN.md 8), loaded lazily by `FlightView` on the world map: it makes
 * its own container and inserts it into the scene with `parent.addChildAt(container, at)` (between the world and the
 * UI), and owns the sky, the ground strips over the far atlas (`WorldAtlas`) and the billboards. `load` rejects on a
 * missing or broken atlas; the view then falls back to top-down (7). `destroy` removes it all.
 *
 * Draw order: the sky, the far mesh, the 8 seam rows, the near mesh (from `NearDetail`, over the streamed chunks of
 * the flight window), the fog, the billboards.
 * M7-5: the sky's clouds draw over the sky; the parked vehicles and the NPCs are billboards, depth-sorted with the ship.
 */
import { Container, type Renderer } from 'pixi.js';
import type { MapData } from '../../../types/index.js';
import { FOG_ROWS, FlightSky } from './FlightSky.js';
import { GroundStrips } from './GroundStrips.js';
import { WorldAtlas, type AtlasProfile } from './WorldAtlas.js';
import { FlightBillboards, type BillboardFrame } from './FlightBillboards.js';
import { NearDetail } from './NearDetail.js';
import { nearProfile, type ChunkHost, type NearWindow } from './FlightStream.js';
import { horizonY, type ViewParams } from './mode7Math.js';
import { watchFlightContext, type ContextEvent } from './FlightContext.js';

export interface FlightRendererOptions {
  parent: Container;
  at: number;
  map: MapData;
  profile: AtlasProfile;
  webgl2: boolean;
  renderer: Renderer;
  hasFlag: (flag: string) => boolean;
  /** The WebGL context was lost, restored and redrawn, or could not be redrawn (M7-6, 7). */
  onContext?: (event: ContextEvent, err?: unknown) => void;
}

export interface FlightFrame extends BillboardFrame {
  view: ViewParams;
  /** The near window (null: no streamed chunks, the far mesh draws all) and the map's chunks. */
  near: NearWindow | null;
  chunks: ChunkHost | null;
}

export class FlightRenderer {
  readonly container = new Container();
  private atlas: WorldAtlas | null = null;
  private sky: FlightSky | null = null;
  private strips: GroundStrips | null = null;
  private billboards: FlightBillboards | null = null;
  private near: NearDetail | null = null;
  private horizon = -1;
  private fogY = NaN;
  private destroyed = false;
  private readonly unwatch: () => void;

  constructor(private readonly opts: FlightRendererOptions) {
    this.container.label = 'mode7';
    this.container.visible = false;
    opts.parent.addChildAt(this.container, Math.min(opts.at, opts.parent.children.length));
    this.unwatch = watchFlightContext(opts.renderer?.canvas, () => this.restore(),
      (event, err) => opts.onContext?.(event, err));
  }

  /** After a context restore the render textures are blank: the atlas reloads its freed source and recomposes, and
   *  the near detail redraws its whole window at the next draw. Rejects when the atlas cannot be reloaded. */
  async restore(): Promise<void> {
    if (this.destroyed || !this.atlas?.texture) return;   // not loaded yet: the load composes after the restore
    await this.atlas.restore();
    this.near?.invalidate();
  }

  /** The atlas (composed, its source freed) and the vehicle sheet; rejects when the atlas is missing. */
  async load(): Promise<void> {
    const { map } = this.opts;
    this.atlas = new WorldAtlas({ map, profile: this.opts.profile, webgl2: this.opts.webgl2,
      renderer: this.opts.renderer, hasFlag: this.opts.hasFlag });
    const billboards = new FlightBillboards();
    await Promise.all([this.atlas.load(), billboards.load()]).catch((err: unknown) => {
      billboards.destroy();
      throw err;
    });
    const texture = this.atlas.texture;
    if (this.destroyed || !texture) {
      billboards.destroy();
      if (this.destroyed) return;
      throw new Error('Mode 7: the far atlas did not compose');
    }
    this.sky = new FlightSky();
    this.near = map.art ? new NearDetail({ renderer: this.opts.renderer, map, atlas: this.atlas,
      prof: nearProfile(this.opts.profile), hasFlag: this.opts.hasFlag }) : null;
    this.strips = new GroundStrips(texture, map.width, map.height, this.near?.texture ?? null);
    this.billboards = billboards;
    this.container.addChild(this.sky.view, this.sky.clouds, this.strips.view, this.sky.fog, billboards.container);
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  /** The resident textures this view adds (the report): the atlas's and the near detail's sizes and cell px, and
   *  the near detail's redraws. */
  get textures(): Record<string, number> | null {
    const tex = this.atlas?.texture;
    const n = this.near;
    return tex ? { atlas: tex.width, cellPx: this.atlas?.cellPx ?? 0, near: n?.size ?? 0, nearCellPx: n?.cellPx ?? 0,
      recentres: n?.recentres ?? 0, lateDraws: n?.lateDraws ?? 0, split: this.strips?.split ?? 0,
      props: this.billboards?.props.drawn ?? 0 } : null;
  }

  /** The last draw drew into a render texture (a recentre or a late chunk): an upload frame, out of the p95s. */
  get heavy(): boolean { return !!this.near?.heavy; }

  /** One flight frame: the atlas's patches, the strips' UVs, the sky down to the horizon, the billboards. */
  draw(frame: FlightFrame): void {
    if (!this.strips || !this.sky || !this.billboards) return;
    this.atlas?.update();
    const near = this.near && frame.near && frame.chunks ? frame.near : null;
    if (near && frame.chunks) this.near?.update(near, frame.chunks);
    else if (this.near) this.near.heavy = false;
    const table = this.strips.update(frame.view, near);
    if (table.firstRow !== this.horizon) {
      this.horizon = table.firstRow;
      this.sky.draw(table.firstRow);
    }
    // the fog follows the horizon, above the screen too while a tilt looks down (4.3): off screen at its start
    const fogY = table.firstRow > 0 ? table.firstRow : Math.max(-FOG_ROWS, Math.min(0, horizonY(frame.view)));
    if (fogY !== this.fogY) {
      this.fogY = fogY;
      this.sky.placeFog(fogY);
    }
    this.sky.drift(frame.ship.tMs, frame.view.px, horizonY(frame.view));
    this.billboards.draw(frame);
  }

  destroy(): void {
    this.destroyed = true;
    this.unwatch();
    this.strips?.destroy();
    this.sky?.destroy();
    this.billboards?.destroy();
    this.near?.destroy();
    this.atlas?.destroy();
    this.container.destroy({ children: true });
    this.strips = null;
    this.sky = null;
    this.billboards = null;
    this.near = null;
    this.atlas = null;
  }
}

export function createFlightRenderer(opts: FlightRendererOptions): FlightRenderer {
  return new FlightRenderer(opts);
}
