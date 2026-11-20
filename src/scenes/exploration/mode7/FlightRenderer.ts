/**
 * The Pixi part of the flight view (docs/MODE7_PLAN.md 8), loaded lazily by `FlightView` on the world map: it makes
 * its own container and inserts it into the scene with `parent.addChildAt(container, at)` (between the world and the
 * UI), and owns the sky, the ground strips over the far atlas (`WorldAtlas`) and the billboards. `load` rejects on a
 * missing or broken atlas; the view then falls back to top-down (7). `destroy` removes it all.
 *
 * M7-2 draws the far mesh only, over the whole ground; the near detail, its seam and the fog come in M7-3.
 */
import { Container, type Renderer } from 'pixi.js';
import type { MapData } from '../../../types/index.js';
import { FlightSky } from './FlightSky.js';
import { GroundStrips } from './GroundStrips.js';
import { WorldAtlas, type AtlasProfile } from './WorldAtlas.js';
import { FlightBillboards, type BillboardFrame } from './FlightBillboards.js';
import type { ViewParams } from './mode7Math.js';

export interface FlightRendererOptions {
  parent: Container;
  at: number;
  map: MapData;
  profile: AtlasProfile;
  webgl2: boolean;
  renderer: Renderer;
  hasFlag: (flag: string) => boolean;
}

export interface FlightFrame extends BillboardFrame {
  view: ViewParams;
}

export class FlightRenderer {
  readonly container = new Container();
  private atlas: WorldAtlas | null = null;
  private sky: FlightSky | null = null;
  private strips: GroundStrips | null = null;
  private billboards: FlightBillboards | null = null;
  private horizon = -1;
  private destroyed = false;

  constructor(private readonly opts: FlightRendererOptions) {
    this.container.label = 'mode7';
    this.container.visible = false;
    opts.parent.addChildAt(this.container, Math.min(opts.at, opts.parent.children.length));
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
    this.strips = new GroundStrips(texture, map.width, map.height);
    this.billboards = billboards;
    this.container.addChild(this.sky.view, this.strips.far, billboards.container);
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  /** The resident textures this view adds (the report): the atlas size and its cell px. */
  get textures(): { atlas: number; cellPx: number } | null {
    const tex = this.atlas?.texture;
    return tex ? { atlas: tex.width, cellPx: this.atlas?.cellPx ?? 0 } : null;
  }

  /** One flight frame: the atlas's patches, the strips' UVs, the sky down to the horizon, the billboards. */
  draw(frame: FlightFrame): void {
    if (!this.strips || !this.sky || !this.billboards) return;
    this.atlas?.update();
    const table = this.strips.update(frame.view);
    if (table.firstRow !== this.horizon) {
      this.horizon = table.firstRow;
      this.sky.draw(table.firstRow);
    }
    this.billboards.draw(frame);
  }

  destroy(): void {
    this.destroyed = true;
    this.strips?.destroy();
    this.sky?.destroy();
    this.billboards?.destroy();
    this.atlas?.destroy();
    this.container.destroy({ children: true });
    this.strips = null;
    this.sky = null;
    this.billboards = null;
    this.atlas = null;
  }
}

export function createFlightRenderer(opts: FlightRendererOptions): FlightRenderer {
  return new FlightRenderer(opts);
}
