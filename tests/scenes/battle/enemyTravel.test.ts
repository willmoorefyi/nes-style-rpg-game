/**
 * Pass F item 3 (docs/FEEDBACK_PLAN_2026-11-14.md §3.3): on real layout boxes, the real party slots and the committed
 * monster atlas, every melee enemy reaches the hero it attacks on its contact frame (opaque right edge within 50 px of
 * the hero's box left + 24, feet within 30 px of the hero's feet). Old code: a 24-40 px lunge, about 900 px short.
 * Item 7 / F0 item 3: a travelling Garland or lich stays in `actors`, under the message window in `hud`. Defect 1 / D-F3
 * (docs/ROSTER_FIX_PLAN.md): no travelling boss's art (each frame's own opaque box) ever overlaps the message text.
 */
import { describe, it, expect } from 'vitest';
import { Container, Graphics, Texture } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { AiEnemyView, type MonsterArtSource } from '../../../src/scenes/battle/AiEnemyView.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { BOSS_FRAMES, type MonsterFrame } from '../../../src/scenes/battle/enemyChoreography.js';
import { PARTY_FEET_Y, partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { BATTLE_MESSAGE_HEIGHT } from '../../../src/scenes/battle/BattleSceneTypes.js';
import { ENEMY_REACH_OVERLAP } from '../../../src/scenes/battle/enemyReach.js';
import { opaqueBounds } from '../../helpers/pngAlpha.js';
import { monsterSheetPng } from '../../helpers/monsterAtlas.js';
import type { MonsterFrames } from '../../../src/rendering/BattleArt.js';
import { monsterAnchors, type MonsterAnchors } from '../../../src/rendering/monsterAnchors.js';
import { frameBox } from '../../helpers/atlasFrames.js';
import { artFloor, artFloorEnd, texLen, texPos } from '../../../src/rendering/texPx.js';
import type { EnemyData } from '../../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const meta = JSON.parse(readFileSync(join(root, 'assets/sprites/monsters-ai.json'), 'utf-8')) as {
  scale: number; texScale?: number;
  sheets: Record<string, MonsterAnchors & { cell: [number, number]; footRow: number; floating: boolean; lungePx?: number;
    scale?: number; texScale?: number; frames: Record<string, [number, number]> }>;
};
const enemyData = parse(readFileSync(join(root, 'assets/data/enemies.yaml'), 'utf-8')) as EnemyData[];
const scenarios = parse(readFileSync(join(root, 'assets/data/debug-scenarios.yaml'), 'utf-8')) as { id: string; enemies?: string[] }[];
const byId = (id: string): EnemyData => enemyData.find((e) => e.id === id)!;

/** The idle keyframe's opaque box in art px [l, t, r, b) (what BattleArt measures at load). */
const opaque = (sprite: string): [number, number, number, number] => {
  const s = meta.sheets[sprite];
  const ts = s.texScale ?? meta.texScale ?? meta.scale;      // EF-A4: a hi-res sheet's own texScale
  const [x, y] = s.frames.idle;
  const b = opaqueBounds(monsterSheetPng(sprite), texPos(x, ts), texPos(y, ts), texLen(s.cell[0], ts), texLen(s.cell[1], ts))!;
  return [artFloor(b[0], ts), artFloor(b[1], ts), artFloorEnd(b[2] - 1, ts) + 1, artFloorEnd(b[3] - 1, ts) + 1];
};

const art: MonsterArtSource = {
  getMonsterFrames(sprite: string): MonsterFrames | null {
    const s = meta.sheets[sprite];
    if (!s) return null;
    const textures = Object.fromEntries(BOSS_FRAMES.map((n) => [n, new Texture()])) as Record<MonsterFrame, Texture>;
    const sc = s.scale ?? meta.scale; // FW-S per-sheet scale, lunge scaled once (as BattleArt.getMonsterFrames)
    return { textures, idle: textures.idle, attack: textures.attack, cast: textures.cast, hurt: textures.hurt, scale: sc,
      artScale: sc / (s.texScale ?? meta.texScale ?? meta.scale), cell: s.cell, footRow: s.footRow, floating: s.floating,
      hasCast: !!s.frames.cast, hasRaise: !!s.frames.attack_raise, lungePx: ((s.lungePx ?? 24) * sc) / meta.scale, anim: true,
      opaqueRight: opaque(sprite)[2], ...monsterAnchors(s) };
  },
};

/** A battle: the layers, the enemies in `actors`, then four 160 px party boxes on the real slots, a message box in hud. */
function battle(ids: string[]) {
  const main = new Container();
  const layers = BattleLayers.of(main);
  const enemies = ids.map(byId);
  const view = new AiEnemyView(enemies, art);
  const sprites = view.build();
  layers.actors.addChild(...sprites);
  const party = PARTY_FEET_Y.map((_, i) => {
    const g = new Graphics().rect(0, 0, 160, 160).fill(0x4488ff);
    const p = partySpritePosition(i, { footRow: 76, scale: 2 });
    g.position.set(p.x, p.y);
    layers.actors.addChild(g);
    return g;
  });
  const text = new Graphics().rect(24, 24, 1872, BATTLE_MESSAGE_HEIGHT - 48).fill(0xffffff);
  layers.hud.addChild(text);
  return { main, layers, enemies, view, sprites, party, text };
}

