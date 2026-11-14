import type { EventBus } from '../core/EventBus.js';
import type { EncounterRate, EncounterEntry, EncounterZone } from '../types/index.js';
import { EncounterTable } from './EncounterTable.js';

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
  /** Tiles where a step is not a step (warps, gates, scripted battles): no countdown and no battle there. */
  private stepFilter: ((x: number, y: number) => boolean) | null = null;

  constructor(events: EventBus, rng: () => number = Math.random) {
    this.events = events;
    this.rng = rng;
    this.table = new EncounterTable(rng);
    this.resetCounter();
  }

  setRate(rate: EncounterRate): void {
    this.rate = rate;
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

  /** The zone containing (x, y), or null for the map's own table. */
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
    const table = zone?.table ?? this.table;
    // no table where the player stands (a map or zone without encounters): steps don't count there
    if (table.isEmpty) return;
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
