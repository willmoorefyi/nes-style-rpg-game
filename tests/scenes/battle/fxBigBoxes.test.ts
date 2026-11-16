/**
 * TS-2 effect anchors on the big boxes (docs/REDESIGN_PLAN.md 2.5, rev 12): the centre, head, top, front and feet
 * anchors of a titan box (alone in TITAN_AREA) and of a tier-H box (scale 3, in a 3-huge formation), and every point
 * every effect draws over the RNG range, lie in y 124..1080: under the message window (TRAVEL_CLEAR_Y) and on screen.
 * The `bolt` and `beam` kinds start at the screen top by design (a strike from the sky) and are left out of the top
 * bound (their impact points are checked through the anchors).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { computeEnemyLayoutAi, type EnemyBox, type EnemyBoxInput } from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { anchor, createEmitter, seededRng, type FxBox } from '../../../src/scenes/battle/fx/emitters.js';
import { toFxData } from '../../../src/scenes/battle/fx/fxDefs.js';
import { validateSpellEffects } from '../../../src/core/schemaValidationFx.js';
import { TRAVEL_CLEAR_Y } from '../../../src/scenes/battle/enemyReach.js';
import { GAME_HEIGHT } from '../../../src/core/LayoutConstants.js';
import { createHash } from 'node:crypto';
import { Container } from 'pixi.js';
import { AiEnemyView } from '../../../src/scenes/battle/AiEnemyView.js';
import { bodyBox, type FxDraw } from '../../../src/scenes/battle/fx/emitters.js';
import type { FxEffect } from '../../../src/scenes/battle/fx/fxDefs.js';
import { partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { enemyById, sizedAtlasFrames } from '../../helpers/atlasFrames.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DATA = toFxData(validateSpellEffects(parse(readFileSync(join(root, 'assets/data/spell-effects.yaml'), 'utf-8'))));
const SKY_KINDS = new Set(['bolt', 'beam']);

const fx = (b: EnemyBox): FxBox => ({ x: b.x - b.w / 2, y: b.feetY - b.h, w: b.w, h: b.h });
const titan = fx(computeEnemyLayoutAi([{ size: 'titan', w: 600, h: 600, scale: 2 }])[0]);
const huge: EnemyBoxInput = { size: 'huge', w: 384, h: 384, scale: 3 };
const hugeBoxes = computeEnemyLayoutAi([huge, huge, huge]).map(fx);
/** The highest of the three (the staggered even columns). */
const tierH = [...hugeBoxes].sort((a, b) => a.y - b.y)[0];
const hero: FxBox = { x: 1520, y: 380, w: 160, h: 160 };

describe('effect anchors on the titan and tier-H boxes', () => {
  it('the boxes: the titan at screen scale 2 in TITAN_AREA, the three huge at factor 1', () => {
    expect(titan.h).toBe(600);
    expect(titan.y).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
    expect(hugeBoxes.map((b) => b.h)).toEqual([384, 384, 384]);
  });

  it.each([['titan', titan], ['tier-H', tierH]] as const)('%s: every anchor in y 124..1080', (_, b) => {
    for (const at of ['center', 'head', 'top', 'front', 'feet']) {
      const p = anchor(b, at);
      expect(p.y, at).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
      expect(p.y, at).toBeLessThanOrEqual(GAME_HEIGHT);
    }
  });

  const cases = Object.entries(DATA.effects).flatMap(([id, e]) => [
    [`${id} on the titan`, id, e, titan, hero], [`${id} on a tier-H box`, id, e, tierH, hero],
    [`${id} from the titan`, id, e, hero, titan], [`${id} from a tier-H box`, id, e, hero, tierH]] as const);

  it.each(cases)('%s: every drawn point in y 124..1080 over 20 seeds', (_, id, e, target, actor) => {
    let lo = Infinity, hi = -Infinity;
    for (let seed = 1; seed <= 20; seed++) {
      const emit = createEmitter(e, { geom: { target, actor, screenTop: 0 }, rng: seededRng(seed), frameCount: () => 4,
        landed: true, flashes: 1 });
      for (let t = 0; t < e.frames + 40; t++) {
        for (const d of emit(t).draws) { lo = Math.min(lo, d.y); hi = Math.max(hi, d.y); }
      }
    }
    if (lo === Infinity) return;
    if (!SKY_KINDS.has(e.kind)) expect(lo, `${id} highest point`).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
    expect(hi, `${id} lowest point`).toBeLessThanOrEqual(GAME_HEIGHT);
  });
});

