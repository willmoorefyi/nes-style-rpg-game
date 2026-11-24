/**
 * V8 F6 (docs/REDESIGN_FIX_PLAN.md, D-O5): an enemy that shows a status icon gets its damage number below the icon
 * row (spawn y = max(cell top, row bottom + 4 + RISE_MIN), the rise stops at row bottom + 4); without an icon the
 * number is placed and rises exactly as before, and party numbers are unchanged. Chaos, ogre and goblin come from the
 * real atlas (cell, foot row, scale, idle head row) laid out by AiEnemyView.
 */
import { describe, it, expect } from 'vitest';
import { Container } from 'pixi.js';
import { AiEnemyView, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { ActionNumbers } from '../../../src/scenes/battle/actionNumbers.js';
import { BattleEffects } from '../../../src/scenes/battle/BattleEffects.js';
import { FLOAT_FRAMES } from '../../../src/scenes/battle/floatingNumbers.js';
import { FLOAT_FONT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { ICON_LIFT, ICON_PX } from '../../../src/scenes/battle/fx/statusIcons.js';
import { TRAVEL_CLEAR_Y } from '../../../src/scenes/battle/enemyReach.js';
import { monsterSpriteKey } from '../../../src/rendering/BattleArt.js';
import { enemyById, idleBoxOf, sizedAtlasFrames, texScaleOf } from '../../helpers/atlasFrames.js';
import { loadStatusVisuals } from '../../helpers/statusVisuals.js';
import type { BattleStateMachine, DamageEvent } from '../../../src/battle/BattleStateMachine.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { StatusEffect } from '../../../src/battle/StatusEffects.js';

const VISUALS = loadStatusVisuals();

const sizedArt: MonsterArtSource = { getMonsterFrames: (sheet) => sizedAtlasFrames(sheet, true) };

interface Rect { x0: number; y0: number; x1: number; y1: number }
const hit = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function scene(id: string, statuses: StatusEffect[]) {
  const e = enemyById(id);
  const view = new AiEnemyView([e], sizedArt);
  const sprites = view.build();
  const root = new Container();
  const effects = new BattleEffects(root, () => sprites);
  const party = new Container();
  party.position.set(1500, 420);
  const display = {
    enemySprites: sprites, partySprites: [party], enemyView: null, flashHurt: () => {},
    presented: { enemies: [{ hp: 50, statuses }], party: [{ hp: 50, statuses: [] }] },
    statusVisuals: () => VISUALS,
  } as unknown as BattleDisplayManager;
  const battle = { allEnemies: [{ currentHp: 50 }], allParty: [] } as unknown as BattleStateMachine;
  const numbers = new ActionNumbers(battle, display, effects);
  return { sprite: sprites[0], party, effects, numbers, sheet: monsterSpriteKey(e) };
}

const evt = (targetId: string, damage: number): DamageEvent => ({ targetId, damage, isHeal: false, isCrit: false });

/** The number's box every frame of its float (FLOAT_FRAMES updates of 1 frame). */
function float(s: ReturnType<typeof scene>, targetId: string, damage: number): Rect[] {
  s.numbers.spawn([evt(targetId, damage)]);
  const ft = s.effects.floatingTexts[s.effects.floatingTexts.length - 1];
  const w = String(damage).length * FLOAT_FONT * 0.6;
  const out: Rect[] = [];
  for (let t = 0; t < FLOAT_FRAMES; t++) {
    out.push({ x0: ft.text.x, y0: ft.text.y, x1: ft.text.x + w, y1: ft.text.y + FLOAT_FONT });
    s.effects.updateFloatingTexts(1);
  }
  return out;
}

/** Today's placement: centred on the cell, at the cell top, rising 1 px per frame. */
function legacy(sprite: Container, damage: number): Rect[] {
  const w = String(damage).length * FLOAT_FONT * 0.6;
  const x = Math.round(sprite.x + sprite.width / 2 - w / 2);
  const y = Math.round(sprite.y);
  return Array.from({ length: FLOAT_FRAMES }, (_, t) => ({ x0: x, y0: y - t, x1: x + w, y1: y - t + FLOAT_FONT }));
}

describe('damage numbers and the status icon row (V8 F6)', () => {
  it.each([['chaos'], ['ogre'], ['goblin']])('%s poisoned: the number never touches the icon row and stays at y >= 124', (id) => {
    for (const damage of [64, 999]) {
      const s = scene(id, ['poison']);
      const [l, t, r] = idleBoxOf(s.sheet);
      const scale = s.sprite.scale.x;
      const ts = texScaleOf(s.sheet);   // EF-A4: PNG px per art px of the sheet
      const headY = s.sprite.y + t * ts * scale;
      const cx = s.sprite.x + ((l + r + 1) / 2) * ts * scale;
      const row: Rect = { x0: cx - ICON_PX / 2, y0: headY - ICON_LIFT - ICON_PX, x1: cx + ICON_PX / 2, y1: headY - ICON_LIFT };
      const boxes = float(s, 'enemy_0', damage);
      expect(boxes[0].y0, `${id} spawns at or below the cell top`).toBeGreaterThanOrEqual(Math.round(s.sprite.y));
      for (const [k, b] of boxes.entries()) {
        expect(hit(b, row), `${id} ${damage} frame ${k}`).toBe(false);
        expect(b.y0, `${id} ${damage} frame ${k}`).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
        expect(b.y0, `${id} ${damage} frame ${k}: clear of the row`).toBeGreaterThanOrEqual(row.y1 + 4);
      }
    }
  });

  it.each([['goblin'], ['ogre'], ['dragon']])('%s without a status: position and rise byte-identical to before', (id) => {
    const s = scene(id, []);
    expect(float(s, 'enemy_0', 64)).toEqual(legacy(s.sprite, 64));
  });

  it('a party number is unchanged (even when the enemy side shows icons)', () => {
    const s = scene('chaos', ['poison']);
    expect(float(s, 'party_0', 64)).toEqual(legacy(s.party, 64));
  });
});
