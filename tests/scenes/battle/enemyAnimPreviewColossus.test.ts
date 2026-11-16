/**
 * R17 (docs/CHAOS_FORMS_PLAN.md 4.3): the dev preview drives a colossus. `&enemyAnim=loop` cycles slam, beam, cast
 * and hurt; `&enemyAnim=step` steps the colossus timeline frame by frame with the `enemy: frame / t` label.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { EnemyAnimPreview, PAUSE, previewTarget, colossusSchedule } from '../../../src/scenes/battle/enemyAnimPreview.js';
import { TIMELINE_FRAMES } from '../../../src/scenes/battle/colossus/colossusChoreography.js';
import { colossusBattle, installFixtureArt } from '../../helpers/colossusFixture.js';

let uninstall: () => void = () => {};
beforeEach(async () => { uninstall = await installFixtureArt(); });
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

describe('enemy animation preview on a colossus', () => {
  it('loop: slam, then beam, cast and hurt, each after the last ends plus the pause', () => {
    const s = colossusBattle();
    const t = previewTarget(s.display, ['Chaos'], () => null);
    const p = new EnemyAnimPreview('loop', 1, t);
    const poses = s.display.enemyView!.poses;
    const seen: string[] = [];
    for (let f = 0; f < colossusSchedule().cycle; f++) {
      poses.update(p.frameDt(1));
      const m = poses.colossusMode(0);
      if (m && m !== 'idle' && seen[seen.length - 1] !== m) seen.push(m);
    }
    expect(seen).toEqual(['slam', 'beam', 'cast', 'hurt']);
    const { events } = colossusSchedule();
    expect(events.map(([a]) => a)).toEqual(['attack', 'beam', 'cast', 'hurt']);
    expect(events[1][1]).toBe(TIMELINE_FRAMES.slam + PAUSE);
  });

  it('step: frame by frame, the label names the colossus timeline and its frame', () => {
    const s = colossusBattle();
    const p = new EnemyAnimPreview('step', 1, previewTarget(s.display, ['Chaos'], () => null));
    expect(p.frameDt(1)).toBe(0);
    p.stepTo(12);
    expect(p.labelText()).toBe('Chaos: slam / 12');
    p.stepTo(13);
    expect(p.labelText()).toBe('Chaos: slam / 13');
    const hud = new Container();
    p.showLabel(hud);
    expect(hud.children).toHaveLength(1);
  });
});
