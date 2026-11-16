/**
 * V8 F9 (docs/REDESIGN_FIX_PLAN.md, D-O8): the bestiary's Weak / Resist values never run into the next label. Every
 * enemy's page fits the 17-line budget with no text cut (its own module instance, so no earlier warning hides one),
 * and the stats panel puts the right column past 28 measured glyphs.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { BitmapText, Container } from 'pixi.js';
import type { EnemyData } from '../../../src/types/index.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import { buildEntries, statLines, COLUMN_CHARS, STAT_LINES } from '../../../src/scenes/bestiary/bestiaryModel.js';
import { BestiaryStatsPanel, STATS_RECT } from '../../../src/scenes/bestiary/BestiaryStatsPanel.js';
import { glyphWidth } from '../../../src/scenes/battle/battleMessageUtils.js';
import { FONT_SIZE } from '../../../src/core/LayoutConstants.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = <T>(f: string): T => parse(readFileSync(join(root, f), 'utf-8')) as T;

describe('bestiary Weak / Resist spacing (V8 F9)', () => {
  it('every enemy in enemies.yaml: at most 17 lines and no bestiary warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const enemies = read<EnemyData[]>('assets/data/enemies.yaml');
    const data = validateBestiary(read<unknown>('assets/data/bestiary.yaml'));
    const entries = buildEntries(enemies, data, new Map(), () => true);
    // CHAOS_FORMS_PLAN R11: the 3 boss form records (`formOf`) are not top-level entries; their pages must fit too
    const forms = enemies.filter((e) => e.formOf);
    expect([entries.length, forms.length]).toEqual([enemies.length - 3, 3]);
    const formEntries = buildEntries(forms.map((e) => ({ ...e, formOf: undefined })), data, new Map(), () => true);
    for (const e of [...entries, ...formEntries]) expect(statLines(e, data).length, e.id).toBeLessThanOrEqual(STAT_LINES);
    expect(warn.mock.calls.filter((c) => String(c[0]).startsWith('Bestiary:'))).toEqual([]);
    warn.mockRestore();
  });

  it('the right column starts at or past 28 measured glyphs; both columns fit the window', () => {
    const panel = new BestiaryStatsPanel(new Container());
    const xs = panel.window.children.filter((c): c is BitmapText => c instanceof BitmapText).map((c) => c.x).sort((a, b) => a - b);
    const right = xs[xs.length - 1] - xs[0];
    expect(right).toBeGreaterThanOrEqual(COLUMN_CHARS * glyphWidth(FONT_SIZE));
    // the content area: the window less its padding on both sides (xs[0] is the left padding)
    expect(xs[0] + right + COLUMN_CHARS * glyphWidth(FONT_SIZE)).toBeLessThanOrEqual(STATS_RECT.width - xs[0]);
  });
});
