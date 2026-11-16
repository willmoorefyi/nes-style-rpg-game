/**
 * The bestiary still of a colossus form (docs/CHAOS_FORMS_PLAN.md 18.8, D-O21): the `colossus` build writes
 * `colossus/<form>/preview.png` (body + additive glow over rim with the sky dim, fit into 940 x 720, opaque) next to the
 * form's tiles; the bestiary shows it centred on the preview panel at scale 1, loads no layer tiles for it, and destroys
 * it on the next entry and on exit. A form without a still (the synthetic fixture) or whose still fails to load shows
 * the live rest-view crop instead (bestiaryForms.test.ts).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Container, Sprite } from 'pixi.js';
import { BestiaryColossus } from '../../../src/scenes/bestiary/bestiaryColossus.js';
import { PREVIEW_INNER } from '../../../src/scenes/bestiary/BestiaryPreview.js';
import { panelCentre } from '../../../src/scenes/bestiary/bestiaryFit.js';
import { ColossusArt } from '../../../src/rendering/ColossusArt.js';
import { colossusEnemy, fixtureIo, fixtureRaw, HORIZON } from '../../helpers/colossusFixture.js';

afterEach(() => { vi.restoreAllMocks(); });
const [CX, CY] = panelCentre(PREVIEW_INNER);

/** The fixture's F3 stand-in as a built form: its tiles renamed under colossus/chaos_horizon/ (the build's layout). */
function builtRaw(): unknown {
  const raw = fixtureRaw() as { forms: Record<string, unknown> };
  const f = JSON.parse(JSON.stringify(raw.forms[HORIZON]).split(`${HORIZON}/`).join('colossus/chaos_horizon/'));
  return { version: 1, forms: { chaos_horizon: f } };
}

describe('the bestiary still (18.8)', () => {
  it('a built form shows its preview.png centred at scale 1; no layer tile is loaded; released on the next entry and on exit', async () => {
    const io = fixtureIo(builtRaw());
    const load = vi.spyOn(io, 'load');
    const art = new ColossusArt(io);
    const parent = new Container();
    const b = new BestiaryColossus(parent, art);
    await b.show(colossusEnemy('chaos_horizon', { id: 'chaos_horizon' }));
    expect(load.mock.calls.map((c) => c[0])).toEqual(['colossus/chaos_horizon/preview.png']);
    expect(b.view).toBeNull();
    const still = b.still!;
    expect(still).toBeInstanceOf(Sprite);
    expect(still.parent).toBe(parent);
    expect(still.scale.x).toBe(1);
    expect(still.x + still.width / 2).toBeCloseTo(CX, 0);
    expect(still.y + still.height / 2).toBeCloseTo(CY, 0);
    expect(b.visibleCentre()).toEqual({ x: still.x + still.width / 2, y: still.y + still.height / 2 });
    expect(art.liveTextures).toBe(1);
    b.update(5);                                      // a still has no loop
    await b.show(null);
    expect(b.still).toBeNull();
    expect(art.liveTextures).toBe(0);
    await b.show(colossusEnemy('chaos_horizon', { id: 'chaos_horizon' }));
    b.dispose();
    expect(b.still).toBeNull();
    expect(art.liveTextures).toBe(0);
  });

  it('a still that fails to load falls back to the live rest-view crop (warned)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const io = fixtureIo(builtRaw());
    const blank = io.load.bind(io);
    io.load = (file, w, h) => (file.endsWith('preview.png') ? Promise.reject(new Error('404')) : blank(file, w, h));
    const b = new BestiaryColossus(new Container(), new ColossusArt(io));
    await b.show(colossusEnemy('chaos_horizon', { id: 'chaos_horizon' }));
    expect(b.still).toBeNull();
    expect(b.view).not.toBeNull();
    expect(b.cropped).toBe(true);
    expect(warn).toHaveBeenCalled();
    b.dispose();
  });

  it('the fixture form has no still: the live view as before', async () => {
    const b = new BestiaryColossus(new Container(), new ColossusArt(fixtureIo()));
    await b.show(colossusEnemy(HORIZON));
    expect(b.still).toBeNull();
    expect(b.view).not.toBeNull();
    b.dispose();
  });
});
