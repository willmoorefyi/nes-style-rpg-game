import { Assets, Graphics, Rectangle, Texture, type Container } from 'pixi.js';
import type { VehicleState, VehicleType } from '../../types/index.js';
import type { PlayerController } from '../../entities/PlayerController.js';
import { TILE_SIZE } from '../../core/LayoutConstants.js';
import { fetchJson } from '../../rendering/CharacterAtlas.js';
import { VEHICLE_FRAMES, canoeSeat, nativeScale, parseVehicleMeta } from './vehicleLayout.js';
import { VehicleView, type VehicleArt } from './FieldVehicleView.js';

const SHEET = 'assets/sprites/vehicles.png';
const META = 'assets/sprites/vehicles.json';

export type { VehicleSheetMeta } from './vehicleLayout.js';

type Facing = 'left' | 'right';

/** Build the per-frame textures of a loaded sheet (exported for the tests). */
export function vehicleArt(raw: unknown, sheet: Texture): VehicleArt {
  const meta = parseVehicleMeta(raw);
  sheet.source.scaleMode = 'nearest';
  const frames: VehicleArt['frames'] = {};
  for (const name of VEHICLE_FRAMES) {
    const f = meta.frames[name];
    frames[name] = { frame: f, tex: new Texture({ source: sheet.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }) };
  }
  return { frames, seat: meta.canoe };
}

/**
 * The field's vehicle sprites (W1-A, VEH-INT): one view per vehicle parked on the map, depth-sorted by its foot row,
 * and the vehicle the party rides, which follows the hero at render time. The ridden ship and airship hide the hero;
 * the canoe seats it: the back hull under the hero, the near side over it, the hero dropped into the hull and masked
 * below the gunwale, bobbing with the hull. Art comes from the `vehicles` sheet (assets-src/vehicles.py, each native
 * px drawn at TILE_SIZE / 48); while it loads, or if it fails, the views are tinted placeholders.
 */
export class FieldVehicleSprites {
  private art: VehicleArt | null = null;
  private loading: Promise<void> | null = null;
  private parked: Array<{ view: VehicleView; state: VehicleState }> = [];
  private ridden: { view: VehicleView; player: PlayerController; since: number } | null = null;
  private heroMask: Graphics | null = null;
  /** The last horizontal facing of each vehicle type (up and down keep it; a parked vehicle keeps its last one). */
  private readonly facing: Partial<Record<VehicleType, Facing>> = {};

  constructor(private readonly world: Container | null, private readonly now: () => number = () => performance.now(),
    private readonly load: () => Promise<[unknown, Texture]> = defaultLoad) {}

  /** Load the sheet once; a failure is logged and the coloured placeholders stay. */
  ensure(): Promise<void> {
    if (!this.loading) {
      this.loading = this.load().then(([meta, sheet]) => {
        this.art = vehicleArt(meta, sheet);
        this.rebuild();
      }).catch((e) => console.warn('Vehicle sprites failed to load; using placeholders:', e));
    }
    return this.loading;
  }

  /** Swap every view for one with the loaded art. */
  private rebuild(): void {
    this.showParked(this.parked.map((p) => p.state));
    const r = this.ridden;
    if (r) {
      this.drop();
      this.ride(r.view.type, r.player);
      if (this.ridden) this.ridden.since = r.since;
    }
  }

  private view(type: VehicleType): VehicleView {
    void this.ensure();
    return new VehicleView(type, this.art);
  }

  /** Draw `vehicles` (this map's parked vehicles) in the world; the last set is removed first. */
  showParked(vehicles: readonly VehicleState[]): void {
    for (const p of this.parked) p.view.detach();
    this.parked = [];
    if (!this.world) return;
    for (const state of vehicles) {
      const view = this.view(state.type);
      view.attach(this.world);
      const entry = { view, state };
      this.parked.push(entry);
      this.placeParked(entry);
      view.main.onRender = () => this.placeParked(entry);
    }
  }

