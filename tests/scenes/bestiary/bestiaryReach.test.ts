/**
 * P2 12d (docs/ROSTER_FIX_PLAN.md R-3): in the bestiary preview no sheet's art reaches the panel border. Over a full
 * loop (attack, hurt, cast, daze and the breaks), each displayed frame's own opaque right edge (from the atlas PNG)
 * stays at least 8 px inside the preview's inner rect (screen x), for every atlas sheet and attack variant of its enemies.
 */
import { describe, it, expect } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { BestiaryPreview, CachedArt, PREVIEW_INNER } from '../../../src/scenes/bestiary/BestiaryPreview.js';
import { validateBestiary } from '../../../src/core/bestiaryValidation.js';
import { monsterSpriteKey } from '../../../src/rendering/BattleArt.js';
import { atlas, atlasArt, atlasFrames, enemyData, frameBox } from '../../helpers/atlasFrames.js';
import type { EnemyData } from '../../../src/types/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const data = validateBestiary(parse(readFileSync(join(root, 'assets/data/bestiary.yaml'), 'utf-8')));
const LIMIT = PREVIEW_INNER.right - 8;

/** One enemy per sheet and attack variant (in place or travelling, heavy or not). */
const variants = (() => {
  const seen = new Map<string, EnemyData>();
  for (const e of enemyData) {
    const k = [monsterSpriteKey(e), e.attackAnim ?? '', e.attack ?? ''].join('/');
    if (!seen.has(k) && atlas.sheets[monsterSpriteKey(e)]) seen.set(k, e);
  }
  return [...seen.entries()];
})();

describe('the bestiary lunge stays inside the panel (12d)', () => {
  it.each(variants)('%s: every frame of a full loop is <= the inner right - 8', (_, e) => {
    const sheet = monsterSpriteKey(e);
    const preview = new BestiaryPreview(new Container(), new CachedArt(atlasArt), () => new Promise<Texture>(() => {}), data);
    preview.show({ enemy: e, seen: true, hasSpells: false }, null);
    const f = atlasFrames(sheet)!;
    let attacks = 0;
    let last = '';
    let maxRight = -Infinity;
    for (let k = 0; k < 3000 && attacks < 2; k++) {
      preview.update(1);
      const step = preview.loopStep;
      if (step === 'attack' && last !== 'attack') attacks++;
      last = step;
      const s = preview.enemySprite!;
      const scale = (s.scale.x / f.artScale) * f.scale;
      maxRight = Math.max(maxRight, s.getGlobalPosition().x + frameBox(sheet, preview.poses!.state(0).pose)[2] * scale);
    }
    expect(attacks, 'a full loop ran').toBe(2);
    expect(maxRight).toBeLessThanOrEqual(LIMIT);
    preview.destroy();
  });
});
