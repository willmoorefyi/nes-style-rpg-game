import type { Container } from 'pixi.js';
import type { Game } from '../../core/Game.js';
import { FIELD_MODES, type FieldMode, type MapData, type ParkedVehicle, type TerrainType, type VehicleState, type VehicleType } from '../../types/index.js';
import type { MovementMode } from '../../entities/MovementMode.js';
import type { PlayerController } from '../../entities/PlayerController.js';
import {
  canLand, modeAfterStep, patchedTerrain, terrainAllows, type FieldState, type StepResult,
} from '../../systems/fieldRules.js';
import { vehicleOf, vehiclesAfterStep } from '../../systems/fieldRulesVehicles.js';
import { VehicleManager, hasCell, keepSpots, parkedVehicles, resolveParked } from '../../systems/VehicleManager.js';
import { WalkingMode } from '../../entities/WalkingMode.js';
import { CanoeMode } from '../../entities/CanoeMode.js';
import { ShipMode } from '../../entities/ShipMode.js';
import { AirshipMode } from '../../entities/AirshipMode.js';
import { FieldVehicleSprites } from './FieldVehicleSprites.js';
import { bankHintFor } from './FieldBankHint.js';
import { fieldStateOf } from './fieldState.js';
import type { AirshipHeading } from './airshipHeading.js';

/** The field-rule mode of a movement mode (an unknown id counts as walking, the rules' strictest). */
export function fieldModeOf(mode: MovementMode): FieldMode {
  return FIELD_MODES.find((m) => m === mode.id) ?? 'walking';
}

/** The airship's line when confirm is pressed over a cell it may not land on (QUEST 3.3). */
export const CANT_LAND = "The airship can't land here.";

export { NO_CANOE_HINT } from './FieldBankHint.js';

/** A movement mode whose steps the field rules decide (`canMoveAt`: boarding, the canoe, docks), so PlayerController
 *  moves exactly where fieldRules.fieldStep will let the step stand. */
class BoundMode implements MovementMode {
  readonly id: string;
  constructor(readonly inner: MovementMode,
    private readonly rule: (x: number, y: number) => boolean | null) {
    this.id = inner.id;
  }
  canMove(terrain: TerrainType): boolean { return this.inner.canMove(terrain); }
  /** The field rules' answer; without a map yet, the terrain rule alone. */
  canMoveAt(x: number, y: number, terrain: TerrainType): boolean { return this.rule(x, y) ?? this.inner.canMove(terrain); }
  getSpeedMultiplier(terrain: TerrainType): number { return this.inner.getSpeedMultiplier(terrain); }
  getEncounterRateMultiplier(): number { return this.inner.getEncounterRateMultiplier(); }
}

/**
 * The exploration scene's vehicles (docs/QUEST_PLAN.md 3.3, 4.2; W1-A). The game holds the party's mode and the
 * parked vehicles of every map (`Game.fieldMode`, `Game.vehicles`: save v2, the retry snapshot); the vehicle the
 * party rides is parked nowhere. Steps go through the field rules (boarding a parked ship, the canoe on River and
 * Lake, the ship's dock disembark); confirm takes off on a parked airship and lands it on a free grass cell. The
 * VehicleManager reads the game's flags, which Game.restoreState / resetState replace, so `rebind` runs on every
 * enter; the first frame after it puts the hero back in the saved mode.
 */
export class FieldVehicles {
  private manager: VehicleManager;
  private mapId = '';
  private map: MapData | null = null;
  private player: PlayerController | null = null;
  private restorePending = true;
  /** The vehicle ridden on the last frame and where (parked there if a map change drops the party on foot). */
  private riding: VehicleState | null = null;
  private readonly sprites: FieldVehicleSprites;
  private readonly modes = new Map<FieldMode, BoundMode>();

  constructor(private readonly game: Game, world: Container | null = null) {
    this.manager = this.create();
    this.sprites = new FieldVehicleSprites(world);
    const inner: Record<FieldMode, MovementMode> = {
      walking: new WalkingMode(), canoe: new CanoeMode(), ship: new ShipMode(), airship: new AirshipMode(),
    };
    for (const m of FIELD_MODES) this.modes.set(m, new BoundMode(inner[m], (x, y) => this.allows(m, x, y)));
  }

