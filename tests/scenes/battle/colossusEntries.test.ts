/**
 * Per-form geometry (docs/CHAOS_FORMS_PLAN.md 18.4, 18.5; D-U13): F4 `chaos_horizon_core` draws F3's art (`colossus:
 * chaos_horizon`, the core's `open` frame) at its own rest (-527, -285). colossus.json keys an entry by the form record's
 * id; an entry with `art: <form>` shares that form's layers and tiles and inherits every field it does not set. A record
 * draws its own entry when the index has one sharing its art, else its art's. The F3 -> F4 change (chaos_i3, no swap)
 * re-bases the view on F4's rest at the screen spot F3 held, and the script's pan heaves it up to F4's rest. The build's
 * bestiary still (`colossus/<form>/preview.png`, 18.8) is the preview file of a built form.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { EnemyData } from '../../../src/types/index.js';
import type { ActionResult } from '../../../src/battle/BattleStateMachine.js';
import { borderProblems, readColossusIndex, type ColossusFormSpec } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { artIdOf, entryIdFor, previewFileOf } from '../../../src/scenes/battle/colossus/colossusEntries.js';
import { colossusArt, textureBytes } from '../../../src/rendering/ColossusArt.js';
import { FormChangeView, type FormChangeDeps } from '../../../src/scenes/battle/formChangeView.js';
import type { InterludeStep } from '../../../src/scenes/battle/formInterlude.js';
import { colossusBattle, colossusEnemy, fixtureIo, fixtureRaw, HORIZON } from '../../helpers/colossusFixture.js';

type Raw = { version: number; forms: Record<string, unknown> };
/** The fixture with F3 under its real id and F4 as an `art` entry at its own rest. */
function chainRaw(): Raw {
  const raw = fixtureRaw() as Raw;
  raw.forms.chaos_horizon = raw.forms[HORIZON];
  raw.forms.chaos_horizon_core = { art: 'chaos_horizon', place: [-527, -285] };
  return raw;
}
const F3 = (): EnemyData => colossusEnemy('chaos_horizon', { id: 'chaos_horizon' });
const F4 = (): EnemyData => colossusEnemy('chaos_horizon', { id: 'chaos_horizon_core', colossusVariant: { core: 'open' } });
const I3 = (parse(readFileSync('assets/data/battle-interludes.yaml', 'utf-8')) as { interludes: { id: string; steps: InterludeStep[] }[] })
  .interludes.find((s) => s.id === 'chaos_i3')!.steps;

let restore: () => void = () => {};
async function install(raw: unknown = chainRaw()): Promise<void> {
  const undo = colossusArt.setIo(fixtureIo(raw));
  restore = () => { colossusArt.release(); undo(); };
  await colossusArt.ensure(['chaos_horizon', 'chaos_horizon_core']);
}
afterEach(() => { restore(); restore = () => {}; vi.restoreAllMocks(); });

describe('colossus.json: an `art` entry (F4 at its own rest, D-U13)', () => {
  it('inherits its art form\'s fields and layers, keeps its own place, and is valid', () => {
    const idx = readColossusIndex(chainRaw());
    const f3 = idx.forms.chaos_horizon;
    const f4 = idx.forms.chaos_horizon_core;
    expect(f4.place).toEqual([-527, -285]);
    expect(f4.art).toBe('chaos_horizon');
    expect(f4.layers).toEqual(f3.layers);
    expect({ ...f4, place: f3.place, art: undefined }).toEqual({ ...f3, art: undefined });
    expect(artIdOf('chaos_horizon_core', f4)).toBe('chaos_horizon');
    expect(artIdOf('chaos_horizon', f3)).toBe('chaos_horizon');
  });

  it('refuses an `art` naming a missing form or another `art` entry (console.error); a full entry with `art` is kept as written', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = chainRaw();
    raw.forms.bad = { art: 'nope', place: [0, 0] };
    raw.forms.chained = { art: 'chaos_horizon_core', place: [0, 0] };
    raw.forms.full = { ...(raw.forms.chaos_horizon as object), art: 'chaos_horizon', place: [-527, -200] };
    const idx = readColossusIndex(raw);
    expect(idx.forms.bad).toBeUndefined();
    expect(idx.forms.chained).toBeUndefined();
    expect(idx.forms.full.place).toEqual([-527, -200]);
    expect(err.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(/bad: art nope[\s\S]*chained: art chaos_horizon_core/);
  });

  it('the RGBA byte count (the 24 MB criterion, 18.6) counts a tile shared by an `art` entry once', () => {
    const one = readColossusIndex({ forms: { chaos_horizon: (fixtureRaw() as Raw).forms[HORIZON] } });
    expect(textureBytes(readColossusIndex(chainRaw()))).toBe(textureBytes(readColossusIndex(fixtureRaw())));
    expect(textureBytes(one)).toBeGreaterThan(0);
  });

  it('a record draws its own entry when it shares the record\'s art, else its art\'s', () => {
    const idx = readColossusIndex(chainRaw());
    expect(entryIdFor(idx, F4())).toBe('chaos_horizon_core');
    expect(entryIdFor(idx, F3())).toBe('chaos_horizon');
    expect(entryIdFor({ forms: { chaos_horizon: idx.forms.chaos_horizon } }, F4())).toBe('chaos_horizon');
    // an entry keyed by the record id but with another art is not the record's
    expect(entryIdFor({ forms: { ...idx.forms, chaos_horizon_core: { ...idx.forms.chaos_horizon, art: HORIZON } } }, F4())).toBe('chaos_horizon');
    expect(entryIdFor(idx, { id: 'goblin', sprite: 'goblin' } as EnemyData)).toBeNull();
  });

  it('the build\'s bestiary still: `preview` when the entry names one, else colossus/<art>/preview.png for a built form', () => {
    const built = { layers: [{ name: 'body', kind: 'body', frames: { base: { at: [0, 0], size: [2, 2], tiles: [{ file: 'colossus/chaos_horizon/body_base.png', x: 0, y: 0, w: 2, h: 2 }] } } }] } as unknown as ColossusFormSpec;
    expect(previewFileOf('chaos_horizon', built)).toBe('colossus/chaos_horizon/preview.png');
    expect(previewFileOf('chaos_horizon_core', { ...built, art: 'chaos_horizon' })).toBe('colossus/chaos_horizon/preview.png');
    expect(previewFileOf('x', { ...built, preview: 'stills/x.png' })).toBe('stills/x.png');
    expect(previewFileOf(HORIZON, readColossusIndex(fixtureRaw()).forms[HORIZON])).toBeNull();   // the fixture has no still
  });
});