/** V8 F7: the body box ActionFx.box() gives a real sprite (bodyBox of its bounds), alone in its formation. */
function bodyOf(id: string): FxBox {
  const view = new AiEnemyView([enemyById(id)], { getMonsterFrames: (sheet) => sizedAtlasFrames(sheet) });
  const sprite: Container = view.build()[0];
  const b = sprite.getBounds();
  return bodyBox({ x: b.x, y: b.y, width: b.width, height: b.height });
}
const heroBody = (() => {
  const p = partySpritePosition(1, { footRow: 76, scale: 2 });
  return bodyBox({ x: p.x, y: p.y, width: 160, height: 160 });
})();

/** Every draw of an effect over its life for seeds 1..3 (the byte-identity fingerprint). */
function drawsOf(e: FxEffect, target: FxBox, actor: FxBox): FxDraw[][] {
  const out: FxDraw[][] = [];
  for (let seed = 1; seed <= 3; seed++) {
    const emit = createEmitter(e, { geom: { target, actor, screenTop: 0 }, rng: seededRng(seed), frameCount: () => 4,
      landed: true, flashes: 1 });
    for (let t = 0; t < e.frames + 40; t++) out.push(emit(t).draws);
  }
  return out;
}
const digest = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const GOLDEN = JSON.parse(readFileSync(join(root, 'tests/scenes/battle/__golden__/fx_small_boxes_v8.json'), 'utf-8')) as Record<string, string>;
const SMALL: [string, () => FxBox][] = [['goblin', () => bodyOf('goblin')], ['ogre', () => bodyOf('ogre')],
  ['hill_gigas', () => bodyOf('hill_gigas')], ['hero', () => heroBody]];

describe('rise on big boxes, byte-identical on the rest (V8 F7)', () => {
  it('the boxes: goblin, ogre, a tier-H sheet and a hero are <= 300 px tall; chaos is taller', () => {
    for (const [name, box] of SMALL) expect(box().h, name).toBeLessThanOrEqual(300);
    expect(bodyOf('chaos').h).toBeGreaterThan(300);
  });

  const small = Object.entries(DATA.effects).flatMap(([id, e]) => SMALL.map(([name, box]) => [`${id} on ${name}`, e, box] as const));
  it.each(small)('%s: draws byte-identical to before, every point y >= 124', (name, e, box) => {
    const target = box();
    const actor = target === heroBody ? bodyOf('goblin') : heroBody;
    const draws = drawsOf(e, target, actor);
    expect(digest(draws), name).toBe(GOLDEN[name]);
    if (SKY_KINDS.has(e.kind)) return;
    for (const d of draws.flat()) expect(d.y, name).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
  });

  it.each(Object.entries(DATA.effects).filter(([, e]) => e.kind === 'rise' && e.glyph === 'flame'))(
    '%s on chaos: >= 10 flames on the body at the impact, every point y >= 124', (_, e) => {
      const b = bodyOf('chaos');
      for (let seed = 1; seed <= 20; seed++) {
        const emit = createEmitter(e, { geom: { target: b, actor: heroBody, screenTop: 0 }, rng: seededRng(seed),
          frameCount: () => 4, landed: true, flashes: 1 });
        const flames = emit(e.impact - 1).draws.filter((d) => d.key.startsWith('flame.'));
        const inside = flames.filter((d) => d.x >= b.x && d.x <= b.x + b.w && d.y >= b.y && d.y <= b.y + b.h);
        expect(inside.length, `seed ${seed}`).toBeGreaterThanOrEqual(10);
        for (let t = 0; t < e.frames + 10; t++) for (const d of emit(t).draws) expect(d.y).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
      }
    });
});