  private create(): VehicleManager {
    const modes = new Map<VehicleType, MovementMode>([
      ['canoe', new CanoeMode()],
      ['ship', new ShipMode()],
      ['airship', new AirshipMode()],
    ]);
    return new VehicleManager(this.game.gameFlags, modes);
  }

  /** A fresh manager on the game's current flags (load, retry, new game); the saved mode applies on the next frame. */
  rebind(): void {
    this.manager = this.create();
    this.restorePending = true;
    this.riding = null;
  }

  /** The map just loaded: its parked vehicles (known positions, then the open spawns) and their sprites. */
  setMap(map: MapData): void {
    this.map = map;
    this.mapId = map.id;
    if ((this.game.vehicles ?? []).some((v) => !hasCell(v))) this.game.vehicles = resolveParked(this.game.vehicles, map); // NW-1
    this.refresh();
  }

  private refresh(): void {
    const parked = parkedVehicles(this.mapId, this.map?.vehicles ?? [], this.game.vehicles ?? [],
      (f) => this.game.gameFlags.has(f), vehicleOf(this.game.fieldMode ?? 'walking'));
    this.manager.setParked(parked);
    this.sprites.showParked(parked);
  }

  /** Whether a step in `mode` from the hero's cell to (x, y) stands (fieldRules.modeAfterStep; gates come later);
   *  null before a map and a hero are known. */
  private allows(mode: FieldMode, x: number, y: number): boolean | null {
    const p = this.player;
    if (!p || !this.map) return null;
    return modeAfterStep(this.map, { x: p.gridX, y: p.gridY }, { x, y }, this.fieldState(mode)) !== null;
  }

  /** The bound movement mode of a field mode. */
  modeFor(mode: FieldMode): MovementMode {
    return this.modes.get(mode) ?? this.modes.get('walking')!;
  }

  /**
   * Every field frame, before the hero moves: the saved mode after an enter, the bound mode, the game's mode and the
   * ridden sprite; then confirm takes off or lands the airship. True when the press was used.
   */
  tryBoard(player: PlayerController): boolean {
    this.player = player;
    if (this.restorePending) this.restore(player);
    if (!(player.currentMode instanceof BoundMode)) player.currentMode = this.modeFor(fieldModeOf(player.currentMode));
    this.sync(player);
    if (player.isMoving || !this.game.input.isJustPressed('confirm')) return false;
    return this.confirm(player);
  }

  /** After an enter (load, retry, scenario): the hero in the saved mode, if that mode may stand on its cell. */
  private restore(player: PlayerController): void {
    this.restorePending = false;
    let mode = this.game.fieldMode ?? 'walking';
    const cell = { x: player.gridX, y: player.gridY };
    const flags = new Set(Object.keys(this.game.gameFlags.getAll()));
    const terrainOk = (m: FieldMode): boolean => m === 'airship'
      || (!!this.map && terrainAllows(m, patchedTerrain(this.map, cell.x, cell.y, flags)));
    if (mode !== 'walking' && !terrainOk(mode)) {
      console.warn(`field mode ${mode} can't stand at (${cell.x}, ${cell.y}) on ${this.mapId}; on foot`);
      mode = 'walking';
    }
    this.game.fieldMode = mode;
    player.currentMode = this.modeFor(mode);
    this.refresh();
  }

  /** Keep the game's mode and the ridden vehicle in step with the hero. A map change that put the party on foot
   *  (a transition from a vehicle) parks the vehicle where it was ridden last. */
  private sync(player: PlayerController): void {
    const mode = fieldModeOf(player.currentMode);
    if (mode !== this.game.fieldMode) {
      const left = this.riding;
      this.game.fieldMode = mode;
      if (left && !(left.type === 'canoe' && this.hasCanoe())) {
        this.game.vehicles = keepSpots(this.game.vehicles ?? [], [...this.known.filter((v) => v.type !== left.type), left]);
      }
      this.refresh();
    }
    const type = vehicleOf(mode);
    this.riding = type ? { type, map: this.mapId, x: player.gridX, y: player.gridY } : null;
    this.sprites.ride(type, player);
  }

