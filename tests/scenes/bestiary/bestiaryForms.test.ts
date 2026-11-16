/**
 * Bestiary hooks for Chaos's forms (docs/CHAOS_FORMS_PLAN.md 8, D-O7, R11, R22) on fixture records: form records are
 * not top-level entries, the art forms are sub-entries in chain order (a data form that reuses its art is a page of
 * that entry), an unseen form is hidden under `mode: seen`, and a colossus preview is drawn at scale 1 with its
 * `visibleBox` centred on the panel within 1 px; a canvas wider than 940 art px shows the rest-view crop. The F1
 * (atlas) preview path is unchanged (bestiaryCentre.test.ts).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { formChain, formPages, formSubEntries, topLevel } from '../../../src/scenes/bestiary/bestiaryForms.js';
import { BestiaryColossus } from '../../../src/scenes/bestiary/bestiaryColossus.js';
import { buildEntries } from '../../../src/scenes/bestiary/bestiaryModel.js';
import { PREVIEW_INNER } from '../../../src/scenes/bestiary/BestiaryPreview.js';
import { panelCentre } from '../../../src/scenes/bestiary/bestiaryFit.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import type { EnemyData } from '../../../src/types/index.js';
import { colossusEnemy, fixtureArt, HORIZON, ORRERY, WIDE } from '../../helpers/colossusFixture.js';
import { testEnemy } from '../../helpers/testUtils.js';

const data = validateBestiary(parse(readFileSync('assets/data/bestiary.yaml', 'utf-8')));
const [CX, CY] = panelCentre(PREVIEW_INNER);

afterEach(() => { vi.restoreAllMocks(); });

const phase = (form: string, t: number) => ({ hpThreshold: t, patternId: 'aggressive', form, interlude: 'i' });
function chain(): EnemyData[] {
  const f1 = testEnemy({ id: 'chaos', name: 'Chaos', num: 128, size: 'boss', bossPhases: [phase('chaos_orrery', 0.7)] });
  const f2 = { ...colossusEnemy(ORRERY, { id: 'chaos_orrery', bossPhases: [phase('chaos_horizon', 0.4)] }), formOf: 'chaos' };
  const f3 = { ...colossusEnemy(HORIZON, { id: 'chaos_horizon', bossPhases: [phase('chaos_horizon_core', 0.15)] }), formOf: 'chaos' };
  const f4 = { ...colossusEnemy(HORIZON, { id: 'chaos_horizon_core' }), formOf: 'chaos', colossusVariant: { core: 'open' } };
  const goblin = testEnemy({ id: 'goblin', num: 1 });
  return [goblin, f2, f1, f4, f3];
}

describe('form entries', () => {
  it('records with formOf are not top-level entries; the chain follows the form phases from the root', () => {
    const all = chain();
    expect(topLevel(all).map((e) => e.id)).toEqual(['goblin', 'chaos']);
    expect(formChain('chaos', all).map((e) => e.id)).toEqual(['chaos', 'chaos_orrery', 'chaos_horizon', 'chaos_horizon_core']);
    expect(buildEntries(topLevel(all), data, new Map(), () => true).map((e) => e.id)).toEqual(['goblin', 'chaos']);
  });

  it('the art forms are sub-entries in chain order; F4 (the same art) is a page of the Horizon entry', () => {
    const all = chain();
    const [root] = buildEntries(topLevel(all), data, new Map(), () => true).filter((e) => e.id === 'chaos');
    const subs = formSubEntries(root, all, data, () => true, (id) => ({ chaos_orrery: 'Orrery', chaos_horizon: 'Horizon' }[id] ?? id));
    expect(subs.map((e) => e.id)).toEqual(['chaos_orrery', 'chaos_horizon']);
    expect(subs.map((e) => e.label)).toEqual(['128 Chaos (Orrery)', '128 Chaos (Horizon)']);
    expect(formPages('chaos_horizon', all).map((e) => e.id)).toEqual(['chaos_horizon', 'chaos_horizon_core']);
    expect(formPages('chaos_orrery', all).map((e) => e.id)).toEqual(['chaos_orrery']);
  });

  it('an unseen form shows ??? under mode: seen; mode: all shows every form', () => {
    const all = chain();
    const seen = (id: string): boolean => id !== 'chaos_horizon';
    const [root] = buildEntries(topLevel(all), data, new Map(), seen).filter((e) => e.id === 'chaos');
    const subs = formSubEntries(root, all, { ...data, mode: 'seen' }, seen, () => 'X');
    expect(subs.map((e) => [e.id, e.seen])).toEqual([['chaos_orrery', true], ['chaos_horizon', false]]);
    expect(subs[1].label).toBe(`128 ${data.labels.unknown}`);
    expect(formSubEntries(root, all, { ...data, mode: 'all' }, seen, () => 'X').every((e) => e.seen)).toBe(true);
  });
});

describe('the colossus preview (scale 1)', () => {
  async function shown(form: string): Promise<BestiaryColossus> {
    const b = new BestiaryColossus(new Container(), await fixtureArt([form]));
    await b.show(colossusEnemy(form));
    return b;
  }

  it('a canvas that fits is drawn whole at scale 1 with its visibleBox centred on the panel (1 px)', async () => {
    for (const form of [ORRERY, HORIZON]) {
      const b = await shown(form);
      expect(b.view!.art.scale.x).toBe(1);
      expect(b.cropped).toBe(false);
      const c = b.visibleCentre();
      expect(Math.abs(c.x - CX), form).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y - CY), form).toBeLessThanOrEqual(1);
      b.dispose();
    }
  });

  it('a canvas wider than 940 art px shows the rest-view crop, centred and masked to the panel', async () => {
    const b = await shown(WIDE);
    expect(b.cropped).toBe(true);
    const m = b.cropRect()!;
    expect(m.width).toBeLessThanOrEqual(PREVIEW_INNER.right - PREVIEW_INNER.left);
    expect(Math.abs(m.x + m.width / 2 - CX)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.y + m.height / 2 - CY)).toBeLessThanOrEqual(1);
    b.dispose();
  });

  it('the loop plays idle, then attack, hurt and cast (the colossus timelines)', async () => {
    const b = await shown(ORRERY);
    const modes: string[] = [];
    for (let f = 0; f < 600; f++) { b.update(1); const m = b.mode; if (modes[modes.length - 1] !== m) modes.push(m); }
    expect(modes.slice(0, 7)).toEqual(['idle', 'slam', 'idle', 'hurt', 'idle', 'cast', 'idle']);
    b.dispose();
  });
});
