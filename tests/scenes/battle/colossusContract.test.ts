/**
 * The colossus.json contract (docs/CHAOS_FORMS_PLAN.md 18.5, RIG finding 1, B3): the TS reader defines the shape and
 * the Python build (`colossus_build.py`) writes it. `tests/fixtures/colossus/contract.json` is the shared fixture
 * (written by makeFixture.mjs; the Python selftest regenerates the same form and compares the parsed json):
 * - a form is {canvas, scale, place, anchors, targetRect [x, y, w, h], coverBox?, visibleBox?, skyDim?, layers};
 * - a layer is {name, kind, blend?: normal | add, alpha?, frames: {base, crack?, open?, ...}} (variants are frames);
 * - a frame is {at, size, texScale?, tiles: [{file, x, y, w, h}], pivot?}: tiles in texture px, relative to the frame,
 *   covering ceil(size / texScale) exactly; the glow is stored at half res (texScale 2);
 * - no `image`, `variants` or canvas-relative tile key.
 */
import { describe, it, expect } from 'vitest';
import { formProblems, readColossusIndex, textureSize, type ColossusFormSpec } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { CONTRACT, contractRaw } from '../../helpers/colossusFixture.js';

const raw = contractRaw() as { version: number; forms: Record<string, ColossusFormSpec> };
const form = (): ColossusFormSpec => structuredClone(raw.forms[CONTRACT]);

describe('colossus.json contract (18.5)', () => {
  it('the contract form reads with zero problems and survives readColossusIndex', () => {
    expect(raw.version).toBe(1);
    expect(Object.keys(raw.forms)).toEqual([CONTRACT]);
    expect(formProblems(CONTRACT, form())).toEqual([]);
    expect(readColossusIndex(raw).forms[CONTRACT]).toEqual(raw.forms[CONTRACT]);
  });

  it('the form keys are exactly the reader\'s; targetRect is [x, y, w, h] inside the canvas', () => {
    const f = form();
    const allowed = ['canvas', 'scale', 'place', 'anchors', 'targetRect', 'coverBox', 'visibleBox', 'skyDim', 'layers'];
    expect(Object.keys(f).filter((k) => !allowed.includes(k))).toEqual([]);
    expect(f).toMatchObject({ canvas: [2700, 1080], scale: 1, place: [-527, -210], skyDim: 0.6, targetRect: [1170, 345, 360, 495] });
    const [x, y, w, h] = f.targetRect;
    expect(w > 0 && h > 0 && x + w <= f.canvas[0] && y + h <= f.canvas[1]).toBe(true);
  });

  it('every layer has a base frame, no `image` / `variants` key, and only reader keys', () => {
    for (const l of form().layers) {
      expect(l.frames.base, l.name).toBeDefined();
      expect(Object.keys(l).filter((k) => !['name', 'kind', 'blend', 'alpha', 'frames', 'orbit'].includes(k)), l.name).toEqual([]);
      for (const fr of Object.values(l.frames)) {
        expect(Object.keys(fr).filter((k) => !['at', 'size', 'texScale', 'tiles', 'pivot'].includes(k)), l.name).toEqual([]);
      }
    }
    expect(form().layers.map((l) => l.name)).toEqual(['glow', 'body', 'core', 'corona']);
    expect(Object.keys(form().layers.find((l) => l.name === 'core')!.frames)).toEqual(['base', 'crack', 'open']);
  });

  it('the glow is additive at rest alpha 1.0 and stored at texScale 2 (one 1350x540 tile)', () => {
    const glow = form().layers.find((l) => l.kind === 'glow')!;
    expect(glow).toMatchObject({ blend: 'add', alpha: 1 });
    expect(glow.frames.base).toMatchObject({ at: [0, 0], size: [2700, 1080], texScale: 2 });
    expect(glow.frames.base.tiles.map((t) => [t.x, t.y, t.w, t.h])).toEqual([[0, 0, 1350, 540]]);
    expect(form().layers.find((l) => l.name === 'corona')).toMatchObject({ blend: 'add', alpha: 1 });
    expect(form().layers.find((l) => l.name === 'body')!.blend).toBeUndefined();
  });

  it('tiles are frame-relative texture px, <= 2048, abutting and covering the frame texture exactly', () => {
    for (const l of form().layers) for (const [name, fr] of Object.entries(l.frames)) {
      const [tw, th] = textureSize(fr);
      let area = 0;
      for (const t of fr.tiles) {
        expect(t.w <= 2048 && t.h <= 2048, `${l.name}/${name}`).toBe(true);
        expect(t.x >= 0 && t.y >= 0 && t.x + t.w <= tw && t.y + t.h <= th, `${l.name}/${name}`).toBe(true);
        expect(t.file.startsWith(`${CONTRACT}/${l.name}_${name}`), t.file).toBe(true);
        area += t.w * t.h;
      }
      if (fr.tiles.length) expect(area, `${l.name}/${name}`).toBe(tw * th);
      const xs = [...fr.tiles].sort((a, b) => a.x - b.x);
      for (let i = 1; i < xs.length; i++) expect(xs[i].x).toBe(xs[i - 1].x + xs[i - 1].w);
    }
    const body = form().layers.find((l) => l.name === 'body')!.frames.base;
    expect(body.tiles.map((t) => [t.x, t.w])).toEqual([[0, 2048], [2048, 652]]);
  });

  it('the reader refuses the rev-3 shape and bad rev-4 values', () => {
    const bad = (mut: (f: ColossusFormSpec) => void, re: RegExp): void => {
      const f = form();
      mut(f);
      expect(formProblems('x', f).join('; ')).toMatch(re);
    };
    bad((f) => { f.layers[0].frames.base.tiles[0].w = 2700; }, /over 2048|leaves its frame/);
    bad((f) => { f.layers[0].frames.base.texScale = 1; }, /cover the frame's texture/);
    bad((f) => { f.layers[0].frames.base.texScale = 0; }, /texScale/);
    bad((f) => { (f.layers[0] as { blend: string }).blend = 'screen'; }, /blend/);
    bad((f) => { f.layers[0].alpha = 1.5; }, /alpha/);
    bad((f) => { f.skyDim = 0; }, /skyDim/);
    bad((f) => { f.targetRect = [1170, 345, 0, 495]; }, /targetRect/);
    bad((f) => { f.scale = 0; }, /scale/);
    expect(formProblems('x', { ...form(), scale: 1.5 })).toEqual([]);   // no integer-scale assumption (18.1)
  });
});
