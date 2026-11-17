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
import { formChain, formPages, formSubEntries, listedCount, topLevel, withFormSubEntries } from '../../../src/scenes/bestiary/bestiaryForms.js';
import { linkTarget, pageCount, pageEntry } from '../../../src/scenes/bestiary/bestiaryInfo.js';
import { backgroundFor } from '../../../src/scenes/bestiary/bestiaryHabitats.js';
import { ColossusArt } from '../../../src/rendering/ColossusArt.js';
import { BestiaryColossus } from '../../../src/scenes/bestiary/bestiaryColossus.js';
import { buildEntries, statLines, titleCount } from '../../../src/scenes/bestiary/bestiaryModel.js';
import { PREVIEW_INNER } from '../../../src/scenes/bestiary/BestiaryPreview.js';
import { panelCentre } from '../../../src/scenes/bestiary/bestiaryFit.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import type { EnemyData } from '../../../src/types/index.js';
import { colossusEnemy, fixtureArt, fixtureIo, HORIZON, ORRERY, WIDE } from '../../helpers/colossusFixture.js';
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
    for (const form of [ORRERY]) {
      const b = await shown(form);
      expect(b.view!.art.scale.x).toBe(1);
      expect(b.cropped).toBe(false);
      const c = b.visibleCentre();
      expect(Math.abs(c.x - CX), form).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y - CY), form).toBeLessThanOrEqual(1);
      b.dispose();
    }
  });

  it('rev 4: the painted F3 (2700x1080) is cropped until its pre-composited still lands (18.8, D-O21)', async () => {
    const b = await shown(HORIZON);
    expect(b.view!.art.scale.x).toBe(1);
    expect(b.cropped).toBe(true);
    b.dispose();
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

/**
 * C7 (docs/CHAOS_FIX_PLAN.md 3, test 5.4; C6-3, C6-13) on the real data: the scene's list carries the sub-entries after
 * their root, the title total counts top-level entries only (D-C7-10), F4 is the Horizon entry's 4th and 5th page, the
 * form ids resolve as deep links, `mode: seen` hides each form until its SEEN flag, a form phase names the form, and
 * all four ids stand on the rim.
 */
describe('C7: the form sub-entries wired on the real data', () => {
  const real = parse(readFileSync('assets/data/enemies.yaml', 'utf-8')) as EnemyData[];
  const list = (d = data, isSeen: (id: string) => boolean = () => true) =>
    withFormSubEntries(buildEntries(real, d, new Map(), isSeen), real, d, isSeen);
  const byId = (entries: ReturnType<typeof list>, id: string) => entries.find((e) => e.id === id)!;
  const flat = (lines: { left: string; right?: string }[]): string =>
    lines.map((l) => `${l.left} ${l.right ?? ''}`.replace(/\s+/g, ' ').trim()).join('\n');

  it('lists Chaos (Orrery) and Chaos (Horizon) right after 128 Chaos; the title total is 127 (top-level only)', () => {
    const entries = list();
    const at = entries.findIndex((e) => e.id === 'chaos');
    expect(entries.slice(at, at + 3).map((e) => e.label)).toEqual(['128 Chaos', '128 Chaos (Orrery)', '128 Chaos (Horizon)']);
    expect(entries).toHaveLength(129);
    expect(listedCount(entries)).toBe(127);
    expect(titleCount(entries[at + 1], listedCount(entries), data)).toBe('128 Chaos (Orrery)  127/127');
    expect(titleCount(entries[at + 2], listedCount(entries), data)).toBe('128 Chaos (Horizon)  127/127');
  });

  it('F4 is the Horizon entry\'s page: F3 stats, F3 info, then F4 stats and F4 info ("128 Chaos (Core)")', () => {
    const horizon = byId(list(), 'chaos_horizon');
    expect(pageCount(horizon, data)).toBe(4);
    expect(pageEntry(horizon, data, 1).entry.id).toBe('chaos_horizon');
    const f4 = pageEntry(horizon, data, 2);
    expect([f4.entry.id, f4.page, f4.entry.label]).toEqual(['chaos_horizon_core', 0, '128 Chaos (Core)']);
    expect(pageEntry(horizon, data, 3)).toMatchObject({ page: 1, entry: { id: 'chaos_horizon_core' } });
    expect(pageCount(byId(list(), 'chaos_orrery'), data)).toBe(2);
    expect(pageCount(byId(list(), 'chaos'), data)).toBe(3);           // stats, info, its one lore page
  });

  it('the four deep links: a sub-entry id opens it; chaos_horizon_core opens the Horizon entry on F4\'s first page', () => {
    const entries = list();
    const idx = (id: string) => entries.findIndex((e) => e.id === id);
    expect(linkTarget(entries, 'chaos', data)).toEqual({ index: idx('chaos'), page: 0 });
    expect(linkTarget(entries, 'chaos_orrery', data)).toEqual({ index: idx('chaos_orrery'), page: 0 });
    expect(linkTarget(entries, 'chaos_horizon', data)).toEqual({ index: idx('chaos_horizon'), page: 0 });
    expect(linkTarget(entries, 'chaos_horizon_core', data)).toEqual({ index: idx('chaos_horizon'), page: 2 });
    expect(linkTarget(entries, 'no_such_enemy', data)).toBeNull();
  });

  it('mode: seen hides each form and the F4 page until its SEEN flag; mode: all shows them all', () => {
    const seenData = { ...data, mode: 'seen' as const };
    const flags = new Set(['chaos', 'chaos_orrery']);
    let entries = list(seenData, (id) => flags.has(id));
    expect(byId(entries, 'chaos_orrery').seen).toBe(true);
    expect(byId(entries, 'chaos_horizon')).toMatchObject({ seen: false, label: `128 ${data.labels.unknown}` });
    const hidden = pageEntry(byId(entries, 'chaos_horizon'), seenData, 2).entry;
    expect(hidden).toMatchObject({ id: 'chaos_horizon_core', seen: false, label: `128 ${data.labels.unknown}` });
    expect(flat(statLines(hidden, seenData))).toContain(`HP ${data.labels.blank}`);
    flags.add('chaos_horizon');
    flags.add('chaos_horizon_core');
    entries = list(seenData, (id) => flags.has(id));
    expect(pageEntry(byId(entries, 'chaos_horizon'), seenData, 2).entry).toMatchObject({ seen: true, label: '128 Chaos (Core)' });
    expect(list(data, () => false).filter((e) => e.enemy.name === 'Chaos').every((e) => e.seen)).toBe(true);
  });

  it('C6-13: a form phase names the form ("At 70% HP becomes the Orrery"); the HP line fits a 5-digit pool', () => {
    const entries = list();
    expect(data.templates.phaseForm).toBe('becomes the {form}');
    expect(flat(statLines(byId(entries, 'chaos'), data))).toContain('At 70% HP becomes the Orrery');
    expect(flat(statLines(byId(entries, 'chaos_orrery'), data))).toContain('At 40% HP becomes the Horizon');
    expect(flat(statLines(byId(entries, 'chaos_horizon'), data))).toContain('At 15% HP becomes the Core');
    const big = { ...byId(entries, 'chaos'), enemy: { ...byId(entries, 'chaos').enemy, stats: { ...byId(entries, 'chaos').enemy.stats, hp: 20000 } } };
    expect(statLines(big, data)[0].left).toBe('HP         20000');
  });

  it('C6-13: Chaos and its three form ids stand on the rim', () => {
    for (const id of ['chaos', 'chaos_orrery', 'chaos_horizon', 'chaos_horizon_core']) expect(backgroundFor(id, [], data), id).toBe('rim');
  });

  it('F4 on a fresh art source shows its own still (colossus/chaos_horizon_core/preview.png), not F3\'s', async () => {
    const io = fixtureIo(JSON.parse(readFileSync('assets/sprites/colossus.json', 'utf-8')));
    const load = vi.spyOn(io, 'load');
    const b = new BestiaryColossus(new Container(), new ColossusArt(io));
    await b.show(real.find((e) => e.id === 'chaos_horizon_core')!);
    expect(load.mock.calls.map((c) => c[0])).toEqual(['colossus/chaos_horizon_core/preview.png']);
    b.dispose();
  });
});
