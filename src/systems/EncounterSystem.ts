import type { EventBus } from '../core/EventBus.js';
import type { EncounterRate, EncounterEntry } from '../types/index.js';
import { EncounterTable } from './EncounterTable.js';

export class EncounterSystem {
  private stepCounter = 0;
  private rate: EncounterRate = { min: 20, max: 30 };
  private table = new EncounterTable();
  private events: EventBus;
  private onEncounter: ((enemies: string[]) => void) | null = null;

  constructor(events: EventBus) {
    this.events = events;
    this.resetCounter();
  }

  setRate(rate: EncounterRate): void {
    this.rate = rate;
    this.resetCounter();
  }

  setEncounters(entries: EncounterEntry[]): void {
    this.table.setEntries(entries);
  }

  setOnEncounter(callback: (enemies: string[]) => void): void {
    this.onEncounter = callback;
  }

  start(): void {
    this.events.on('playerMove', this.handleMove);
  }

  stop(): void {
    this.events.off('playerMove', this.handleMove);
  }

  private handleMove = (): void => {
    if (this.table.isEmpty) return;
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
    this.stepCounter = this.rate.min + Math.floor(Math.random() * (this.rate.max - this.rate.min + 1));
  }

  get stepsRemaining(): number {
    return this.stepCounter;
  }
}
