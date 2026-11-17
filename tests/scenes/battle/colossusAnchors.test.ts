/**
 * Colossus anchors (docs/CHAOS_FORMS_PLAN.md 4.4; rev 4: the 18.4 estimates) in a real battle on the painted F3 fixture: damage numbers at `core`
 * (y 140..740), the target arrow and bracket inside the field with the label at y >= 124, the status icon row inside
 * y 140..760, the effect box inside the field with every emitter anchor in y 124..1080 (the fxBigBoxes rule), and the
 * melee point at x <= 1250 so heroes travel at least 150 px.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Graphics } from 'pixi.js';
import { BattleFieldTargeting } from '../../../src/scenes/battle/BattleFieldTargeting.js';
import { measureReach } from '../../../src/scenes/battle/actionHelpers.js';
import { anchor, bodyBox } from '../../../src/scenes/battle/fx/emitterCore.js';
import { colossusAt, colossusStatusAnchor } from '../../../src/scenes/battle/colossus/colossusProxy.js';
import { screenAnchors, type ColossusFormSpec } from '../../../src/scenes/battle/colossus/colossusIndex.js';
import { COLOSSUS_ROW_PX, ICON_LIFT } from '../../../src/scenes/battle/fx/statusIcons.js';
import { FLOAT_FONT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import { colossusBattle, fixtureIndex, HORIZON, installFixtureArt } from '../../helpers/colossusFixture.js';
import { floatsIn } from '../../helpers/battleLayers.js';

let uninstall: () => void = () => {};
beforeEach(async () => { uninstall = await installFixtureArt(); });
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

const inField = (x: number, y: number): boolean => x >= 0 && x <= 1900 && y >= 140 && y <= 760;

describe('damage numbers', () => {
  it('start at the core anchor, centred on it', () => {
    const s = colossusBattle();
    const proxy = s.display.enemySprites[0];
    expect(colossusAt(proxy)).not.toBeNull();
    s.ctrl.spawnFloatingTextsFromEvents([{ targetId: 'enemy_0', damage: 123, isHeal: false, isCrit: false }]);
    const [num] = floatsIn(s.main);
    const core = colossusAt(proxy)!.anchors().core;
    expect(num.y).toBe(core.y);
    expect(Math.abs(num.x + (3 * FLOAT_FONT * 0.6) / 2 - core.x)).toBeLessThanOrEqual(1);
    expect(inField(num.x, num.y)).toBe(true);
  });

  it('the core is clamped to y 140..740 and the head to the rows that keep its icon row and label clear', () => {
    const f: ColossusFormSpec = { ...fixtureIndex().forms[HORIZON] };
    f.anchors = { ...f.anchors, core: [1347, 20], head: [1347, 10] };
    const a = screenAnchors(f);
    expect(a.core.y).toBe(140);
    expect(a.head.y - ICON_LIFT - COLOSSUS_ROW_PX).toBeGreaterThanOrEqual(140);   // C7 pin: the 44 px plated row (C6-6)
    f.anchors = { ...f.anchors, core: [1347, 1060] };
    expect(screenAnchors(f).core.y).toBe(740);
  });
});

describe('the target cursor', () => {
  it('the arrow, the bracket around the target rect and the label stay in the field; no off-screen outline', () => {
    const s = colossusBattle();
    const t = new BattleFieldTargeting(s.layers.hud, s.battle, s.display, s.input as unknown as InputManager);
    expect(t.enterFieldTargeting(false, false, () => {}, () => {})).toBe(true);
    t.updateTargetVisuals();
    const arrow = t.targetArrow!;
    expect(inField(arrow.x, arrow.y)).toBe(true);
    expect(t.targetLabel!.y).toBeGreaterThanOrEqual(124);
    const bracket = t.targetOutline as Graphics;
    const b = bracket.getBounds();
    const r = s.display.enemySprites[0].getBounds();
    expect(b.x).toBeGreaterThanOrEqual(r.x - 16);
    expect(b.x + b.width).toBeLessThanOrEqual(r.x + r.width + 16);
    expect(inField(b.x, b.y) && inField(b.x + b.width, b.y + b.height), JSON.stringify([b.x, b.y, b.width, b.height])).toBe(true);
  });
});

describe('status icons, effects and the melee point', () => {
  it('the status anchor puts the icon row inside y 140..760', () => {
    const s = colossusBattle();
    const a = colossusStatusAnchor(colossusAt(s.display.enemySprites[0])!);
    const top = a.head.y - ICON_LIFT - COLOSSUS_ROW_PX;   // C7 pin: the 44 px plated row (C6-6)
    expect(top).toBeGreaterThanOrEqual(140);
    expect(a.head.y).toBeLessThanOrEqual(760);
  });

  it('the effect box is inside the field and every emitter anchor lies in y 124..1080', () => {
    const s = colossusBattle();
    const c = colossusAt(s.display.enemySprites[0])!;
    const e = c.effectBox();
    expect(e.width).toBe(420);
    expect(e.height).toBe(360);
    expect(inField(e.x, e.y) && inField(e.x + e.width, e.y + e.height)).toBe(true);
    const core = c.anchors().core;
    expect(e.x + e.width / 2).toBe(core.x);
    expect(e.y).toBe(Math.max(140, core.y - e.height / 2));   // centred on the core, kept below the message window
    for (const at of [undefined, 'top', 'head', 'feet', 'front']) {
      const p = anchor(bodyBox(e), at);
      expect(p.y, String(at)).toBeGreaterThanOrEqual(124);
      expect(p.y, String(at)).toBeLessThanOrEqual(1080);
    }
  });

  it('heroes run to the melee point (x <= 1250) and travel at least 150 px', () => {
    const s = colossusBattle();
    const melee = colossusAt(s.display.enemySprites[0])!.anchors().melee;
    expect(melee.x).toBeLessThanOrEqual(1250);
    for (const hero of s.display.partySprites) {
      const reach = measureReach(hero, s.display.enemySprites[0]);
      expect(reach.dx).toBeGreaterThanOrEqual(150);
      expect(Math.abs(hero.x - reach.dx - melee.x)).toBeLessThanOrEqual(24);
    }
  });
});
