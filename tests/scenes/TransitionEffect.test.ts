import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { transitionAnimation } from '../../src/scenes/exploration/TransitionEffect.js';
import type { MapData, MapTransition } from '../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compiled = (id: string) => parse(readFileSync(join(root, 'assets/maps/ai', `${id}.yaml`), 'utf-8')) as MapData;

describe('CA-2: transition effect', () => {
  it('a door zooms; fade and no effect fade, whatever the target map is called', () => {
    expect(transitionAnimation({ effect: 'door' })).toBe('zoom');
    expect(transitionAnimation({ effect: 'fade' })).toBe('fade');
    expect(transitionAnimation({})).toBe('fade');
    const stairs: MapTransition = { x: 1, y: 1, targetMap: 'cornelia-castle-2f', targetX: 0, targetY: 0 };
    expect(transitionAnimation(stairs)).toBe('fade');
  });

  it('every Cornelia house, shop and inn door has effect: door; the castle gate has none', () => {
    const town = compiled('cornelia');
    const doors = town.transitions.filter((t) => t.targetMap.startsWith('cornelia-') && !t.targetMap.startsWith('cornelia-castle'));
    expect(doors.length).toBe(16);
    for (const t of doors) expect(t.effect, `${t.targetMap} at (${t.x}, ${t.y})`).toBe('door');
    const gate = town.transitions.filter((t) => t.targetMap === 'cornelia-castle');
    expect(gate.length).toBeGreaterThan(0);
    for (const t of gate) expect(transitionAnimation(t)).toBe('fade');
  });

  it('no castle stair, interior exit, edge exit or the overworld temple zooms', () => {
    const ids = ['cornelia-castle', 'cornelia-castle-2f', 'cornelia-castle-tower', 'cornelia-castle-cellar',
      'cornelia-inn', 'cornelia-weapon-shop', 'overworld', 'temple-of-fiends'];
    for (const id of ids) {
      for (const t of compiled(id).transitions) {
        expect(t.effect, `${id} -> ${t.targetMap} at (${t.x}, ${t.y})`).toBeUndefined();
      }
    }
    expect(compiled('overworld').transitions.filter((t) => t.targetMap === 'temple-of-fiends')).toHaveLength(1);
  });
});
