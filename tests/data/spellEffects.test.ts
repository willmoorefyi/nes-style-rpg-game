/**
 * Fd (docs/FEEDBACK_PLAN_2026-11-14.md §3.4): every spell, every battle consumable and every ranged attack has an
 * effect, and every effect's glyphs exist in the generated atlas (assets/sprites/battle-fx.json). On the F0 data
 * (empty spells / items tables) the coverage tests fail.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { validateSpellEffects } from '../../src/core/schemaValidationFx.js';
import { toFxData, effectIdFor, lookProblem } from '../../src/scenes/battle/fx/fxDefs.js';
import { ItemEffects } from '../../src/systems/ItemEffects.js';
import type { EnemyData, ItemData, SpellData } from '../../src/types/index.js';

afterEach(() => { vi.restoreAllMocks(); });

const yaml = <T>(file: string): T => parse(readFileSync(`assets/data/${file}`, 'utf-8')) as T;
const fx = toFxData(validateSpellEffects(yaml('spell-effects.yaml')));
const raw = yaml<{ effects: Record<string, Record<string, unknown>> }>('spell-effects.yaml');
const atlas = JSON.parse(readFileSync('assets/sprites/battle-fx.json', 'utf-8')) as { scale: number; glyphs: Record<string, { fixed?: boolean }> };
/** `glyph.ramp`, or the glyph's only (fixed) ramp: the heat shimmer is always fire, the icons always `icon`. */
const inAtlas = (glyph: string, ramp: string | undefined): boolean =>
  atlas.glyphs[`${glyph}.${ramp}`] !== undefined || Object.entries(atlas.glyphs).some(([k, g]) => k.startsWith(`${glyph}.`) && g.fixed);
const spells = yaml<SpellData[]>('spells.yaml');
const items = yaml<ItemData[]>('items.yaml');
const enemies = yaml<EnemyData[]>('enemies.yaml');
const battleItems = items.filter((i) => i.type === 'consumable' && !ItemEffects.isPartyItem(i.id));

describe('spell-effects.yaml coverage', () => {
  it('loads with no dropped entry', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    toFxData(validateSpellEffects(yaml('spell-effects.yaml')));
    expect(error).not.toHaveBeenCalled();
    expect(Object.keys(fx.effects)).toEqual(Object.keys(raw.effects));
  });

  it.each(spells.map((s) => [s.id, s] as const))('spell %s has its own effect', (id, s) => {
    const effect = fx.spells[id];
    expect(effect, `spells.${id}`).toBeDefined();
    // the byEffect fallback agrees on the kind of effect a spell like it would get
    expect(effectIdFor(fx, { spellId: 'unlisted', spell: { effect: s.effect, element: s.element } })).not.toBeNull();
  });

  it('the battle consumables are the six of act 1 and each has an effect', () => {
    expect(battleItems.map((i) => i.id).sort()).toEqual(['antidote', 'ether', 'hi_potion', 'phoenix_down', 'potion', 'soft']);
    for (const i of battleItems) expect(fx.items[i.id], `items.${i.id}`).toBeDefined();
  });

  it('every ranged enemy attack has an effect', () => {
    const ranged = enemies.filter((e) => e.attack === 'ranged');
    expect(ranged.length).toBeGreaterThan(0);
    for (const e of ranged) expect(effectIdFor(fx, { attackEffect: e.attackEffect }), e.id).toBe(fx.attacks[e.attackEffect ?? '']);
    for (const e of ranged) expect(fx.attacks[e.attackEffect ?? ''], e.id).toBeDefined();
  });

  it('the kinds of the effect table (§3.4): fire rises, ice falls, lightning bolts, holy rings, LIFE beams', () => {
    const kind = (spell: string): string => fx.effects[fx.spells[spell]].kind;
    expect([kind('fire'), kind('ice'), kind('lit'), kind('harm'), kind('life'), kind('fog'), kind('slow')])
      .toEqual(['rise', 'fall', 'bolt', 'ring', 'beam', 'chevrons', 'chevrons']);
    expect(fx.effects.fire).toMatchObject({ frames: 30, impact: 18 });
    expect(fx.effects.lightning).toMatchObject({ frames: 24, impact: 10 });
    expect(fx.effects.revive).toMatchObject({ frames: 44, impact: 30 });
    expect(fx.effects.glint).toMatchObject({ frames: 14, impact: 0 }); // the raised hold after its 4-frame delay (18 - 4)
    expect(fx.effects.impact_dust).toMatchObject({ frames: 14, impact: 0 });
  });
});

describe('effects against the atlas', () => {
  it.each(Object.entries(fx.effects))('%s: impact < frames and its glyphs are in battle-fx.json', (_id, e) => {
    expect(e.impact).toBeLessThan(e.frames);
    expect(e.impact).toBeGreaterThanOrEqual(0);
    for (const [glyph, ramp] of [[e.glyph, e.ramp], [e.accent, e.accentRamp ?? e.ramp], [e.mark, e.markRamp ?? e.ramp]]) {
      if (!glyph) continue;
      expect(inAtlas(glyph, ramp), `${glyph}.${ramp}`).toBe(true);
    }
  });

  it('the atlas is drawn at x2 (integer, nearest)', () => {
    expect(atlas.scale).toBe(2);
  });

  it('look fields are checked: a bad anchor or a mark without its status is dropped', () => {
    expect(lookProblem({ at: 'knee' })).toMatch(/anchor/);
    expect(lookProblem({ mark: 'z' })).toMatch(/status/);
    expect(lookProblem({ flash: 3 })).toMatch(/flash/);
    expect(lookProblem({ scale: 1.5 })).toMatch(/scale/);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = toFxData({ effects: { a: { kind: 'rise', frames: 4, impact: 1, at: 'knee' } as never }, spells: { s: 'a' }, items: {}, attacks: {} });
    expect(data.effects).toEqual({});
    expect(data.spells).toEqual({});
    expect(error).toHaveBeenCalledTimes(1);
  });
});