  private placeParked(p: { view: VehicleView; state: VehicleState }): void {
    const footY = (p.state.y + 1) * TILE_SIZE;
    p.view.place({
      footX: p.state.x * TILE_SIZE + TILE_SIZE / 2, footY, facing: this.facing[p.state.type] ?? 'right',
      pose: 'parked', tMs: this.now(), sinceBoard: 0, z: footY - 1,   // just behind a hero standing on the same row
    });
  }

  /** The vehicle the party rides (null on foot); it follows `player` each frame it is drawn. */
  ride(type: VehicleType | null, player: PlayerController | null): void {
    const cur = this.ridden;
    if (cur && (cur.view.type !== type || cur.player !== player || cur.view.main.parent !== this.world)) this.drop();
    if (!type || !player || !this.world || this.ridden) return;
    const view = this.view(type);
    view.attach(this.world);
    this.ridden = { view, player, since: this.now() };
    view.main.onRender = () => this.follow();
    this.follow();
  }

  /** Stop riding: remove the views and give the hero back its sprite, mask and pivot. */
  private drop(): void {
    const r = this.ridden;
    if (!r) return;
    r.view.detach();
    const hero = r.player.animation.sprite;
    hero.visible = true;
    hero.mask = null;
    hero.pivot.y = 0;
    this.heroMask?.parent?.removeChild(this.heroMask);
    this.heroMask = null;
    this.ridden = null;
  }

  /** Put the ridden vehicle on the hero's cell, facing as the hero last faced sideways. */
  private follow(): void {
    const r = this.ridden;
    if (!r) return;
    const { view, player } = r;
    const type = view.type;
    const hero = player.animation.sprite;
    if (player.direction === 'left' || player.direction === 'right') this.facing[type] = player.direction;
    const footY = player.y + TILE_SIZE / 2;
    const t = this.now();
    view.place({
      footX: player.x, footY, facing: this.facing[type] ?? 'right', pose: 'ridden', tMs: t,
      sinceBoard: t - r.since, z: type === 'canoe' ? hero.zIndex - 1 : hero.zIndex,
    });
    hero.visible = type === 'canoe';
    if (type === 'canoe') this.seat(view, hero, footY);
  }

  /** The canoe's hero: dropped into the hull (by its pivot, so the controller's position stays), lifted with the
   *  hull's bob, and masked below the gunwale. Without art the hero stands whole over the placeholder. */
  private seat(view: VehicleView, hero: PlayerController['animation']['sprite'], footY: number): void {
    const frame = view.frame;
    if (!frame || !this.art || !this.world) return;
    const k = nativeScale(TILE_SIZE);
    const { drop, maskY } = canoeSeat(this.art.seat, frame.h, footY, k);
    const sy = hero.scale.y || 1;
    hero.pivot.y = -(drop - view.rise) / sy;
    if (!this.heroMask) {
      this.heroMask = new Graphics();
      this.heroMask.label = 'vehicle:canoe_mask';
      this.world.addChild(this.heroMask);
      hero.mask = this.heroMask;
    }
    const top = footY - TILE_SIZE * 4;
    this.heroMask.clear();
    this.heroMask.rect(hero.x - TILE_SIZE, top, TILE_SIZE * 3, maskY - view.rise - top).fill(0xffffff);
  }

  /** The parked sprites' types, for tests and debugging. */
  get parkedTypes(): VehicleType[] {
    return this.parked.map((p) => p.state.type);
  }

  get riddenType(): VehicleType | null {
    return this.ridden?.view.type ?? null;
  }

  /** The ridden and parked views (tests, the browser check). */
  get views(): { ridden: VehicleView | null; parked: VehicleView[]; heroMask: Graphics | null } {
    return { ridden: this.ridden?.view ?? null, parked: this.parked.map((p) => p.view), heroMask: this.heroMask };
  }
}

async function defaultLoad(): Promise<[unknown, Texture]> {
  return Promise.all([fetchJson<unknown>(META), Assets.load<Texture>(SHEET)]);
}
