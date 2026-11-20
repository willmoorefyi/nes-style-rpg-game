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
 * A tilt lasts `frames` 60 Hz frames of `dt`. M7-2 builds the states with an instant switch (`frames` 0: `tiltIn` and
 * `tiltOut` are entered and left on the same call, so `busy` is never seen true); M7-4 gives them the 42-frame (700 ms)
 * tilt and its parameters. `history` lists every state entered, transient ones included, for the tests.
 */

export type TiltState = 'off' | 'loading' | 'tiltIn' | 'flying' | 'tiltOut';
/** Why a flight is waiting in `loading`: a confirm on a parked airship, or a load / retry already in flight. */
export type LoadReason = 'takeoff' | 'restore';

/** M7-2: the switch is instant. M7-4 sets the tilt's 42 frames (700 ms at 60 Hz). */
export const TILT_FRAMES = 0;
export const TILT_FRAMES_FULL = 42;

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
    if (this.cur === 'tiltIn') {
      this.progress = Math.min(1, this.progress + step);
      if (this.progress >= 1) this.go('flying');
    } else if (this.cur === 'tiltOut') {
      this.progress = Math.max(0, this.progress - step);
      if (this.progress <= 0) this.go('off');
    }
  }

  private go(s: TiltState): void {
    this.cur = s;
    this.history.push(s);
  }
}