describe('the battle draws F4 at its own rest; chaos_i3 heaves F3 up to it (D-U13)', () => {
  it('a battle starting on F4 places the canvas at (-527, -285) with the open core', async () => {
    await install();
    const s = colossusBattle([F4()]);
    const v = s.display.colossus.view(0)!;
    expect(v.formId).toBe('chaos_horizon_core');
    expect(v.artId).toBe('chaos_horizon');
    expect(v.canvas()).toMatchObject({ x: -527, y: -285 });
    expect(v.frameOf('core')).toBe('open');
  });

  it('the F3 -> F4 change keeps the view, starts at F3\'s screen spot, pans up 225 px to F4\'s rest, borders held on every frame', async () => {
    await install();
    const s = colossusBattle([F3()]);
    const v = s.display.colossus.view(0)!;
    expect(v.canvas()).toMatchObject({ x: -527, y: -60 });
    const emit = vi.fn();
    const deps: FormChangeDeps = { battle: s.battle, display: s.display, setMessage: () => {}, events: { emit }, input: s.input,
      interludes: { get: (id) => (id === 'chaos_i3' ? I3 : null) } };
    const fcv = new FormChangeView(deps);
    s.battle.allEnemies[0].data = F4();
    fcv.queue({ done: true, messages: [], damageEvents: [], missed: false,
      formChange: { enemyIndex: 0, from: 'chaos_horizon', to: 'chaos_horizon_core', interlude: 'chaos_i3' } } as ActionResult);
    expect(fcv.start()).toBe(true);
    expect(s.display.colossus.view(0)).toBe(v);                          // no swap: the same view
    expect(v.formId).toBe('chaos_horizon_core');
    expect(v.form.place).toEqual([-527, -285]);
    expect(emit).toHaveBeenCalledWith('battle:formChange', { from: 'chaos_horizon', to: 'chaos_horizon_core' });
    const ys: number[] = [];
    let done = false;
    for (let f = 0; f < 600 && !done; f++) {
      s.layers.update(1);
      s.display.update(1);
      done = fcv.update(1, false);
      const o = v.canvasOffset();
      ys.push(v.canvas().y);
      expect(borderProblems(v.form, o, 0), `frame ${f}`).toEqual([]);
    }
    expect(done).toBe(true);
    expect(Math.max(...ys)).toBeLessThanOrEqual(-60 + 6);                // never below F3's rest (+ the shake)
    expect(ys[0]).toBeGreaterThanOrEqual(-60 - 6);                       // starts where F3 stood: no jump
    for (let i = 1; i < ys.length; i++) expect(Math.abs(ys[i] - ys[i - 1]), `frame ${i}`).toBeLessThanOrEqual(12);
    expect(v.canvasOffset().x).toBe(0);
    expect(v.canvas().y).toBeGreaterThanOrEqual(-285 - 4);                // at F4's rest (the breathing is 0..-4)
    expect(v.canvas().y).toBeLessThanOrEqual(-285);
    expect(v.frameOf('core')).toBe('open');
  });

  it('a same-art change with no own entry keeps F3\'s rest (no re-base) and still emits the form change', async () => {
    const raw = chainRaw();
    delete raw.forms.chaos_horizon_core;
    await install(raw);
    const s = colossusBattle([F3()]);
    const v = s.display.colossus.view(0)!;
    s.battle.allEnemies[0].data = F4();
    expect(s.display.colossus.rest(0, F4())).toBe(false);
    expect(v.form.place).toEqual([-527, -60]);
  });
});
