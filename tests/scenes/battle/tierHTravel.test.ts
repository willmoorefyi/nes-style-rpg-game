/**
 * TS-2 on fixtures (docs/REDESIGN_PLAN.md 2.5, 4.2; 9.5 lungeClearance / enemyTravel rows): the real atlas sheets of
 * the 22 tier-H enemies as FW-S will ship them (`scale: 3`, lungePx x 1.5 as BattleArt.getMonsterFrames scales it),
 * and chaos as a titan (alone in TITAN_AREA, attacking in place).
 * - Every tier-H sheet, alone and in a 3-huge formation, attacking every hero: every displayed frame's own opaque top
 *   (atlas PNG) stays under the message window (TRAVEL_CLEAR_Y), the sprite at a whole screen scale (3 or 2) and a
 *   whole-px position.
 * - The titan: travel 0 on every hero (the heavy table in place), TRAVEL_HOP 0, and no frame above the clear line.
 * When the FW-S atlas and the TS-3 sizes land (V4), the real-data lungeClearance / enemyTravel loops cover the same.
 */
import { describe, it, expect } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { AiEnemyView, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { PARTY_FEET_Y, partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { TRAVEL_CLEAR_Y, TRAVEL_HOP } from '../../../src/scenes/battle/enemyReach.js';
import { monsterSpriteKey, type MonsterFrames } from '../../../src/rendering/BattleArt.js';
import { atlasFrames, enemyById, frameBox } from '../../helpers/atlasFrames.js';
import type { EnemyData } from '../../../src/types/index.js';

const TIER_H = ['shark', 'minotaur', 'ochu', 'neochu', 'hydra', 'earth_elemental', 'fire_elemental', 'water_elemental',
  'air_elemental', 'hill_gigas', 'fire_gigas', 'ice_gigas', 'dragon', 'white_dragon', 'blue_dragon', 'green_dragon',
  'dragon_zombie', 'white_shark', 'minotaur_zombie', 'fire_hydra', 'deepeyes', 'evil_eye'];

/** The atlas frames at the sheet scale 3 (what BattleArt returns for an FW-S `scale: 3` sheet). */
function scaled(sheet: string): MonsterFrames | null {
  const f = atlasFrames(sheet);
  if (!f || !TIER_H.includes(sheet)) return f;
  return { ...f, scale: 3, artScale: 3 / (f.scale / f.artScale), lungePx: (f.lungePx * 3) / f.scale };
}
const art: MonsterArtSource = { getMonsterFrames: scaled };
const huge = (id: string): EnemyData => ({ ...enemyById(id), size: 'huge' });
const titan = (): EnemyData => ({ ...enemyById('chaos'), size: 'titan' });

function battle(enemies: EnemyData[]) {
  const actors = new Container();
  const view = new AiEnemyView(enemies, art);
  const sprites = view.build();
  actors.addChild(...sprites);
  const party = PARTY_FEET_Y.map((_, i) => {
    const g = new Graphics().rect(0, 0, 160, 160).fill(0x4488ff);
    const p = partySpritePosition(i, { footRow: 76, scale: 2 });
    g.position.set(p.x, p.y);
    actors.addChild(g);
    return g;
  });
  return { view, sprites, party };
}

/** Enemy 0's displayed frame's opaque top (screen y) over every frame of an attack on each hero. */
function highest(b: ReturnType<typeof battle>, sheet: string, f: MonsterFrames): number {
  let top = Infinity;
  for (let j = 0; j < 4; j++) {
    b.view.playAttack(0, b.party[j]);
    for (let k = 0; k < 400 && b.view.poses.isAttacking(0); k++) {
      b.view.update(1, b.sprites);
      const s = b.sprites[0];
      const scale = (s.scale.x / f.artScale) * f.scale;
      top = Math.min(top, s.y + frameBox(sheet, b.view.poses.state(0).pose)[1] * scale);
    }
  }
  return top;
}

describe('tier H travels under the message window at a whole screen scale (TS-2 fixtures)', () => {
  it.each(TIER_H)('%s: alone and in a 3-huge formation', (id) => {
    const sheet = monsterSpriteKey(enemyById(id));
    const f = scaled(sheet)!;
    expect(f.lungePx).toBe(((atlasFrames(sheet)!.lungePx) * 3) / 2);
    const others = TIER_H.filter((x) => x !== id).slice(0, 2);
    for (const layout of [[huge(id)], [huge(id), ...others.map(huge)]]) {
      const b = battle(layout);
      for (const s of b.sprites) {
        expect(Number.isInteger(s.x) && Number.isInteger(s.y), `${id} position ${s.x},${s.y}`).toBe(true);
        expect([2, 3]).toContain(s.scale.x);
      }
      expect(b.sprites[0].scale.x, `${id} at factor 1`).toBe(3);
      expect(highest(b, sheet, f), `${id} x${layout.length}`).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
    }
  });
});

describe('the titan attacks in place (D-V7)', () => {
  it('travel 0 on every hero, the heavy table in place, hop 0, every frame under the clear line', () => {
    expect(TRAVEL_HOP.titan).toBe(0);
    const b = battle([titan()]);
    for (const hero of b.party) expect(b.view.attackPlan(0, hero)).toEqual({ travel: 0, rise: 0 });
    b.view.playAttack(0, b.party[0]);
    expect(b.view.poses.attackKind(0)).toBe(enemyById('chaos').attackAnim === 'heavy' ? 'heavy' : 'inplace');
    expect(highest(b, 'chaos', atlasFrames('chaos')!)).toBeGreaterThanOrEqual(TRAVEL_CLEAR_Y);
    for (let k = 0; k < 400; k++) {
      b.view.update(1, b.sprites);
      expect(b.view.poses.state(0).travelDx ?? 0).toBe(0);
    }
  });
});
