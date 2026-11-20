/**
 * The flight view's states (docs/MODE7_PLAN.md 4.3): pure, no PixiJS.
 *
 * | State     | Drawn              | busy  |
 * |-----------|--------------------|-------|
 * | `off`     | top-down           | false |
 * | `loading` | top-down (flying)  | false |
 * | `tiltIn`  | Mode 7, t 0 -> 1   | true  |
 * | `flying`  | Mode 7             | false |
 * | `tiltOut` | Mode 7, t 1 -> 0   | true  |
 *
 * A tilt lasts `frames` 60 Hz frames of `dt` (M7-4: 42, 700 ms; `t += dt / 42`); `frames` 0 is an instant switch
 * (M7-2's). `tiltParams` gives the view and the ship's spot at a point `t` of the tilt (4.3). `history` lists every
 * state entered, transient ones included, for the tests.
 */
import { AIRSHIP_LIFT, nativeScale } from '../vehicleLayout.js';
import { PILOT_PRESETS, presetView } from './pilotPresets.js';
import type { ViewParams } from './mode7Math.js';

export type TiltState = 'off' | 'loading' | 'tiltIn' | 'flying' | 'tiltOut';
/** Why a flight is waiting in `loading`: a confirm on a parked airship, or a load / retry already in flight. */
export type LoadReason = 'takeoff' | 'restore';

/** A tilt's length: 42 frames of `dt` (700 ms at 60 Hz; Q10's default). */
export const TILT_FRAMES = 42;
export const TILT_MS = (TILT_FRAMES * 1000) / 60;
/** The input hold-off when a tilt ends (= `SCENE_ENTRY_HOLDOFF_FRAMES`, pinned by mode7Tilt.test.ts; not imported, so
 *  this pure module never loads `Game.ts` and PixiJS). */
export const TILT_HOLDOFF_FRAMES = 8;

/** The flight view: the user's pick, preset A "classic" (18 deg, h 6, kappa 1/600, horizon row 390), P on row 820. */
export const FLIGHT_VIEW: ViewParams = presetView(PILOT_PRESETS[0], 0, 0);
/** The airship's foot on screen in flight once lifted (4.2): 70 px above its shadow row. */
export const SHIP_FOOT_Y = 750;
const TOP_DOWN = Math.PI / 2;
const EPS = 1e-6;

/** Where a tilt starts (4.3), read from the live top-down `Camera`: the hero's screen point (the cell centre P;
 *  (960, 480) away from the map edges, off centre where the camera clamps) and the airship's foot on the ground there
 *  (the anchor plus half a tile: where `FieldVehicleSprites` draws it before its lift). */
export interface TiltStart {
  anchor: { x: number; y: number };
  ship: { x: number; y: number };
}

/** One point of a tilt: the view (P at the origin; set `px`, `py`), the ship's ground foot (its lift and bob are
 *  added by the sprite) and where its shadow falls, in cells south of P (the top-down shadow lies on the cell's bottom
 *  edge: half a cell at t = 0, 0 in flight). */
export interface TiltFrame {
  view: ViewParams;
  ship: { x: number; y: number };
  shadowSouth: number;
}

/** The tilt's easing: in-out (a half cosine), 0 at t <= 0 and 1 at t >= 1. */
export function ease(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return (1 - Math.cos(Math.PI * t)) / 2;
}

const mix = (a: number, b: number, e: number): number => a + (b - a) * e;

/**
 * The view at point `t` of a tilt (0 top-down, 1 the flight view), eased: theta 90 deg to 18 deg, kappa 0 to 1/600,
 * h from `f / tileSize` (12.5 at 96 px per cell) to 6, `back` 0 to 11.3, (cx, cy) from the hero's screen point to the
 * flight values, and the ship from its top-down foot to (960, 750) plus its lift. At t = 0 a pinhole looking straight
 * down at a flat plane is a uniform scale of f / h = tileSize px per cell centred on the anchor: exactly the top-down
 * camera's mapping, so the switch from the top-down view is invisible (mode7Tilt.test.ts measures it).
 */
