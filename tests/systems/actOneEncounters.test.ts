/**
 * T4e act-1 encounters on the compiled maps (docs/FIX_PLAN_PENINSULA.md T4 §1.6, §3 "T4e"; EB-1): the real
 * EncounterSystem wired as ExplorationScene.loadMap wires it (the step filter from `encounterStepFilter`, then the
 * map's rate, table and zones), seeded, 5,000 battles per point.
 */
import { describe, it, expect } from 'vitest';
import { EncounterSystem } from '../../src/systems/EncounterSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { mulberry32 } from '../helpers/battlePolicies.js';
import { OVERWORLD, TEMPLE } from '../helpers/balanceData.js';
import { encounterStepFilter } from '../../src/scenes/exploration/FieldTiles.js';
import type { MapData } from '../../src/types/index.js';

const FIRES = 5000;

/** An EncounterSystem for `map`, set up in the order `ExplorationScene.loadMap` uses. */
function systemFor(map: MapData, seed: number): { events: EventBus; system: EncounterSystem; out: string[][] } {
  const events = new EventBus();
  const system = new EncounterSystem(events, mulberry32(seed));
  system.setStepFilter(encounterStepFilter(map));
  if (map.encounterRate) system.setRate(map.encounterRate);
  system.setEncounters(map.encounters ?? []);
  system.setZones(map.encounterZones ?? []);
  const out: string[][] = [];
  system.setOnEncounter((enemies) => out.push(enemies));
  system.start();
  return { events, system, out };
}

/** `FIRES` formations rolled by stepping on (x, y) of `map`. */
function formationsAt(map: MapData, x: number, y: number, seed: number): string[][] {
  const { events, system, out } = systemFor(map, seed);
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

describe('act-1 zone tables with the step filter (as loadMap wires them)', () => {
  /** Battles fired by `steps` steps on (x, y), and whether the countdown moved. */
  function stepOn(map: MapData, x: number, y: number, steps: number): { battles: number; counted: boolean } {
    const { events, system, out } = systemFor(map, 21);
    const before = system.stepsRemaining;
    for (let i = 0; i < steps; i++) events.emit('playerMove', { x, y });
    const counted = system.stepsRemaining !== before || out.length > 0;
    system.stop();
    return { battles: out.length, counted };
  }
  const zoneAt = (map: MapData, x: number, y: number): string | null => systemFor(map, 1).system.zoneAt(x, y)?.id ?? null;

  it('the overworld warps and the broken north bridge never count a step, inside a zone or not', () => {
    const blocked = [...(OVERWORLD.transitions ?? []), ...(OVERWORLD.keyItemGates ?? [])];
    expect(blocked.length).toBeGreaterThan(0);
    for (const t of blocked) expect(stepOn(OVERWORLD, t.x, t.y, 500), `(${t.x}, ${t.y})`).toEqual({ battles: 0, counted: false });
  });

  it('the temple door warp counts no step, but the arrival cell in front of it rolls the temple_approach table', () => {
    const door = OVERWORLD.transitions!.find((t) => t.targetMap === 'temple-of-fiends')!;
    expect(stepOn(OVERWORLD, door.x, door.y, 500)).toEqual({ battles: 0, counted: false });
    const [ax, ay] = at('temple');
    expect(zoneAt(OVERWORLD, ax, ay)).toBe('temple_approach');
    expect(stepOn(OVERWORLD, ax, ay, 500).battles).toBeGreaterThan(0);
  });

  it('the temple entry warps and Garland\'s scripted tile count no step; the entry cell does', () => {
    const blocked = [...(TEMPLE.transitions ?? []), ...(TEMPLE.scriptedEncounters ?? [])];
    expect(blocked.length).toBeGreaterThanOrEqual(3);
    for (const t of blocked) expect(stepOn(TEMPLE, t.x, t.y, 500), `(${t.x}, ${t.y})`).toEqual({ battles: 0, counted: false });
    const entry = TEMPLE.entrances!.entry as [number, number];
    expect(stepOn(TEMPLE, ...entry, 500).battles).toBeGreaterThan(0);
  });

  it('steps on filtered tiles between zone steps do not change which table or how often a zone fires', () => {
    const door = OVERWORLD.transitions!.find((t) => t.targetMap === 'temple-of-fiends')!;
    const [ax, ay] = at('temple');
    const plain = systemFor(OVERWORLD, 33);
    const mixed = systemFor(OVERWORLD, 33);
    for (let i = 0; i < 2000; i++) {
      plain.events.emit('playerMove', { x: ax, y: ay });
      mixed.events.emit('playerMove', { x: door.x, y: door.y });
      mixed.events.emit('playerMove', { x: ax, y: ay });
    }
    expect(mixed.out).toEqual(plain.out);
    expect(plain.out.length).toBeGreaterThan(20);
  });
});
