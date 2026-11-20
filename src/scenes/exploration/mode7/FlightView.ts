/**
 * The Mode 7 flight view's orchestrator (docs/MODE7_PLAN.md 4.3, 8): readiness, activation from the map and the game's
 * `fieldMode`, the state machine, `busy` and `window.__mode7`. It imports no PixiJS: the Pixi part is
 * `FlightRenderer`, imported lazily from `setMap` on the world map once an airship is raised, parked or ridden there,
 * so the scene tests that fly with a mock game (no `app.renderer`, profile `off`) never load it.
 *
 * It is a view only: it reads the hero's position and the game's `fieldMode` and draws them. The landing cell stays
 * the hero's grid cell (D-M3); the marker and the shadow only show it.
 */
import type { Container } from 'pixi.js';
import type { Game } from '../../../core/Game.js';
import type { MapData } from '../../../types/index.js';
import type { PlayerController } from '../../../entities/PlayerController.js';
import type { MapRenderer } from '../../../rendering/MapRenderer.js';
import type { Camera } from '../../../rendering/Camera.js';
import type { FieldVehicles } from '../FieldVehicles.js';
import type { FlightFrame, FlightRenderer } from './FlightRenderer.js';
import { TILE_SIZE } from '../../../core/LayoutConstants.js';
import { getSettings } from '../../../core/Settings.js';
import { canLand } from '../../../systems/fieldRules.js';
import { AIRSHIP_LIFT, TAKEOFF_MS, nativeScale } from '../vehicleLayout.js';
import { cellToScreen, screenToCell, type ViewParams } from './mode7Math.js';
import { FLIGHT_VIEW, SHIP_FOOT_Y, TILT_HOLDOFF_FRAMES, TILT_MS, TiltMachine, tiltParams,
  type TiltStart } from './mode7Tilt.js';
import { capsOf, flightMayCome, mode7Enabled, slowThisSession, type Mode7Caps, type Mode7Profile } from './mode7Toggle.js';
import { FlightFallback } from './FlightContext.js';
import { FlightStream, chunkHost, nearProfile } from './FlightStream.js';
import { FlightStats } from './flightStats.js';

/** The only map Mode 7 draws (D-M7). */
export const WORLD_MAP = 'overworld';

export interface FlightViewDeps {
  game: Game;
  world: Container;
  parent: Container;
  at: number;
  player: () => PlayerController | null;
  tilemap: () => MapRenderer | null;
  camera: Camera;
  vehicles: FieldVehicles;
}

export { p95 } from './flightStats.js';

export class FlightView {
  private readonly machine = new TiltMachine();
  private map: MapData | null = null;
  private renderer: FlightRenderer | null = null;
  private loadStarted = false;
  private ready = false;
  private failed = false;
  private caps: (Mode7Caps & { gl: string }) | null = null;
  private search: string | null = null;
  /** The first update after `setMap` (a flight then is a load or retry: no tilt). */
  private fresh = true;
  private on = false;
  private airship = false;
  private shown = false;
  private generation = 0;
  private boardAt = -Infinity;
  private facing: 'left' | 'right' = 'right';
  private mismatchLogged = false;
  /** The playing tilt's start (from the live camera) and the machine's state count when it began. */
  private tilt: TiltStart | null = null;
  private tiltAt = -1;
  private readonly stream = new FlightStream();
  private near = nearProfile('full');
  private readonly stats = new FlightStats();
  private readonly fallback = new FlightFallback(() => { this.failed = true; this.drop(); });   // M7-6 (7)
  readonly report: Record<string, unknown> = { state: 'off', history: this.machine.history };

  constructor(private readonly deps: FlightViewDeps) {
    (globalThis as Record<string, unknown>).__mode7 = this.report;
  }

  get busy(): boolean { return this.machine.busy; }
  get state(): string { return this.machine.state; }
  /** Every state entered since the view was made (tests). */
  get history(): readonly string[] { return this.machine.history; }

  /** The map just loaded: Mode 7 ends at once; on the world map the renderer and the atlas load if a flight may come. */
  setMap(map: MapData): void {
    this.machine.end();
    this.show(false);
    if (map.id !== WORLD_MAP) this.drop();
    this.map = map;
    this.fresh = true;
    this.on = false;
    this.airship = false;
    this.ensureLoad();
    Object.assign(this.report, { state: this.machine.state, reason: null, marker: false, shadowCell: null });
  }