export function tiltParams(t: number, start: TiltStart, tileSize: number, flight: ViewParams = FLIGHT_VIEW,
  shipFootY = SHIP_FOOT_Y): TiltFrame {
  const e = ease(t);
  const view: ViewParams = {
    h: mix(flight.f / tileSize, flight.h, e),
    theta: mix(TOP_DOWN, flight.theta, e),
    f: flight.f,
    cx: mix(start.anchor.x, flight.cx, e),
    cy: mix(start.anchor.y, flight.cy, e),
    kappa: mix(0, flight.kappa, e),
    back: mix(0, flight.back, e),
    px: 0,
    py: 0,
  };
  const lift = AIRSHIP_LIFT * nativeScale(tileSize);
  return { view, ship: { x: mix(start.ship.x, flight.cx, e), y: mix(start.ship.y, shipFootY + lift, e) },
    shadowSouth: mix(0.5, 0, e) };
}

export class TiltMachine {
  private cur: TiltState = 'off';
  private why: LoadReason | null = null;
  private progress = 0;
  readonly history: TiltState[] = ['off'];

  constructor(private readonly frames = TILT_FRAMES) {}

  get state(): TiltState { return this.cur; }
  /** The reason a flight waits in `loading` (null in every other state). */
  get reason(): LoadReason | null { return this.cur === 'loading' ? this.why : null; }
  /** The tilt: 0 top-down, 1 the flight view. */
  get t(): number { return this.progress; }
  /** A tilt is playing: the field holds the hero (4.3). */
  get busy(): boolean { return this.cur === 'tiltIn' || this.cur === 'tiltOut'; }
  /** How many states were entered (a change since the last look means a new state, e.g. a tilt that just began). */
  get entered(): number { return this.history.length; }
  /** Whether the field draws the Mode 7 view (otherwise top-down). */
  get drawn(): boolean { return this.cur === 'tiltIn' || this.cur === 'flying' || this.cur === 'tiltOut'; }

  /** Flight started on the world map: a take-off tilts in, a load or retry starts flying; not ready waits. */
  start(reason: LoadReason, ready: boolean, idle = true): void {
    if (this.cur !== 'off') return;
    if (!ready) {
      this.why = reason;
      this.go('loading');
    } else if (reason === 'restore') {
      this.progress = 1;
      this.go('flying');
    } else if (idle) {
      this.tiltIn();
    } else {
      this.why = reason;
      this.go('loading');
    }
  }

  /** The party landed: a drawn flight tilts out; a top-down one (`loading`) just ends. */
  land(): void {
    if (this.cur === 'flying' || this.cur === 'tiltIn') {
      this.go('tiltOut');
      this.advance(0);
    } else if (this.cur === 'loading') {
      this.end();
    }
  }

  /** A map change, a warp, a failure or any other way out of the airship: off at once, no tilt. */
  end(): void {
    this.progress = 0;
    this.why = null;
    if (this.cur !== 'off') this.go('off');
  }

  /** One frame: `loading` waits for `ready` (a take-off also for an idle hero); a tilt advances by `dt / frames`. */
  tick(dt: number, ready: boolean, idle: boolean): void {
    if (this.cur === 'loading' && ready) {
      if (this.why === 'restore') {
        this.why = null;
        this.progress = 1;
        this.go('flying');
      } else if (idle) {
        this.why = null;
        this.tiltIn();
      }
      return;
    }
    this.advance(dt);
  }

  private tiltIn(): void {
    this.progress = 0;
    this.go('tiltIn');
    this.advance(0);
  }

  private advance(dt: number): void {
    const step = this.frames > 0 ? dt / this.frames : Infinity;
    // a ticker's dt sums to the tilt's frames only up to rounding (42 frames of 1000/60 ms): within EPS counts as done
    if (this.cur === 'tiltIn') {
      this.progress = this.progress + step >= 1 - EPS ? 1 : this.progress + step;
      if (this.progress >= 1) this.go('flying');
    } else if (this.cur === 'tiltOut') {
      this.progress = this.progress - step <= EPS ? 0 : this.progress - step;
      if (this.progress <= 0) this.go('off');
    }
  }

  private go(s: TiltState): void {
    this.cur = s;
    this.history.push(s);
  }
}
