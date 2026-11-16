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
