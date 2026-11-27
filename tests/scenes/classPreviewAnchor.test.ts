/**
 * Pass CD-K (play-test note on pass CL): the party-creation class preview. An 80 x 80 class's pose stays exactly at
 * the content's top-left (unchanged); an oversize class (a lance past its body box) is centred in the 600 px panel by
 * its body box, its feet on the 80 x 80 preview's feet line (lowered if its weapon would cover the stat lines), and its whole
 * ready frame stays inside the panel.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { buildClassPreview } from '../../src/scenes/partyCreation/PartyCreationViews.js';
import { LINE_HEIGHT, WINDOW_PADDING } from '../../src/core/LayoutConstants.js';
import type { CharacterClassData } from '../../src/types/index.js';
import type { PagedBattleMeta } from '../../src/rendering/battleAtlasPages.js';

const cls = {
  id: 'x', name: 'X', baseStats: { hp: 1, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1 },
  statGrowth: { hp: 1, strength: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1 }, usableEquipment: [],
  spellLevels: { white: 0, black: 0 },
} as unknown as CharacterClassData;
const source = new TextureSource({ width: 512, height: 512 });
const tex = (w: number, h: number) => new Texture({ source, frame: new Rectangle(0, 0, w, h) });
const pose = (win: ReturnType<typeof buildClassPreview>) => win.children.find((c) => c.label === 'classPose') as Sprite;
const TOP = WINDOW_PADDING + 8 * LINE_HEIGHT;             // the 7 stat lines and a gap

describe('party-creation class preview (pass CD-K)', () => {
  it('an 80 x 80 class stays exactly at the content top-left', () => {
    const s = pose(buildClassPreview(cls, tex(160, 160)));
    expect([s.x, s.y]).toEqual([WINDOW_PADDING, TOP]);
  });

  it('an oversize class is centred by its body box, its feet on the 80 x 80 feet line, inside the panel', () => {
    const meta = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as PagedBattleMeta;
    const s0 = meta.sheets.landsknecht;
    const body = { x: s0.body![0], w: s0.body![2] };
    const s = pose(buildClassPreview(cls, tex(320, 288), { body, footRow: s0.footRow!, scale: 2, top: s0.top }));
    expect(s.x + (body.x + body.w / 2) * 2).toBe(300);
    // the feet on the 80 x 80 feet line, unless the weapon would rise over the stat lines: then just below them
    expect(s.y).toBe(Math.max(TOP + (76 + 1) * 2 - (s0.footRow! + 1) * 2, TOP - s0.top! * 2));
    expect(s.y + s0.top! * 2).toBeGreaterThanOrEqual(TOP);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x + 320).toBeLessThanOrEqual(600);
    expect(s.y + 288).toBeLessThanOrEqual(800);
  });
});
