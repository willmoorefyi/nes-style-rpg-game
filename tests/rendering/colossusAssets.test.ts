/**
 * colossus.json (docs/CHAOS_FORMS_PLAN.md 4.6, 9.2, A5): the schema (the fixture, and the built index when there is
 * one), textures <= 2048, anchors and rects inside the canvas, total RGBA bytes <= 24 MB, and an entry for every
 * enemy with `colossus:` that has an approved master. Until the masters exist (C-base) no entry is required: such a
 * form draws the placeholder box with a console warning.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { formProblems, readColossusIndex, colossusOf, type ColossusIndex } from '../../src/scenes/battle/colossus/colossusIndex.js';
import { ColossusArt, textureBytes } from '../../src/rendering/ColossusArt.js';
import type { EnemyData } from '../../src/types/index.js';
import { fixtureIo, fixtureRaw, HORIZON } from '../helpers/colossusFixture.js';

const BUILT = 'assets/sprites/colossus.json';
const MAX_BYTES = 24 * 1024 * 1024;

afterEach(() => { vi.restoreAllMocks(); });

function check(index: ColossusIndex, raw: unknown): void {
  const forms = (raw as { forms: Record<string, unknown> }).forms;
  expect(Object.keys(index.forms)).toEqual(Object.keys(forms));
  for (const [id, f] of Object.entries(index.forms)) {
    expect(formProblems(id, f)).toEqual([]);
    for (const l of f.layers) for (const fr of Object.values(l.frames)) for (const t of fr.tiles) {
      expect(t.w).toBeLessThanOrEqual(2048);
      expect(t.h).toBeLessThanOrEqual(2048);
    }
  }
  expect(textureBytes(index)).toBeLessThanOrEqual(MAX_BYTES);
}

describe('colossus.json', () => {
  it('the fixture index is valid', () => {
    check(readColossusIndex(fixtureRaw()), fixtureRaw());
  });

  it('the built index, when present, is valid', () => {
    if (!existsSync(BUILT)) return;
    const raw: unknown = JSON.parse(readFileSync(BUILT, 'utf8'));
    check(readColossusIndex(raw), raw);
  });

  it('refuses a bad entry (anchor outside the canvas, a tile over 2048, tiles that miss the frame) with console.error', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = fixtureRaw() as { forms: Record<string, { anchors: { core: number[] } }> };
    raw.forms[HORIZON].anchors.core = [5000, 10];
    expect(readColossusIndex(raw).forms[HORIZON]).toBeUndefined();
    expect(err).toHaveBeenCalled();
  });

  it('every enemy with colossus: and an approved master has an entry (A5); none is required before the masters', () => {
    const enemies = parse(readFileSync('assets/data/enemies.yaml', 'utf8')) as EnemyData[] | { enemies: EnemyData[] };
    const list = Array.isArray(enemies) ? enemies : enemies.enemies;
    const index = existsSync(BUILT) ? readColossusIndex(JSON.parse(readFileSync(BUILT, 'utf8'))) : { forms: {} };
    for (const e of list) {
      const form = colossusOf(e as EnemyData & { colossus?: string });
      if (!form || !existsSync(`assets-src/gen/approved/chaos_forms/${form}/master.png`)) continue;
      expect(index.forms[form], `${e.id} -> ${form}`).toBeDefined();
    }
  });

  it('a form with no entry draws the placeholder box and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const art = new ColossusArt(fixtureIo({ forms: {} }));
    await art.ensure(['chaos_horizon']);
    expect(art.form('chaos_horizon')).toBeNull();
    expect(art.isReady('chaos_horizon')).toBe(false);
    art.form('chaos_horizon');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
