/**
 * T4e act-1 encounters on the compiled maps (docs/FIX_PLAN_PENINSULA.md T4 §1.6, §3 "T4e"; EB-1): the real
 * EncounterSystem with the overworld's table, rate and zones (as ExplorationScene.loadMap sets them), seeded, 5,000
 * battles per point.
 */
import { describe, it, expect } from 'vitest';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { mulberry32 } from '../helpers/battlePolicies.js';
import { OVERWORLD, TEMPLE } from '../helpers/balanceData.js';
import type { MapData } from '../../src/types/index.js';

const FIRES = 5000;

/** `FIRES` formations rolled by stepping on (x, y) of `map`. */
function formationsAt(map: MapData, x: number, y: number, seed: number): string[][] {
  const events = new EventBus();
  const system = new EncounterSystem(events, mulberry32(seed));
  if (map.encounterRate) system.setRate(map.encounterRate);
  system.setEncounters(map.encounters ?? []);
  system.setZones(map.encounterZones ?? []);
  const out: string[][] = [];
  system.setOnEncounter((enemies) => out.push(enemies));
  system.start();
  for (let steps = 0; out.length < FIRES; steps++) {
    if (steps > FIRES * 40) throw new Error(`only ${out.length} battles at (${x}, ${y})`);
    events.emit('playerMove', { x, y });
  }
  system.stop();
  return out;
}

const share = (fs: string[][], pred: (f: string[]) => boolean) => fs.filter(pred).length / fs.length;
const count = (f: string[], id: string) => f.filter((e) => e === id).length;
const at = (name: string): [number, number] => OVERWORLD.entrances![name] as [number, number];
const tomb = OVERWORLD.inspect![0];

describe('act-1 overworld encounters (T4e)', () => {
  const town = formationsAt(OVERWORLD, ...at('cornelia'), 11);

  it('never rolls a Gr.Wolf (or a pirate) at the city arrival, and the mean formation there is 2.5-4 (EB-1)', () => {
    expect(town.some((f) => f.includes('gr_wolf'))).toBe(false);
    expect(town.some((f) => f.includes('pirate'))).toBe(false);
    const mean = town.reduce((s, f) => s + f.length, 0) / town.length;
    expect(mean).toBeGreaterThanOrEqual(2.5);
    expect(mean).toBeLessThanOrEqual(4);
    expect(Math.max(...town.map((f) => f.length))).toBeLessThanOrEqual(9);
  });

  it('rolls Wolf x3 or more in >= 40 % of the battles at the tomb (the east pocket)', () => {
    const fs = formationsAt(OVERWORLD, tomb.x, tomb.y + 1, 12);
    expect(share(fs, (f) => count(f, 'wolf') >= 3)).toBeGreaterThanOrEqual(0.4);
    expect(fs.some((f) => f.includes('gr_wolf'))).toBe(true);
  });

  it('rolls Gr.Imps in >= 30 % of the battles at the temple door (the temple approach)', () => {
    const fs = formationsAt(OVERWORLD, ...at('temple'), 13);
    expect(share(fs, (f) => f.includes('gr_imp'))).toBeGreaterThanOrEqual(0.3);
    expect(fs.some((f) => f.includes('gr_wolf'))).toBe(false);
  });

  it('rolls skeletons in >= 70 % of the battles in the Temple of Fiends', () => {
    const entry = TEMPLE.entrances!.entry as [number, number];
    const fs = formationsAt(TEMPLE, ...entry, 14);
    expect(share(fs, (f) => f.includes('skeleton'))).toBeGreaterThanOrEqual(0.7);
    expect(fs.some((f) => f.includes('pirate'))).toBe(false);
  });
});
