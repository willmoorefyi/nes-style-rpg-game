import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import type { MapData } from '../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readMap = (id: string) => parse(readFileSync(join(root, 'assets/maps/ai', `${id}.yaml`), 'utf-8')) as MapData;
const cutscenes = parse(readFileSync(join(root, 'assets/data/cutscenes.yaml'), 'utf-8')) as
  Array<{ id: string; steps: Array<{ type: string; flag?: string }> }>;
const flagsSetBy = (id: string) => cutscenes.find((c) => c.id === id)!.steps.filter((s) => s.type === 'set_flag').map((s) => s.flag);

describe('act 1 flow (the compiled 2x maps the game plays)', () => {
  it('a new game at the south gate of Cornelia can walk to an exit (NG-1: no sealed pocket)', () => {
    const map = readMap('cornelia');
    const [sx, sy] = map.entrances!.south_gate;
    const col = new CollisionMap(map);
    const walk = new WalkingMode();
    const exits = new Set(map.transitions.map((t) => `${t.x},${t.y}`));
    const seen = new Set([`${sx},${sy}`]);
    const queue: Array<[number, number]> = [[sx, sy]];
    let reached = 0;
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (exits.has(`${x},${y}`)) reached++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(k) || !col.isWalkable(nx, ny, walk)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    expect(seen.size).toBeGreaterThan(500);
    expect(reached).toBeGreaterThan(5);
  });

  it('beating Garland frees the princess but does not open the north bridge (ST-1)', () => {
    expect(flagsSetBy('garland_defeated')).toEqual(['PRINCESS_RESCUED']);
  });

  it('the King plays the act-1 ending once, after the rescue, and it never builds the bridge in act 1', () => {
    const king = readMap('cornelia-castle-2f').npcs.find((n) => n.id === 'king')!;
    expect(king.cutscene).toEqual({ id: 'act1_complete', requiredFlag: 'PRINCESS_RESCUED', onceFlag: 'INTRO_COMPLETE' });
    expect(flagsSetBy('act1_complete')).toEqual(['INTRO_COMPLETE']);
    // first match wins: the post-ending line must come before the post-rescue line
    const conditions = (king.dialog as Array<{ condition?: string }>).map((d) => d.condition);
    expect(conditions.indexOf('INTRO_COMPLETE')).toBeLessThan(conditions.indexOf('PRINCESS_RESCUED'));
  });

  it('no NPC promises a finished bridge (ST-4)', () => {
    for (const id of ['cornelia', 'cornelia-castle-2f']) {
      for (const npc of readMap(id).npcs) {
        for (const d of npc.dialog as Array<string | { condition?: string; text: string[] }>) {
          if (typeof d !== 'string') expect(d.condition, `${id} ${npc.id}`).not.toBe('BRIDGE_BUILT');
        }
      }
    }
  });
});
