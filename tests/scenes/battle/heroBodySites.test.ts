/**
 * Pass CL (docs/CLASS_LANCE_PLAN.md 7.3): a source scan of every read of a battle sprite's geometry (`getBounds()`,
 * `getLocalBounds()`, `headOf(`, and `sprite / target / actor` `.x .y .width .height .position` reads) in
 * src/scenes/battle/** and BattleScene.ts. Each must be in the allowlist with its reason: through the hero body helper
 * (heroBody.ts), enemy / colossus only, or moving the whole frame. A new read of a sprite's geometry fails here until
 * it is classified, so a party sprite's oversize cell cannot be measured as if it were the body by accident.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PAT = /\.getBounds\(\)|\.getLocalBounds\(\)|headOf\(|\b(sprite|target|actor)\.(x|y|width|height|position)\b(?!\s*(=[^=]|\+=|-=))/g;

/** file -> [reads, reason]. */
const ALLOW: Record<string, [number, string]> = {
  'src/scenes/battle/heroBody.ts': [10, 'the helper itself (an unregistered sprite answers its own x / y / size / bounds)'],
  'src/scenes/battle/ActiveHeroMarker.ts': [2, 'headOf: known heads of oversize frames (7.2); homeX: moves the whole sprite (the step)'],
  'src/scenes/battle/AiEnemyView.ts': [2, 'enemy only: places the enemy sprites'],
  'src/scenes/battle/BattleEffects.ts': [4, 'elementFlash: the whole frame flashes (lance included), or a placeholder box'],
  'src/scenes/battle/BattleFieldTargeting.ts': [2, 'iconRowTop: enemy only (the target label)'],
  'src/scenes/battle/actionNumbers.ts': [4, 'iconRowBottom: enemy only (heroes pass null)'],
  'src/scenes/battle/floatingNumbers.ts': [3, 'a box given by the caller (BattleEffects passes heroRect)'],
  'src/scenes/battle/formChangeView.ts': [1, 'colossus interlude only'],
  'src/scenes/battle/fx/statusFx.ts': [1, 'headOf: known heads of oversize frames (7.2)'],
  'src/scenes/battle/fx/texturePixels.ts': [1, 'the headOf definition'],
  'src/scenes/battle/glintPoint.ts': [1, 'enemy only (the heavy attack glint)'],
  'src/scenes/battle/partySprites.ts': [1, 'places the whole sprite (by the body box, 7.1)'],
  'src/scenes/battle/slashEffect.ts': [4, 'a box given by the caller (actionNumbers passes heroRect)'],
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function reads(path: string): number {
  let n = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const s = line.trim();
    if (s.startsWith('*') || s.startsWith('//') || s.startsWith('/*')) continue;
    n += (s.split('//')[0].match(PAT) ?? []).length;
  }
  return n;
}

describe('pass CL: every battle sprite geometry read is classified (7.3)', () => {
  it('the reads per file equal the allowlist', () => {
    const found: Record<string, number> = {};
    for (const f of [...files('src/scenes/battle'), 'src/scenes/BattleScene.ts']) {
      const n = reads(f);
      if (n) found[f] = n;
    }
    expect(found).toEqual(Object.fromEntries(Object.entries(ALLOW).map(([f, [n]]) => [f, n])));
  });
});
