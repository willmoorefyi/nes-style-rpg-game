/**
 * FX-E hints (docs/PLAYTEST_FIX_PLAN.md): P3-12 (the Citadel's steward says where the pads that carry on lie), P3-05
 * (a plaque on the Past temple's first floor points at the second stair), the sky castle's belt glyphs, and the
 * caravan's one-time sale. Reads the compiled maps the game plays.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { MapData } from '../../src/types/index.js';

const load = (id: string): MapData => parse(readFileSync(`assets/maps/ai/${id}.yaml`, 'utf-8')) as MapData;
const flat = (d: unknown): string => JSON.stringify(d);

describe('FX-E hints', () => {
  it('P3-12: the stone steward says, before and after the throne wakes, where the pads that carry on lie', () => {
    const steward = load('citadel-1f').npcs.find((n) => n.id === 'stone_steward');
    expect(steward).toBeDefined();
    const branches = steward!.dialog as { condition?: string; text: string[] }[];
    expect(branches).toHaveLength(2);
    for (const b of branches) expect(b.text.join(' ')).toMatch(/runes only hand you back to the ring/);
    // a hint, not the answer: no coordinates
    expect(flat(branches)).not.toMatch(/\b(19|31|24)\b/);
  });

  it('P3-05: a plaque on past-temple-1 by the east stair names the two stairs', () => {
    const map = load('past-temple-1');
    const cell = map.inspect?.find((c) => c.x === 23 && c.y === 3);
    expect(flat(cell?.text)).toMatch(/Two stairs, two houses/);
    const east = map.transitions.find((t) => t.targetEntrance === 'east');
    expect(east && Math.abs(east.x - 23) + Math.abs(east.y - 3)).toBeLessThanOrEqual(2);
  });

  it('sky castle 2F: glyphs at both start islands speak of the belts without naming a route', () => {
    const map = load('sky-castle-2f');
    const cells = (map.inspect ?? []).map((c) => [c.x, c.y]);
    expect(cells).toEqual([[10, 25], [34, 25]]);
    expect(flat(map.inspect)).toMatch(/one way/);
  });

  it('P2-09: the bottle is a single sale, still 40000 G, still flagged', () => {
    const trader = load('caravan-camp').npcs.find((n) => n.id === 'trader');
    expect(trader).toMatchObject({ takeGold: 40000, giftItem: 'fairy_bottle', giftFlag: 'WAT_O_BOTTLE_BOUGHT' });
  });
});