  /** The scene exits: no view, the renderer freed (a later enter loads it again). */
  clear(): void {
    this.machine.end();
    this.show(false);
    this.drop();
    this.map = null;
    Object.assign(this.report, { state: this.machine.state, reason: null, marker: false, shadowCell: null });
  }

  private drop(): void {
    this.generation++;
    this.renderer?.destroy();
    this.renderer = null;
    this.loadStarted = false;
    this.ready = this.fallback.lost = false;   // a lost context belonged to the dropped renderer's listeners
  }

  private profile(): Mode7Profile {
    this.caps ??= capsOf((this.deps.game.app as { renderer?: unknown } | undefined)?.renderer);
    this.search ??= typeof location === 'undefined' ? '' : location.search;
    return mode7Enabled(this.search, getSettings(), { ...this.caps, failed: this.failed, slow: slowThisSession() });
  }

  private ensureLoad(): void {
    const map = this.map;
    if (!map || map.id !== WORLD_MAP || this.loadStarted || this.failed) return;
    const profile = this.profile();
    if (profile === 'off' || !flightMayCome(this.deps.game, WORLD_MAP)) return;
    this.loadStarted = true;
    this.near = nearProfile(profile === 'low' ? 'low' : 'full');
    const gen = this.generation;
    const game = this.deps.game;
    import('./FlightRenderer.js').then((m) => {
      if (gen !== this.generation) return undefined;
      this.renderer = m.createFlightRenderer({ parent: this.deps.parent, at: this.deps.at, map, profile,
        webgl2: !!this.caps?.webgl2, renderer: game.app.renderer, hasFlag: (f) => game.gameFlags.has(f),
        onContext: (event, err) => { if (gen === this.generation) this.fallback.context(event, err); } });
      return this.renderer.load();
    }).then(() => {
      if (gen === this.generation && this.renderer) this.ready = true;
    }).catch((err: unknown) => {
      if (gen !== this.generation) return;
      console.error('Mode 7: the flight view could not load (missing atlas?); the airship flies top-down', err);
      this.failed = true;
      this.drop();
    });
  }

  /** Every field frame, before the dialog and busy returns (8): follow the flight and draw it. */
  update(dt: number): void {
    const map = this.map;
    if (!map || map.id !== WORLD_MAP) return;
    const t0 = performance.now();
    const game = this.deps.game;
    this.ensureLoad();
    const airship = game.fieldMode === 'airship';
    const on = airship && !this.failed && this.profile() !== 'off';
    const player = this.deps.player();
    const idle = !player?.isMoving;
    const m = this.machine;
    const entered = m.entered;
    const wasBusy = m.busy;
    if (on && !this.on) {
      this.boardAt = this.fresh ? -Infinity : performance.now();
      m.start(this.fresh ? 'restore' : 'takeoff', this.ready, idle);
    } else if (!on && this.on) {
      if (this.airship && !airship) m.land(); else m.end();
    }
    this.fresh = false;
    this.on = on;
    this.airship = airship;
    // a tilt that began this frame draws its first point (t 0 in, 1 out); `loading` -> `tiltIn` happens in the tick
    if (!(m.busy && m.entered !== entered)) m.tick(dt, this.ready, idle);
    if (m.busy && m.entered !== this.tiltAt && player) this.beginTilt(player);
    // the tilt ended: a held confirm must not land or board again at once; a held direction moves on (4.3). The
    // steady-flight p95s leave the tilt out and settle again from here
    if (wasBusy && !m.busy) { game.input.holdOff(TILT_HOLDOFF_FRAMES); this.stats.reset(); }
    const drawn = this.machine.drawn && this.ready && !!this.renderer && !!player && !this.fallback.lost;
    this.show(drawn);
    if (drawn && player && this.renderer) this.renderer.draw(this.frame(map, player));
    else this.report.marker = false;
    if (this.machine.busy) this.deps.tilemap()?.render();   // a tilt: the scene's own render is skipped (3.3)
    this.measure(t0, drawn);
  }

  /** A tilt starts from the hero's screen point in the live top-down camera (clamped at the map edges, too). */
  private beginTilt(player: PlayerController): void {
    this.tiltAt = this.machine.entered;
    const anchor = this.deps.camera.worldToScreen(player.x, player.y);
    this.tilt = { anchor, ship: { x: anchor.x, y: anchor.y + TILE_SIZE / 2 } };
    this.report.tiltStart = this.tilt;
  }

