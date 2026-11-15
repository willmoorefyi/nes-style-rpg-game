/**
 * Fh test 5 (docs/BESTIARY_PLAN.md 3.4, R7): bestiary.yaml against the other data files and the compiled maps.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { EnemyData, MapData } from '../../src/types/index.js';
import { BESTIARY_STEPS, TEMPLATE_PLACEHOLDERS, type BestiaryTemplateKey } from '../../src/types/bestiaryData.js';
import { placeholdersOf } from '../../src/core/bestiaryValidation.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = <T>(f: string): T => parse(readFileSync(join(root, f), 'utf-8')) as T;
interface RawBestiary {
  habitats: { maps: string[]; zones: Record<string, string> };
  backgrounds: { default: string; enemies: Record<string, string> };
  anim: { order: string[] };
  labels: Record<string, unknown>;
  templates: Record<string, string>;
  elements: Record<string, string>;
  families: Record<string, string>;
  help: string;
}
const b = read<RawBestiary>('assets/data/bestiary.yaml');
const enemies = read<EnemyData[]>('assets/data/enemies.yaml');
const compiled = read<string[]>('assets/maps/ai/index.yaml');
const mapOf = (id: string): MapData => read<MapData>(`assets/maps/ai/${id}.yaml`);

const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);

describe('bestiary.yaml', () => {
  it('every background id has a staged image; every override key is an enemy', () => {
    for (const id of [b.backgrounds.default, ...Object.values(b.backgrounds.enemies)]) {
      expect(existsSync(join(root, `assets/backgrounds/${id}.webp`)), id).toBe(true);
    }
    const ids = new Set(enemies.map((e) => e.id));
    for (const k of Object.keys(b.backgrounds.enemies)) expect(ids.has(k), k).toBe(true);
  });

  it('every element and family used in enemies.yaml has a label', () => {
    for (const e of enemies) {
      const p = e.elementalProfile;
      for (const el of [e.weakness, e.resist, ...(p ? [...p.weaknesses, ...p.resistances, ...p.immunities, ...p.absorbs] : [])]) {
        if (el) expect(b.elements[el], `${e.id}: ${el}`).toBeTypeOf('string');
      }
      if (e.family) expect(b.families[e.family], `${e.id}: ${e.family}`).toBeTypeOf('string');
    }
  });

  it('zone labels name encounterZones of scanned maps; every compiled map with encounters is scanned', () => {
    const zoneIds = new Set(b.habitats.maps.flatMap((id) => (mapOf(id).encounterZones ?? []).map((z) => z.id)));
    for (const k of Object.keys(b.habitats.zones)) expect(zoneIds.has(k), k).toBe(true);
    for (const id of compiled) {
      const m = mapOf(id);
      const has = (m.encounters?.length ?? 0) > 0 || (m.encounterZones?.length ?? 0) > 0 || (m.scriptedEncounters?.length ?? 0) > 0;
      if (has) expect(b.habitats.maps, id).toContain(id);
    }
  });

  it('anim.order names only known steps', () => {
    for (const s of b.anim.order) expect(BESTIARY_STEPS as readonly string[]).toContain(s);
  });

  it('every label and template is ASCII; every template uses only its documented placeholders', () => {
    for (const s of [...strings(b.labels), ...strings(b.templates), ...strings(b.elements), ...strings(b.families), b.help]) {
      expect(s).toMatch(/^[\x20-\x7e]*$/);
    }
    for (const [k, t] of Object.entries(b.templates)) {
      const allowed: readonly string[] = TEMPLATE_PLACEHOLDERS[k as BestiaryTemplateKey];
      expect(allowed, k).toBeDefined();
      for (const p of placeholdersOf(t)) expect(allowed, `${k}: {${p}}`).toContain(p);
    }
  });
});
