import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { validateMapData } from '../../src/core/schemaValidation.js';
import { arrivalFor } from '../../src/systems/MapTransition.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { WalkingMode } from '../../src/entities/WalkingMode.js';
import type { MapData } from '../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const load = (rel: string): MapData => validateMapData(parse(readFileSync(resolve(root, rel), 'utf-8')));
const legacy = new Map(readdirSync(resolve(root, 'assets/maps')).filter((f) => f.endsWith('.yaml'))
  .map((f) => [f.replace('.yaml', ''), load(`assets/maps/${f}`)] as const));
const manifest = parse(readFileSync(resolve(root, 'assets/maps/ai/index.yaml'), 'utf-8')) as string[];
const compiled = new Map(manifest.map((id) => [id, load(`assets/maps/ai/${id}.yaml`)] as const));
const walking = new WalkingMode();
const walkable = (m: MapData, x: number, y: number) => new CollisionMap(m).isWalkable(x, y, walking);
/** Every variant of a map the game can load: legacy always, compiled under ?art=ai. */
const variants = (id: string): MapData[] => [legacy.get(id), compiled.get(id)].filter((m): m is MapData => !!m);
const all = [...legacy.values(), ...compiled.values()];

describe('map variants (legacy and compiled 2x)', () => {
  it('every compiled map in the manifest has a source; maps new in 2x are only linked from compiled maps', () => {
    expect(manifest.length).toBeGreaterThan(0);
    for (const id of manifest) {
      expect(existsSync(resolve(root, `assets-src/maps/${id}.yaml`)), `${id} source`).toBe(true);
    }
    for (const m of legacy.values()) {
      for (const t of m.transitions) expect(legacy.has(t.targetMap), `${m.id} -> ${t.targetMap}`).toBe(true);
    }
  });

  it('compiled maps: art chunks exist on disk and match the dimensions', () => {
    for (const m of compiled.values()) {
      const art = m.art!;
      expect(art.below.length).toBe(Math.ceil(m.width / art.chunk) * Math.ceil(m.height / art.chunk));
      for (const p of [...art.below, ...art.above]) if (p) expect(existsSync(resolve(root, p)), p).toBe(true);
      expect(m.collision.length).toBe(m.width * m.height);
    }
  });

  it('compiled variants define every entrance of their legacy map', () => {
    for (const [id, m] of compiled) {
      const old = legacy.get(id);
      if (!old) continue;
      // every entrance the legacy map offers must exist in the compiled one (it may add more, e.g. the castle)
      for (const name of Object.keys(old.entrances ?? {})) expect(m.entrances?.[name], `${id}.${name}`).toBeDefined();
    }
  });

  it('entrances are walkable and never on a transition or an NPC', () => {
    for (const m of all) {
      for (const [name, [x, y]] of Object.entries(m.entrances ?? {})) {
        expect(walkable(m, x, y), `${m.id}.${name} walkable`).toBe(true);
        expect(m.transitions.some((t) => t.x === x && t.y === y), `${m.id}.${name} on a transition`).toBe(false);
        expect(m.npcs.some((n) => n.x === x && n.y === y), `${m.id}.${name} on an NPC`).toBe(false);
      }
    }
  });

  it('every transition lands on a walkable cell of every variant of its target', () => {
    for (const m of all) {
      for (const t of m.transitions) {
        for (const target of variants(t.targetMap)) {
          const at = arrivalFor(t, target);
          expect(walkable(target, at.x, at.y), `${m.id} (${t.x},${t.y}) -> ${target.id} (${at.x},${at.y})`).toBe(true);
        }
      }
    }
  });
});