  /** Show the Mode 7 view (and hide the top-down world) or the reverse; only on a change. */
  private show(drawn: boolean): void {
    if (drawn === this.shown) return;
    this.shown = drawn;
    this.renderer?.setVisible(drawn);
    this.deps.world.visible = !drawn;
    if (!drawn) this.stream.release();   // the streamer wants the top-down view again
    this.stats.reset();
  }

  private frame(map: MapData, player: PlayerController): FlightFrame {
    if (player.direction === 'left' || player.direction === 'right') this.facing = player.direction;
    const m = this.machine;
    const tilt = m.busy && this.tilt ? tiltParams(m.t, this.tilt, TILE_SIZE) : null;
    const view: ViewParams = { ...(tilt?.view ?? FLIGHT_VIEW), px: player.x / TILE_SIZE, py: player.y / TILE_SIZE };
    const atP = cellToScreen(view, view.px, view.py) ?? { x: view.cx, y: 0, scale: TILE_SIZE };
    // the drawn shadow starts on the cell's bottom edge, as the top-down one; the check reads P itself
    const shadow = tilt ? cellToScreen(view, view.px, view.py + tilt.shadowSouth) ?? atP : atP;
    const seen = screenToCell(view, atP.x, atP.y);
    const cell = seen ? { x: Math.floor(seen.x), y: Math.floor(seen.y) } : null;
    const idle = !player.isMoving;
    if (idle && cell && (cell.x !== player.gridX || cell.y !== player.gridY) && !this.mismatchLogged) {
      this.mismatchLogged = true;
      console.error(`Mode 7: the shadow shows (${cell.x}, ${cell.y}) but the hero is at (${player.gridX}, ${player.gridY})`);
    }
    const here = { x: player.gridX, y: player.gridY };
    const landable = idle && !m.busy && canLand(map, here, this.deps.vehicles.fieldState('airship'))
      && !map.npcs.some((n) => n.x === here.x && n.y === here.y);
    const corner = (x: number, y: number) => { const p = cellToScreen(view, x, y); return { x: p?.x ?? 0, y: p?.y ?? 0 }; };
    const marker = landable ? [corner(here.x, here.y), corner(here.x + 1, here.y), corner(here.x + 1, here.y + 1),
      corner(here.x, here.y + 1)] : null;
    Object.assign(this.report, { shadowCell: cell, marker: !!marker, t: m.t });
    const now = performance.now();
    const chunks = chunkHost(this.deps.tilemap());
    const near = this.stream.follow(chunks, map, this.near, view.px, view.py);
    // the ship's foot once lifted (the sprite adds the lift back and subtracts the eased one); landing, the lift eases
    // down over the tilt's last 400 ms
    const footY = tilt ? tilt.ship.y - AIRSHIP_LIFT * nativeScale(TILE_SIZE) : SHIP_FOOT_Y;
    const sinceBoard = m.state === 'tiltOut' ? m.t * TILT_MS : Number.isFinite(this.boardAt) ? now - this.boardAt : TAKEOFF_MS;
    return { view, near: chunks ? near : null, chunks, marker, shadow,
      ship: { x: tilt?.ship.x ?? view.cx, footY, facing: this.facing, tMs: now, sinceBoard } };
  }

  /** The report and the steady-flight p95s (flightStats: the settle frames and the upload frames are left out). */
  private measure(t0: number, drawn: boolean): void {
    const ms = (this.deps.game.app as { ticker?: { deltaMS: number } } | undefined)?.ticker?.deltaMS;
    this.stats.push(drawn && !this.machine.busy, !!this.renderer?.heavy, performance.now() - t0, ms);
    const s = this.stats;
    // the frame-time switch (7): top-down for the session and the textures freed, unless the URL keeps the view on
    const slow = s.slow && !slowThisSession() && !this.fallback.slow(s.slowP95(), () => this.profile() !== 'off');
    if (slow) { this.show(false); this.drop(); }
    Object.assign(this.report, {
      state: this.machine.state, reason: this.machine.reason, profile: this.profile(), ready: this.ready,
      failed: this.failed, slow: slowThisSession(), lost: this.fallback.lost, busy: this.machine.busy,
      gl: this.caps?.gl ?? '', samples: s.samples,
      textures: this.renderer
        ? { ...this.renderer.textures, chunks: chunkHost(this.deps.tilemap())?.residentTextures ?? 0 } : null,
      heavy: { frames: s.heavyFrames, frameMax: +s.heavyFrameMax.toFixed(2), updateMax: +s.heavyUpdateMax.toFixed(3) },
    });
    if (s.due) Object.assign(this.report, s.summary());
  }
}