  /** The game's parked vehicles with a cell (a game without them, e.g. a test double, has none). */
  private get known(): VehicleState[] {
    return (this.game.vehicles ?? []).filter(hasCell);
  }


  private hasCanoe(): boolean {
    return this.game.inventory.getAll().some((i) => i.itemId === 'canoe');
  }

  /** Change the party's mode from `before` at `from` to `after` at `to`, parking and unparking (vehiclesAfterStep). */
  private changeMode(player: PlayerController, before: FieldMode, after: FieldMode,
    from: { x: number; y: number }, to: { x: number; y: number }): void {
    this.game.vehicles = keepSpots(this.game.vehicles ?? [], vehiclesAfterStep(this.known, this.mapId, before, after, from, to, this.hasCanoe()));
    this.game.fieldMode = after;
    player.currentMode = this.modeFor(after);
    const type = vehicleOf(after);
    this.riding = type ? { type, map: this.mapId, x: to.x, y: to.y } : null;
    this.refresh();
    this.sprites.ride(type, player);
  }

  /** After a step the field rules let stand: its mode (boarding, the canoe, a dock disembark) becomes the party's. */
  afterStep(player: PlayerController, from: { x: number; y: number }, step: StepResult): void {
    const before = fieldModeOf(player.currentMode);
    if (!step.ok || step.mode === before) return;
    this.changeMode(player, before, step.mode, from, { x: player.gridX, y: player.gridY });
  }

  /** P3-11: the no-canoe line for a step just pressed toward River or Lake on foot, else null (FieldBankHint). */
  bankHint(player: PlayerController): string | null {
    if (!this.map || fieldModeOf(player.currentMode) !== 'walking') return null;
    return bankHintFor(this.game, this.map, player, this.fieldState('walking'));
  }

  /** Confirm while idle: take off on a parked airship; while flying, land on a free grass cell or say why not. */
  private confirm(player: PlayerController): boolean {
    const cell = { x: player.gridX, y: player.gridY };
    const mode = fieldModeOf(player.currentMode);
    if (mode === 'airship') {
      const npcHere = !!this.map?.npcs.some((n) => n.x === cell.x && n.y === cell.y);
      if (this.map && canLand(this.map, cell, this.fieldState('airship')) && !npcHere) {
        this.changeMode(player, 'airship', 'walking', cell, cell);
      } else {
        this.game.events.emit('showDialog', { text: CANT_LAND, onComplete: () => {} });
      }
      return true;
    }
    if (mode === 'walking' && this.states.some((v) => v.type === 'airship' && v.x === cell.x && v.y === cell.y)) {
      this.changeMode(player, 'walking', 'airship', cell, cell);
      return true;
    }
    return false;
  }

  /** A cutscene's `set_vehicle`: parked there from now on (W1-B); a spot of another map waits for it to load (NW-1). */
  setVehicle(v: ParkedVehicle): void {
    this.game.vehicles = resolveParked([...(this.game.vehicles ?? []).filter((x) => x.type !== v.type), { ...v }], this.map ?? { id: this.mapId });
    this.refresh();
  }

  /** The vehicles parked on the current map, as the field rules see them. */
  get states(): VehicleState[] {
    return this.manager.activeVehicles.map((v) => ({ type: v.type, map: this.mapId, x: v.x, y: v.y }));
  }

  /** The vehicle types drawn parked on this map and the one ridden (tests, the browser check). */
  get drawn(): { parked: VehicleType[]; ridden: VehicleType | null } {
    return { parked: this.sprites.parkedTypes, ridden: this.sprites.riddenType };
  }

  /** The airship's heading (one owner: the sprites, D-AV4) and one frame of the hero's direction taken into it. */
  airshipHeading(): AirshipHeading { return this.sprites.heading; }
  noteHeading(): void { this.sprites.noteHeading(); }

  /** The field-rule state now: the game's flags and items, the party's mode and these vehicles. */
  fieldState(mode: FieldMode): FieldState {
    return fieldStateOf(this.game, mode, this.states);
  }
}
