/**
 * FW-A2 (docs/REDESIGN_PLAN.md 1, rev 9): `monsterAnchors` validates the atlas `idleBox [l, t, r, b]` (inclusive art
 * px): all four inside the cell, l <= r, t <= b, whole numbers; anything else is dropped (the bestiary then measures
 * or keeps the old placement). Every committed atlas sheet carries a valid one equal to its idle frame's opaque box
 * read from the page PNG.
 */
import { describe, it, expect } from 'vitest';
import { monsterAnchors } from '../../src/rendering/monsterAnchors.js';
import { atlas, frameBox } from '../helpers/atlasFrames.js';

const cell: [number, number] = [80, 60];
const parse = (idleBox: unknown) => monsterAnchors({ cell, idleBox } as Parameters<typeof monsterAnchors>[0]).idleBox;

describe('monsterAnchors: idleBox (FW-A2)', () => {
  it('keeps a valid box, including a single pixel and the cell corners', () => {
    expect(parse([2, 3, 70, 55])).toEqual([2, 3, 70, 55]);
    expect(parse([5, 5, 5, 5])).toEqual([5, 5, 5, 5]);
    expect(parse([0, 0, 79, 59])).toEqual([0, 0, 79, 59]);
  });

  it.each([
    ['missing', undefined], ['not an array', '2,3,70,55'], ['three values', [2, 3, 70]], ['five values', [2, 3, 70, 55, 1]],
    ['right outside the cell', [2, 3, 80, 55]], ['bottom outside the cell', [2, 3, 70, 60]], ['negative', [-1, 3, 70, 55]],
    ['left > right', [71, 3, 70, 55]], ['top > bottom', [2, 56, 70, 55]], ['fractional', [2.5, 3, 70, 55]],
    ['a string member', [2, '3', 70, 55]],
  ])('drops a box that is %s', (_, v) => {
    expect(parse(v)).toBeUndefined();
  });

  it('every atlas sheet has a valid idleBox equal to its idle frame\'s opaque box in the PNG', () => {
    const sheets = Object.keys(atlas.sheets);
    expect(sheets.length).toBeGreaterThan(100);
    for (const s of sheets) {
      const a = monsterAnchors(atlas.sheets[s]);
      expect(a.idleBox, s).toBeDefined();
      const [l, t, r, b] = frameBox(s, 'idle');
      expect(a.idleBox, s).toEqual([l, t, r - 1, b - 1]);
    }
  });
});
