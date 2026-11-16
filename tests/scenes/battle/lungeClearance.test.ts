/**
 * Defect 1 (docs/ROSTER_FIX_PLAN.md R-1): no travelling enemy's art rises under the top message window. For every
 * atlas sheet (each size / attack variant of its enemies), alone and beside two goblins, every hero row is attacked
 * and every frame stepped; a second run on hero 0 kills the enemy at each attack frame and runs the dying out. Each
 * displayed frame's own opaque top comes from the atlas PNG (not from the FW-A `travelTop` anchor the code uses).
 * The bosses' strikes still land: their contact frame meets the hero (reach, the box centre in the hero's span, feet).
 */
import { describe, it, expect } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { AiEnemyView } from '../../../src/scenes/battle/AiEnemyView.js';
import { PARTY_FEET_Y, partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { BATTLE_MESSAGE_HEIGHT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { DYING_IN } from '../../../src/scenes/battle/enemyChoreography.js';
import { ENEMY_REACH_OVERLAP } from '../../../src/scenes/battle/enemyReach.js';
import { monsterSpriteKey } from '../../../src/rendering/BattleArt.js';
import { atlas, atlasArt, atlasFrames, enemyById, enemyData, frameBox } from '../../helpers/atlasFrames.js';
import type { EnemyData } from '../../../src/types/index.js';

/** The clearance line: 4 px under the 120 px message window. */
const CLEAR_Y = BATTLE_MESSAGE_HEIGHT + 4;
// V6 (REDESIGN_PLAN 4.2, D-V6 = C2, D-V7): chaos is a boss sheet at scale 3, laid out as the titan class, and attacks
// in place (its own case below), so it no longer travels to the hero
const BOSS_SHEETS = ['garland', 'hollow_seraph', 'warmech', 'ashen_queen', 'lich', 'astos',
  'drowned_sovereign', 'death_eye'];

/** One enemy per sheet and distinct (size, attackAnim, attack): what decides its layout and attack table. */
const variants = (() => {
  const seen = new Map<string, EnemyData>();
  for (const e of enemyData) {
    const k = [monsterSpriteKey(e), e.size ?? 'small', e.attackAnim ?? '', e.attack ?? ''].join('/');
    if (!seen.has(k) && atlas.sheets[monsterSpriteKey(e)]) seen.set(k, e);
  }
  return [...seen.entries()];
})();

function battle(enemies: EnemyData[]) {
  const actors = new Container();
  const view = new AiEnemyView(enemies, atlasArt);
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

/** Screen y of enemy 0's displayed frame's top opaque row, and the frame. */
function top(b: ReturnType<typeof battle>, sheet: string): { y: number; pose: string } {
  const f = atlasFrames(sheet)!;
  const s = b.sprites[0];
  const scale = (s.scale.x / f.artScale) * f.scale;
  const pose = b.view.poses.state(0).pose;
  return { y: s.y + frameBox(sheet, pose)[1] * scale, pose };
}

describe('a travelling enemy stays under the message window (defect 1)', () => {
  it('covers every atlas sheet', () => {
    expect(new Set(variants.map(([k]) => k.split('/')[0])).size).toBe(Object.keys(atlas.sheets).length);
  });

  it.each(variants)('%s: every frame of every attack and of a death mid-attack', (_, e) => {
    const sheet = monsterSpriteKey(e);
    const bad: string[] = [];
    const check = (b: ReturnType<typeof battle>, what: string): void => {
      const t = top(b, sheet);
      if (t.y < CLEAR_Y) bad.push(`${what} ${t.pose} top ${t.y}`);
    };
    for (const layout of [[e], [e, enemyById('goblin'), enemyById('goblin')]]) {
      const name = layout.length === 1 ? 'alone' : 'with goblins';
      const b = battle(layout);
      for (let j = 0; j < 4; j++) {
        b.view.playAttack(0, b.party[j]);
        for (let k = 0; k < 400 && b.view.poses.isAttacking(0); k++) {
          b.view.update(1, b.sprites);
          check(b, `${name} hero ${j} frame ${k}`);
        }
      }
      b.view.playAttack(0, b.party[0]);
      const total = b.view.poses.attackTiming(0).totalFrames;
      for (let t = 0; t < total; t++) {
        const d = battle(layout);
        d.view.playAttack(0, d.party[0]);
        for (let k = 0; k < t; k++) d.view.update(1, d.sprites);
        d.view.poses.freezeDying(0);
        for (let k = 0; k <= DYING_IN + 4; k++) {
          d.view.update(1, d.sprites);
          check(d, `${name} dies at ${t}, +${k}`);
        }
      }
    }
    expect(bad.slice(0, 5), `${bad.length} frames above y ${CLEAR_Y}`).toEqual([]);
  });
});

describe('a boss strike still lands after the clamp (defect 1)', () => {
  it.each(BOSS_SHEETS)('%s on hero 0: reach, box centre in the hero span, feet within 100 px', (sheet) => {
    const e = enemyData.find((x) => x.id === sheet) ?? enemyData.find((x) => monsterSpriteKey(x) === sheet)!;
    const b = battle([e]);
    const f = atlasFrames(sheet)!;
    b.view.playAttack(0, b.party[0]);
    const { contactAt } = b.view.poses.attackTiming(0);
    for (let k = 0; k < contactAt; k++) b.view.update(1, b.sprites);
    const s = b.sprites[0];
    const scale = (s.scale.x / f.artScale) * f.scale;
    const pose = b.view.poses.state(0).pose;
    expect(pose).toBe('attack');
    const [, t, , btm] = frameBox(sheet, pose);
    const hero = b.party[0].getBounds();
    expect(Math.abs(s.x + f.opaqueRight! * scale - (hero.x + ENEMY_REACH_OVERLAP)), 'reach').toBeLessThanOrEqual(50);
    const centre = s.y + ((t + btm) / 2) * scale;
    expect(centre, 'box centre').toBeGreaterThanOrEqual(hero.y);
    expect(centre, 'box centre').toBeLessThanOrEqual(PARTY_FEET_Y[0]);
    // 100 px at the 2x art scale; a 3x boss (hollow_seraph, V8 N-1) is 1.5x taller, so the same contact reads at 150 px
    // (its art top-to-feet is 450 px: under the window at y 124 it cannot get closer to hero 0's feet at y 425)
    expect(s.y + (f.footRow + 1) * scale - PARTY_FEET_Y[0], 'feet gap').toBeLessThanOrEqual(100 * (f.scale / 2));
  });

  it('chaos (scale 3, the titan class) attacks every hero in place: travel 0, shown at 3 px per art px', () => {
    const b = battle([enemyById('chaos')]);
    for (const hero of b.party) expect(b.view.attackPlan(0, hero)).toEqual({ travel: 0, rise: 0 });
    const f = atlasFrames('chaos')!;
    expect((b.sprites[0].scale.x / f.artScale) * f.scale).toBe(3);
  });
});
