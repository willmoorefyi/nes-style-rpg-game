import type { EventBus } from '../core/EventBus.js';
import type { EncounterRate, EncounterEntry } from '../types/index.js';
import { EncounterTable } from './EncounterTable.js';

export class EncounterSystem {
  private stepCounter = 0;
  private rate: EncounterRate = { min: 20, max: 30 };
  private table: EncounterTable;
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
    if (this.table.isEmpty) return;
    if (this.stepFilter && !this.stepFilter(pos.x, pos.y)) return;
    // Rate multiplier of 0 means no encounters
    if (this.rateMultiplier <= 0) return;
    this.stepCounter--;
    if (this.stepCounter <= 0) {
      const enemies = this.table.selectEnemies();
      this.resetCounter();
      if (enemies.length > 0 && this.onEncounter) {
        this.onEncounter(enemies);
      }
    }
  };

  private resetCounter(): void {
    const base = this.rate.min + Math.floor(this.rng() * (this.rate.max - this.rate.min + 1));
    // Higher multiplier = more encounters = fewer steps. Multiplier < 1 = more steps between encounters.
    this.stepCounter = this.rateMultiplier > 0
      ? Math.max(1, Math.round(base / this.rateMultiplier))
      : base;
  }

  get stepsRemaining(): number {
    return this.stepCounter;
  }
}
