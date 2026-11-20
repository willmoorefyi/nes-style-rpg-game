/**
 * The flight view's sprites (docs/MODE7_PLAN.md 5): the airship, screen-fixed, with b_7's side view for every heading
 * (D-M9), the ridden bob and the take-off lift; its shadow, an ellipse on the ground under the ship's position P,
 * scaled by that row's px per cell; and the landing marker, a thin white outline of the hero's cell while it may land
 * there; and (M7-5) the parked vehicles and the world-map NPCs, upright billboards (`FlightProps`). The container
 * sorts by depth (px per cell at the ground point, larger nearer): a billboard whose ground point lies nearer than the
 * ship's position P draws in front of the airship, one farther behind it and its shadow.
 */
import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from '../../../core/LayoutConstants.js';
import { defaultLoad, vehicleArt } from '../FieldVehicleSprites.js';
import { VehicleView, type VehicleArt } from '../FieldVehicleView.js';
import { AIRSHIP_LIFT, airshipShadow, nativeScale } from '../vehicleLayout.js';
import { cellToScreen, type ViewParams } from './mode7Math.js';
import type { PropSource } from './propMath.js';
import { FlightProps } from './FlightProps.js';

/** The airship hull's native width when the sheet is missing (b_7 is 147 px wide). */
const HULL_W = 147;
const MARKER_COLOR = 0xffffff;

export interface ShipDraw {
  /** The hull's centre x and its foot row once lifted, screen px. */
  x: number;
  footY: number;
  facing: 'left' | 'right';
  tMs: number;
  /** ms since take-off (the 400 ms lift). */
  sinceBoard: number;
}

export interface BillboardFrame {
  ship: ShipDraw;
  /** The ground point under P and its px per cell. */
  shadow: { x: number; y: number; scale: number };
  /** The landing cell's 4 corners on screen, or null when the ship may not land. */
  marker: Array<{ x: number; y: number }> | null;
  view: ViewParams;
  /** The upright billboards (propMath.propSources); none when missing. */
  props?: readonly PropSource[];
}

/** The shadow and the marker sort just behind P's depth, the airship just in front of it (a billboard at P's depth
 *  stands over the shadow, under the ship). */
const GROUND_Z = -2e-6;
const SHIP_Z = 1e-6;

export class FlightBillboards {
  readonly container = new Container();
  private readonly shadow = new Graphics();
  private readonly marker = new Graphics();
  private ship: VehicleView | null = null;
  private readonly k = nativeScale(TILE_SIZE);
  readonly props = new FlightProps(this.container);

  constructor() {
    this.container.label = 'mode7:billboards';
    this.container.sortableChildren = true;
    this.container.addChild(this.marker, this.shadow);
  }

  /** Load the vehicle sheet (shared with the field); a failure keeps the tinted placeholder hull. */
  async load(): Promise<void> {
    let art: VehicleArt | null = null;
    try {
      const [meta, sheet] = await defaultLoad();
      art = vehicleArt(meta, sheet);
    } catch (err) {
      console.warn('Mode 7: the vehicle sheet failed to load; a placeholder airship flies', err);
    }
    this.ship = new VehicleView('airship', art);
    this.container.addChild(this.ship.main);
    const s = airshipShadow(this.ship.frame?.w ?? HULL_W, 'ridden');
    // the top-down shadow's size at TILE_SIZE px per cell; scaled per frame by the row's px per cell
    this.shadow.ellipse(0, 0, (s.w * this.k) / 2, (s.h * this.k) / 2).fill({ color: 0x000000, alpha: s.alpha });
  }

  draw(f: BillboardFrame): void {
    const depth = cellToScreen(f.view, f.view.px, f.view.py)?.scale ?? f.shadow.scale;
    this.shadow.zIndex = depth + GROUND_Z;
    this.marker.zIndex = depth + GROUND_Z;
    this.props.draw(f.view, f.props ?? []);
    this.shadow.position.set(f.shadow.x, f.shadow.y);
    this.shadow.scale.set(f.shadow.scale / TILE_SIZE);
    this.ship?.place({ footX: f.ship.x, footY: f.ship.footY + AIRSHIP_LIFT * this.k, facing: f.ship.facing,
      pose: 'ridden', tMs: f.ship.tMs, sinceBoard: f.ship.sinceBoard, z: 0 });
    if (this.ship) this.ship.main.zIndex = depth + SHIP_Z;   // `place` puts a flying hull at FLYING_Z
    this.marker.clear();
    this.marker.visible = !!f.marker;
    if (f.marker) this.marker.poly(f.marker.flatMap((p) => [p.x, p.y])).stroke({ color: MARKER_COLOR, width: 2, alpha: 0.9 });
  }

  destroy(): void {
    this.ship?.shadow?.destroy();   // the view's own top-down shadow, never attached here
    this.container.destroy({ children: true });
    this.ship = null;
  }
}
