/**
 * Pass F item 5b (docs/FEEDBACK_PLAN_2026-11-14.md §3.5): status overlays, icons and tints on both sides, table-driven
 * over assets/data/status-visuals.yaml, read from the presented snapshot. Old code: no overlays at all.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Container, Sprite, Texture } from 'pixi.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { BattleStatusFx, STATUS_FADE_FRAMES, type StatusFxDisplay } from '../../../src/scenes/battle/fx/statusFx.js';
import { FxAtlas, type FxAtlasMeta } from '../../../src/scenes/battle/fx/fxAtlas.js';
import { STATUS_OVERLAYS } from '../../../src/scenes/battle/fx/statusEmitters.js';
import { setTint, tintOf, multiplyTint } from '../../../src/scenes/battle/actorTint.js';
import type { PresentedState } from '../../../src/scenes/battle/presentedState.js';
import type { StatusEffect } from '../../../src/battle/StatusEffects.js';
import { loadStatusVisuals } from '../../helpers/statusVisuals.js';

afterEach(() => { vi.restoreAllMocks(); });

const VISUALS = loadStatusVisuals();
const REAL = Object.entries(VISUALS).filter(([, v]) => !v.reserved).map(([s]) => s as StatusEffect);
const META = JSON.parse(readFileSync(resolve(__dirname, '../../../assets/sprites/battle-fx.json'), 'utf8')) as FxAtlasMeta;

function stage() {
  const root = new Container();
  const layers = BattleLayers.of(root);
  const enemy = new Sprite(Texture.WHITE);
  enemy.scale.set(10);
  enemy.position.set(300, 400);
  const hero = new Sprite(Texture.WHITE);
  hero.scale.set(10);
  hero.position.set(1400, 500);
  layers.actors.addChild(enemy, hero);
  const presented: PresentedState = { enemies: [{ hp: 10, statuses: [] }], party: [{ hp: 10, statuses: [] }] };
  const display: StatusFxDisplay = { enemySprites: [enemy], partySprites: [hero], presented };
  const atlas = new FxAtlas();
  atlas.set(META, Texture.WHITE);
  const fx = new BattleStatusFx(layers, display, atlas, () => VISUALS);
  const set = (side: 'enemies' | 'party', statuses: StatusEffect[], hp = 10) => { presented[side][0] = { hp, statuses }; };
  return { layers, enemy, hero, fx, set };
}

describe('status overlays, icons and tints (table-driven over status-visuals.yaml)', () => {
  for (const status of REAL) {
    const v = VISUALS[status];
    for (const side of ['enemies', 'party'] as const) {
      const id = side === 'enemies' ? 'enemy_0' : 'party_0';
      it(`${status} on ${side === 'enemies' ? 'an enemy' : 'a hero'}: overlay ${v.overlay ?? 'none'}, icon ${v.icon}, tint ${v.tint?.toString(16) ?? 'none'}`, () => {
        const s = stage();
        const sprite = side === 'enemies' ? s.enemy : s.hero;
        s.fx.sync();
        expect(s.fx.active.overlays).toBe(0);
        s.set(side, [status]);
        s.fx.sync();
        expect(s.fx.overlaysOn(id)).toEqual(v.overlay ? [v.overlay] : []);
        expect(s.fx.iconsOn(id)).toEqual([v.icon]);
        expect(tintOf(sprite, 'status')).toBe(v.tint ?? null);
        expect(sprite.filters ?? []).toHaveLength(0);
        const c = s.fx.containerOf(id)!;
        expect(c.parent).toBe(s.layers.fx.status);
        expect(c.children.some((k) => k.visible)).toBe(true);
        // alpha follows the sprite (the death fade), and it hides with it
        sprite.alpha = 0.5;
        s.fx.update(1);
        expect(c.alpha).toBeLessThanOrEqual(0.5);
        sprite.visible = false;
        s.fx.update(1);
        expect(c.visible).toBe(false);
        sprite.visible = true;
        sprite.alpha = 1;
        // cured: the overlay fades out by frame 12 and is gone; icon and tint leave at once
        s.set(side, []);
        s.fx.sync();
        expect(s.fx.iconsOn(id)).toEqual([]);
        expect(tintOf(sprite, 'status')).toBeNull();
        if (v.overlay) expect(s.fx.overlaysOn(id)).toEqual([v.overlay]);
        for (let t = 0; t < STATUS_FADE_FRAMES; t++) s.fx.update(1);
        expect(s.fx.overlaysOn(id)).toEqual([]);
        expect(c.children.filter((k) => k.visible)).toHaveLength(0);
      });
    }
  }

  it('every overlay is a known loop and draws only integer scales, no rotation, 2-px friendly positions', () => {
    const anchor = { head: { x: 100, y: 50 }, box: { x: 60, y: 40, w: 80, h: 100 }, facing: 1 as const };
    for (const [name, overlay] of Object.entries(STATUS_OVERLAYS)) {
      for (let t = 0; t < 200; t += 7) {
        for (const d of overlay(t, anchor)) {
          expect([1, 2], name).toContain(d.scale);
          expect(Number.isInteger(d.x) && Number.isInteger(d.y), name).toBe(true);
          expect([0, 0.25, 0.5, 0.75, 1], name).toContain(d.alpha);
        }
      }
    }
  });

  it('at most 3 icons, in priority order stone > stun > sleep > fear > silence > blind > poison', () => {
    const s = stage();
    s.set('enemies', ['poison', 'blind', 'sleep', 'stone']);
    s.fx.sync();
    expect(s.fx.iconsOn('enemy_0')).toEqual(['icon_stone', 'icon_sleep', 'icon_blind']);
    s.set('enemies', ['poison', 'fear', 'silence']);
    s.fx.sync();
    expect(s.fx.iconsOn('enemy_0')).toEqual(['icon_fear', 'icon_silence', 'icon_poison']);
  });

  it('a dead enemy keeps its overlays through the fade (alpha follows) and they are destroyed when its sprite hides', () => {
    const s = stage();
    s.set('enemies', ['sleep', 'poison']);
    s.fx.sync();
    const c = s.fx.containerOf('enemy_0')!;
    s.set('enemies', ['sleep', 'poison'], 0);
    for (let k = 30; k > 0; k--) { s.enemy.alpha = k / 30; s.fx.update(1); expect(c.alpha).toBeCloseTo(k / 30); }
    s.enemy.alpha = 0;
    s.enemy.visible = false;
    s.fx.update(1);
    expect(s.fx.containerOf('enemy_0')).toBeNull();
    expect(c.destroyed).toBe(true);
    expect(s.layers.fx.status.children).not.toContain(c);
    expect(tintOf(s.enemy, 'status')).toBeNull();
  });

  it('a KO\'d hero\'s overlays fade out (the down pose shows no status)', () => {
    const s = stage();
    s.set('party', ['poison']);
    s.fx.sync();
    s.set('party', ['poison'], 0);
    s.fx.sync();
    expect(s.fx.iconsOn('party_0')).toEqual([]);
    for (let t = 0; t < STATUS_FADE_FRAMES; t++) s.fx.update(1);
    expect(s.fx.overlaysOn('party_0')).toEqual([]);
  });

  it('the poison tint pulses (6 frames of every 60) and multiplies with the hero pulse; curing it leaves the hero pulse', () => {
    const s = stage();
    setTint(s.hero, 'hero', 0xffffa0);
    s.set('party', ['poison']);
    s.fx.sync();
    expect(s.hero.tint).toBe(multiplyTint(0xffffa0, 0xc8ffc8));
    const on: boolean[] = [];
    for (let t = 1; t <= 60; t++) { s.fx.update(1); on.push(tintOf(s.hero, 'status') !== null); }
    expect(on.filter(Boolean)).toHaveLength(6);
    s.set('party', ['poison', 'fear']);          // frame 60: the pulse is on again
    s.fx.sync();
    expect(tintOf(s.hero, 'status')).toBe(multiplyTint(0xc8ffc8, 0xd8e4ff));
    s.set('party', []);
    s.fx.sync();
    expect(tintOf(s.hero, 'status')).toBeNull();
    expect(s.hero.tint).toBe(0xffffa0);
  });

  it('the overlays follow the sprite (a lunge, a travel, a shake) each frame', () => {
    const s = stage();
    s.set('enemies', ['silence']);
    s.fx.sync();
    const c = s.fx.containerOf('enemy_0')!;
    const at = () => (c.children.find((k) => k.visible) as Container).x;
    const x0 = at();
    s.enemy.x += 40;
    s.fx.update(0);
    expect(at() - x0).toBe(40);
  });
});
