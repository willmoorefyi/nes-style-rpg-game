/**
 * EF-D (docs/ENEMY_FEEDBACK_PLAN.md): Chaos's element orbs orbit the head in the idle. The rig's `orbit` (chaos.yaml,
 * assets-src/gen/monster_orbit.py) becomes the atlas `idleOrbit: N` with idle_o<k> / idle_b_o<k> rects; the orbit is
 * constrained inside the idle key's opaque top and the cell, so chaos's anchors and its layout class are unchanged.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { layoutSizeOfArt } from '../../src/rendering/monsterAnchors.js';
import { ORBIT_MAX } from '../../src/scenes/battle/enemyChoreography.js';
import type { EnemySizeClass } from '../../src/scenes/battle/EnemyLayoutAi.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
type Sheet = { cell: [number, number]; scale?: number; travelTop?: number; idleBox?: [number, number, number, number];
  homeX?: [number, number];
  lungeRight?: number; frames: Record<string, [number, number]>; idleOrbit?: number };
const atlas = JSON.parse(readFileSync(join(root, 'assets/sprites/monsters-ai.json'), 'utf-8')) as
  { scale: number; sheets: Record<string, Sheet> };
const chaos = atlas.sheets.chaos;
const rig = parse(readFileSync(join(root, 'assets-src/gen/anim/monsters/chaos.yaml'), 'utf-8')) as
  { orbit?: { steps: number; centre: [number, number]; rx: number; ry: number; parts: Record<string, { r: number }> } };
const enemy = (parse(readFileSync(join(root, 'assets/data/enemies.yaml'), 'utf-8')) as { id: string; size?: EnemySizeClass }[])
  .find((e) => e.id === 'chaos');

describe('EF-D chaos idle orbit', () => {
  it('the rig orbits 16 steps on an ellipse inside the cell and below the idle key\'s opaque top (row 6)', () => {
    const o = rig.orbit!;
    expect(o.steps).toBe(16);
    expect(o.steps).toBeLessThanOrEqual(ORBIT_MAX);
    const r = Math.max(...Object.values(o.parts).map((p) => p.r));
    expect(o.centre[1] - o.ry - r).toBeGreaterThanOrEqual(6);
    expect(o.centre[0] - o.rx - r).toBeGreaterThan(0);
    expect(o.centre[0] + o.rx + r).toBeLessThan(chaos.cell[0] - 1);
  });

  it('chaos keeps its travelTop, idle box, home and the titan layout class (scale 3 boss)', () => {
    expect(chaos.travelTop).toBe(6);
    expect(chaos.idleBox).toEqual([8, 6, 191, 192]);
    expect(chaos.homeX).toEqual([8, 191]);
    expect(chaos.lungeRight).toBe(192);
    expect(enemy?.size).toBe('boss');
    expect(layoutSizeOfArt(enemy?.size, { ...chaos, scale: chaos.scale ?? atlas.scale })).toBe('titan');
  });

  // the atlas binary is rebuilt and committed by the integrator (NEW_MONSTER_GUIDE.md 0); before that it has no orbit
  it.runIf(chaos.idleOrbit !== undefined)('the atlas: idleOrbit = the rig steps, every orbit frame its own rect', () => {
    const n = rig.orbit!.steps;
    expect(chaos.idleOrbit).toBe(n);
    const rects = new Set<string>();
    for (let k = 0; k < n; k++) {
      for (const f of [`idle_o${k}`, `idle_b_o${k}`]) {
        expect(chaos.frames[f], f).toBeDefined();
        rects.add(chaos.frames[f].join());
      }
    }
    expect(rects.size).toBe(2 * n);
    expect(rects.has(chaos.frames.idle.join())).toBe(false);
    expect(rects.has(chaos.frames.idle_b.join())).toBe(false);
    for (const [id, s] of Object.entries(atlas.sheets)) if (id !== 'chaos') expect(s.idleOrbit, id).toBeUndefined();
  });
});
