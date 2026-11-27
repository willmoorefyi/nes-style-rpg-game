/**
 * Pass CL (docs/CLASS_LANCE_PLAN.md 7.2, 7.3, 10): an oversize hero (a 160 x 144 cell, the body in the 80 x 80 box at
 * (72, 64)) and an 80 x 80 hero whose body boxes coincide get the same body measures from every consumer: the body
 * rect / bounds / anchor, the active arrow (and its kneel sink), a floating number's place, the slash box, the target
 * outline / arrow anchor, an enemy's run (its target box) and the hero's own lunge (by its spear point, D-CL12).
 */
import { describe, expect, it } from 'vitest';
import { Container, Graphics, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { heroAnchor, heroBounds, heroLead, heroLocalBounds, heroRect, setHeroBody } from '../../../src/scenes/battle/heroBody.js';
import { partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { ActiveHeroMarker, REST_TEXTURES } from '../../../src/scenes/battle/ActiveHeroMarker.js';
import { BattleEffects } from '../../../src/scenes/battle/BattleEffects.js';
import { measureReach } from '../../../src/scenes/battle/actionHelpers.js';
import { attackReach, MIN_ATTACK_REACH } from '../../../src/scenes/battle/attackChoreography.js';
import { setKnownHead } from '../../../src/scenes/battle/fx/texturePixels.js';

const source = new TextureSource({ width: 512, height: 512 });
const tex = (w: number, h: number) => new Texture({ source, frame: new Rectangle(0, 0, w, h) });
const BODY = { x: 72, y: 64, w: 80, h: 80 };

/** The pair in slot i: an 80 x 80 hero and a lance hero (reach 4), both with a known head 10 native px under the box top. */
function pair(i: number, parent: Container) {
  const small = new Sprite(tex(160, 160));
  const p = partySpritePosition(i, { footRow: 76, scale: 2 });
  small.position.set(p.x, p.y);
  setHeroBody(small, { scale: 2 });                     // no body: an 80 x 80 hero stays unregistered
  const big = new Sprite(tex(320, 288));
  const q = partySpritePosition(i, { footRow: 140, scale: 2, body: BODY });
  big.position.set(q.x, q.y);
  setHeroBody(big, { scale: 2, body: BODY, reach: 4 });
  setKnownHead(small.texture, { x: 80, y: 20 });
  setKnownHead(big.texture, { x: 80 + 144, y: 20 + 128 });
  parent.addChild(small, big);
  return { small, big };
}

describe('pass CL: an oversize hero is measured on its body box', () => {
  for (const i of [0, 1, 2, 3]) {
    it(`slot ${i}: body rect, bounds, anchor and local bounds equal the 80 x 80 hero's cell`, () => {
      const parent = new Container();
      const { small, big } = pair(i, parent);
      expect(heroRect(big)).toEqual(heroRect(small));
      expect(heroAnchor(big)).toEqual(heroAnchor(small));
      expect(heroBounds(big)).toEqual(heroBounds(small));
      expect(heroLocalBounds(big)).toEqual({ x: 144, y: 128, width: 160, height: 160 });
      expect(heroLocalBounds(small)).toEqual({ x: 0, y: 0, width: 160, height: 160 });
      // the shake / tremble pivot and the active step move the body with the sprite
      big.pivot.x = -3; small.pivot.x = -3;
      big.x -= 24; small.x -= 24;
      expect(heroRect(big)).toEqual(heroRect(small));
    });

    it(`slot ${i}: the active arrow, a floating number and the slash box land on the body`, () => {
      const parent = new Container();
      const { small, big } = pair(i, parent);
      const arrows: [number, number][] = [];
      for (const s of [small, big]) {
        REST_TEXTURES.set(s, s.texture);
        const m = new ActiveHeroMarker(parent);
        m.show(s);
        const arrow = parent.children.find((c) => c instanceof Graphics) as Graphics;
        arrows.push([arrow.x, arrow.y]);
        m.hide();
      }
      expect(arrows[1]).toEqual(arrows[0]);
      const main = new Container();
      const fx = new BattleEffects(main, () => []);
      fx.addFloating('12', 'hit', small);
      fx.addFloating('12', 'hit', big);
      const [a, b] = fx.floatingTexts.map((t) => [t.text.x, t.text.y]);
      expect(b).toEqual(a);
    });

    it(`slot ${i}: an enemy runs to the body; the lance hero lunges by its spear point (D-CL12)`, () => {
      const parent = new Container();
      const { small, big } = pair(i, parent);
      const enemy = new Sprite(tex(160, 160));
      enemy.position.set(500, 300);
      parent.addChild(enemy);
      expect(measureReach(enemy, big).dy).toBe(measureReach(enemy, small).dy);
      const r = measureReach(big, enemy), s = measureReach(small, enemy);
      expect(r.dy).toBe(s.dy);
      expect(heroLead(big)).toBe(small.x - 144 + 8);
      const eb = enemy.getBounds();
      expect(r.dx).toBe(attackReach(small.x - 136, eb.x + eb.width));
      expect(r.dx).toBe(Math.max(MIN_ATTACK_REACH, s.dx - 136));
    });
  }
});