/** Run enemy i's attack on hero j to its contact frame; returns the screen geometry there. */
function contact(b: ReturnType<typeof battle>, i: number, j: number) {
  const { view, sprites, party, enemies } = b;
  view.playAttack(i, party[j]);
  const { contactAt } = view.poses.attackTiming(i);
  for (let f = 0; f < contactAt; f++) view.update(1, sprites);
  const f = art.getMonsterFrames(enemies[i].sprite ?? enemies[i].id)!;
  const scale = (sprites[i].scale.x / f.artScale) * f.scale;
  const out = { right: sprites[i].x + f.opaqueRight! * scale, feet: sprites[i].y + (f.footRow + 1) * scale,
    targetLeft: party[j].getBounds().x, targetFeet: PARTY_FEET_Y[j], pose: view.poses.state(i).pose };
  for (let k = 0; k < 200 && view.poses.isAttacking(i); k++) view.update(1, sprites);
  return out;
}

describe('enemy travel reaches the target (item 3)', () => {
  const rows = scenarios.find((s) => s.id === 'f_melee_rows')!.enemies!;

  it.each(rows.map((id, i) => [i, id] as const))('f_melee_rows enemy %i (%s) lands on every hero row', (i) => {
    const b = battle(rows);
    for (let j = 0; j < 4; j++) {
      const c = contact(b, i, j);
      expect(c.pose).toBe('attack');
      expect(Math.abs(c.right - (c.targetLeft + ENEMY_REACH_OVERLAP)), `enemy ${i} -> hero ${j}`).toBeLessThanOrEqual(50);
      expect(Math.abs(c.feet - c.targetFeet), `enemy ${i} -> hero ${j} feet`).toBeLessThanOrEqual(30);
    }
    // every sprite is back home
    const fresh = battle(rows);
    expect(b.sprites.map((s) => [s.x, s.y])).toEqual(fresh.sprites.map((s) => [s.x, s.y]));
  });

  // EF-B1: the troll is a 2.5 sheet laid out as `huge`, so nine take pass 3 (screen scale 2, factor 0.8)
  it.each([['troll', 0.8], ['white_crocodile', 0.5]] as const)('nine %ss at scale factor %s land on every hero row', (id, factor) => {
    const b = battle(Array(9).fill(id));
    const f = art.getMonsterFrames(id)!;
    expect(b.sprites.map((s) => s.scale.x)).toEqual(Array(9).fill(f.artScale * factor));
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 4; j++) {
        const c = contact(b, i, j);
        expect(Math.abs(c.right - (c.targetLeft + ENEMY_REACH_OVERLAP)), `${id} ${i} -> hero ${j}`).toBeLessThanOrEqual(50);
        expect(Math.abs(c.feet - c.targetFeet)).toBeLessThanOrEqual(30);
      }
    }
  });

  it('the ranged dragon attacks in place (travel 0); the goblin beside it travels', () => {
    const b = battle(['dragon', 'goblin']);
    expect(b.view.attackPlan(0, b.party[0])).toEqual({ travel: 0, rise: 0 });
    expect(b.view.attackPlan(1, b.party[0]).travel).toBeGreaterThan(300);
    b.view.playAttack(0, b.party[0]);
    expect(b.view.poses.attackKind(0)).toBe('inplace');
  });
});

describe('a travelling boss never covers the message text (F0 item 3, item 7, defect 1)', () => {
  const bosses = ['garland', 'hollow_seraph', 'warmech', 'ashen_queen', 'lich', 'astos', 'chaos', 'drowned_sovereign', 'death_eye'];
  it.each(bosses)('%s: in actors on every frame, hud last, and no frame\'s art overlaps the text', (id) => {
    const b = battle([id]);
    const f = art.getMonsterFrames(id)!;
    b.view.playAttack(0, b.party[0]);
    const total = b.view.poses.attackTiming(0).totalFrames;
    const text = b.text.getBounds();
    let overlaps = 0;
    for (let k = 0; k < total; k++) {
      b.view.update(1, b.sprites);
      b.layers.update(1);
      const s = b.sprites[0];
      expect(s.parent).toBe(b.layers.actors);
      expect(b.main.children[b.main.children.length - 1]).toBe(b.layers.hud);
      const scale = (s.scale.x / f.artScale) * f.scale;
      const [l, t, r, btm] = frameBox(id, b.view.poses.state(0).pose);
      const box = { x0: s.x + l * scale, y0: s.y + t * scale, x1: s.x + r * scale, y1: s.y + btm * scale };
      if (box.x0 < text.x + text.width && text.x < box.x1 && box.y0 < text.y + text.height && text.y < box.y1) overlaps++;
    }
    expect(overlaps).toBe(0);
  });
});
