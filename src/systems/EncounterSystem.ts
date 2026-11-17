import type { EventBus } from '../core/EventBus.js';
import type { EncounterRate, EncounterEntry, EncounterZone, FieldMode } from '../types/index.js';
import { EncounterTable } from './EncounterTable.js';

/** The modes a zone (or the map's own table) applies to when it names none (QUEST 3.4: walking and canoe). */
export const DEFAULT_ZONE_MODES: readonly FieldMode[] = ['walking', 'canoe'];

/** Whether a zone's table applies to a party in `mode` (`EncounterZone.modes`, GAP-6). */
export function zoneAppliesTo(zone: Pick<EncounterZone, 'modes'>, mode: FieldMode): boolean {
  return (zone.modes ?? DEFAULT_ZONE_MODES).includes(mode);
}

interface ZoneTable { zone: EncounterZone; table: EncounterTable }

export class EncounterSystem {
  private stepCounter = 0;
  /** The map's base rate; a zone's `encounterRate` only applies to the counter reset after a battle in that zone. */
  private rate: EncounterRate = { min: 20, max: 30 };
  private table: EncounterTable;
  private zones: ZoneTable[] = [];
  private events: EventBus;
  private onEncounter: ((enemies: string[]) => void) | null = null;
  private rng: () => number;
  private rateMultiplier = 1.0;
  /** setRate has been called once (the first call rolls; later ones clamp). */
  private rateSet = false;
  /** Tiles where a step is not a step (warps, gates, scripted battles): no countdown and no battle there. */
  private stepFilter: ((x: number, y: number) => boolean) | null = null;
  /** The party's field mode: zones apply by their `modes`; the map's own table on foot and by canoe. */
  private mode: FieldMode = 'walking';

  constructor(events: EventBus, rng: () => number = Math.random) {
    this.events = events;
    this.rng = rng;
    this.table = new EncounterTable(rng);
    this.resetCounter();
  }

  /**
   * The map's rate (every map load). The first call on a fresh system rolls a countdown; later ones keep the running
   * countdown and only clamp it to this map's scaled maximum, so walking through a door doesn't restart it (W4).
   */
  setRate(rate: EncounterRate): void {
    this.rate = rate;
    if (!this.rateSet) {
      this.rateSet = true;
      this.resetCounter();
      return;
    }
    const max = this.rateMultiplier > 0 ? Math.max(1, Math.round(rate.max / this.rateMultiplier)) : rate.max;
    this.stepCounter = Math.min(this.stepCounter, max);
  }

  /** A fresh countdown on the current rate (a new game, a load or a retry enters the field). */
  restart(): void {
    this.resetCounter();
  }

  /** Set encounter rate multiplier (0 = no encounters, 0.5 = half rate, 1 = normal) */
  setRateMultiplier(multiplier: number): void {
    this.rateMultiplier = multiplier;
  }

  setEncounters(entries: EncounterEntry[]): void {
    this.table.setEntries(entries);
  }

  /** One table per zone, sharing the RNG; the first zone whose rects contain the cell wins. */
  setZones(zones: EncounterZone[]): void {
    this.zones = zones.map((zone) => {
      const table = new EncounterTable(this.rng);
      table.setEntries(zone.encounters);
      return { zone, table };
    });
  }

  /** The party's field mode now (the exploration scene sets it every frame, beside the rate multiplier). */
  setMode(mode: FieldMode): void {
    this.mode = mode;
  }

  /** The zone containing (x, y) for the current mode, or null for the map's own table. */
  zoneAt(x: number, y: number): EncounterZone | null {
    return this.zoneTableAt(x, y)?.zone ?? null;
  }

  setOnEncounter(callback: (enemies: string[]) => void): void {
    this.onEncounter = callback;
  }

  /** `filter(x, y)` is true where a step counts; null counts every step. */
  setStepFilter(filter: ((x: number, y: number) => boolean) | null): void {
    this.stepFilter = filter;
  }

  start(): void {
    this.events.on('playerMove', this.handleMove);
  }

  stop(): void {
    this.events.off('playerMove', this.handleMove);
  }

  private handleMove = (pos: { x: number; y: number }): void => {
    const zone = this.zoneTableAt(pos.x, pos.y);
    // outside every zone of this mode: the map's own table, which only applies on foot and by canoe
    const table = zone?.table ?? (DEFAULT_ZONE_MODES.includes(this.mode) ? this.table : null);
    // no table where the player stands (a map or zone without encounters): steps don't count there
    if (!table || table.isEmpty) return;
    if (this.stepFilter && !this.stepFilter(pos.x, pos.y)) return;
    // Rate multiplier of 0 means no encounters
    if (this.rateMultiplier <= 0) return;
    this.stepCounter--;
    if (this.stepCounter <= 0) {
      const enemies = table.selectEnemies();
      this.resetCounter(zone?.zone.encounterRate ?? this.rate);
      if (enemies.length > 0 && this.onEncounter) {
        this.onEncounter(enemies);
      }
    }
  };

  private zoneTableAt(x: number, y: number): ZoneTable | null {
    for (const zt of this.zones) {
      if (!zoneAppliesTo(zt.zone, this.mode)) continue;
      if (zt.zone.rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return zt;
    }
    return null;
  }

  private resetCounter(rate: EncounterRate = this.rate): void {
    const base = rate.min + Math.floor(this.rng() * (rate.max - rate.min + 1));
    // Higher multiplier = more encounters = fewer steps. Multiplier < 1 = more steps between encounters.
    this.stepCounter = this.rateMultiplier > 0
      ? Math.max(1, Math.round(base / this.rateMultiplier))
      : base;
  }

  get stepsRemaining(): number {
    return this.stepCounter;
  }
}
