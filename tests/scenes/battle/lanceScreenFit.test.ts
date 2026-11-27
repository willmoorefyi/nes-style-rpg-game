/**
 * Pass CL (docs/CLASS_LANCE_PLAN.md 7.6, D-CL11): nothing of an oversize lance hero is clipped. From the committed
 * atlas (each pose's opaque box) and the slot tables: every pose at home and at the active step, every frame of every
 * attack style (wind-up, the advance with its rise to the highest and the lowest enemy feet rows, contact, return) and
 * of the cast step stays on screen, under the message window (y >= 120) and above the command strip (y < 780).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readRgbaPng } from '../../helpers/pngAlpha.js';
import { cellRect, pageFile, type PagedBattleMeta } from '../../../src/rendering/battleAtlasPages.js';
import { partySpritePosition, PARTY_FEET_Y } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { ACTIVE_STEP } from '../../../src/scenes/battle/ActiveHeroMarker.js';
import {
  advanceAt, advanceFrames, ATTACK_STYLES, attackReach, attackRise, castAt, CAST_FRAMES, returnAt, RETURN_FRAMES,
} from '../../../src/scenes/battle/attackChoreography.js';
import { BATTLE_MESSAGE_HEIGHT, STRIP_Y } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { GAME_WIDTH } from '../../../src/core/LayoutConstants.js';

const meta = JSON.parse(readFileSync('assets/sprites/battle-characters-ai.json', 'utf8')) as PagedBattleMeta;
const pages = new Map<number, ReturnType<typeof readRgbaPng>>();   // pass CD-K: each oversize sheet on its own page
const ENEMY_FEET = [360, 745];                 // the battle plain's top and bottom feet rows (docs/ART_BATTLE_PLAN.md)
const ENEMY_RIGHT = [300, 700, 1100];          // target right edges: far, middle, near the party

/** A pose's opaque box in screen px relative to the sprite's top-left (the atlas page is at 2x already). */
function opaque(cid: string, pose: string): { x0: number; y0: number; x1: number; y1: number } {
  const p = meta.sheets[cid].page!;
  if (!pages.has(p)) pages.set(p, readRgbaPng(`assets/sprites/${pageFile(meta, p, "")}`));
  const page = pages.get(p)!;
  const r = cellRect(meta, cid, meta.poses.indexOf(pose));
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    if (page.data[((r.y + y) * page.width + r.x + x) * 4 + 3]) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

function onScreen(cid: string, pose: string, x: number, y: number, what: string): void {
  const b = opaque(cid, pose);
  expect(x + b.x0, `${what}: left`).toBeGreaterThanOrEqual(0);
  expect(x + b.x1, `${what}: right`).toBeLessThan(GAME_WIDTH);
  expect(y + b.y0, `${what}: top`).toBeGreaterThanOrEqual(BATTLE_MESSAGE_HEIGHT);
  expect(y + b.y1, `${what}: bottom`).toBeLessThan(STRIP_Y);
}

describe('pass CL: a lance hero is never clipped (7.6)', () => {
  for (const cid of Object.keys(meta.sheets).filter((c) => meta.sheets[c].page)) {   // every oversize hero
    const s = meta.sheets[cid];
    const art = { footRow: s.footRow!, scale: meta.scale, body: { x: s.body![0] } };
    for (const slot of [0, 1, 2, 3]) {
      it(`${cid} in slot ${slot + 1}: every pose at home and stepped forward, every attack and cast frame`, () => {
        const home = partySpritePosition(slot, art);
        // the game's clamp (heroBody.clampHeroY, 7.6): a leap's hop never lifts the lance into the message window
        const clampY = (y: number) => Math.max(y, BATTLE_MESSAGE_HEIGHT - (s.top ?? 0) * meta.scale);
        expect(s.top, "top recorded").toBeDefined();
        for (const pose of meta.poses) {
          onScreen(cid, pose, home.x, home.y, `${pose} at home`);
          onScreen(cid, pose, home.x - ACTIVE_STEP, home.y, `${pose} stepped`);
        }
        const lead = home.x + (s.reach ?? 0) * meta.scale;
        const feet = PARTY_FEET_Y[slot] + 3 * meta.scale;          // the body box bottom (heroBounds), as measureReach
        for (const style of ATTACK_STYLES) for (const right of ENEMY_RIGHT) for (const ef of ENEMY_FEET) {
          const reach = { dx: attackReach(lead, right), dy: attackRise(feet, ef + 3 * meta.scale) };
          let last = advanceAt(style, 0, reach);
          for (let t = 0; t <= advanceFrames(style); t++) {
            last = advanceAt(style, t, reach);
            onScreen(cid, last.pose, home.x + last.dx, clampY(home.y + last.dy), `${style} t${t} to (${right}, ${ef})`);
          }
          for (let t = 0; t <= RETURN_FRAMES; t++) {
            const f = returnAt(last, t, style);
            onScreen(cid, f.pose, home.x + f.dx, clampY(home.y + f.dy), `${style} return t${t}`);
          }
        }
        for (let t = 0; t <= CAST_FRAMES; t++) {
          const f = castAt(t);
          onScreen(cid, f.pose, home.x + f.dx, clampY(home.y + f.dy), `cast t${t}`);
        }
      });
    }
  }
});
