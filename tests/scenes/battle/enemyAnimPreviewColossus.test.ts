/**
 * R17 (docs/CHAOS_FORMS_PLAN.md 4.3): the dev preview drives a colossus. `&enemyAnim=loop` cycles slam, beam, cast
 * and hurt; `&enemyAnim=step` steps the colossus timeline frame by frame with the `enemy: frame / t` label.
 * C7 5.11 (C6-12, H12): a colossus whose art arrives after the preview's first fire still loops its own timelines (the
 * route is attached at build, placeholder included, so H12 does not reproduce), and the loop moves its canvas >= 40 px
 * (the slam's 48 / 40 px, C6-5; at C6's 12 / 8 px the whole loop moved it about 24 px: the real cause of C6-12).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { EnemyAnimPreview, PAUSE, previewTarget, colossusSchedule } from '../../../src/scenes/battle/enemyAnimPreview.js';
import { TIMELINE_FRAMES } from '../../../src/scenes/battle/colossus/colossusChoreography.js';
import { colossusArt } from '../../../src/rendering/ColossusArt.js';
import { colossusBattle, colossusEnemy, fixtureIo, HORIZON, installFixtureArt } from '../../helpers/colossusFixture.js';

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

describe('enemy animation preview on a late-ready colossus (C6-12, H12)', () => {
  let restore: () => void = () => {};
  beforeEach(() => { uninstall(); uninstall = () => {}; });
  afterEach(() => { colossusArt.release(); restore(); });

  it('the art arrives after the first fire: the colossus still loops slam, beam, cast and hurt, and its canvas moves >= 40 px', async () => {
    restore = colossusArt.setIo(fixtureIo());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = colossusBattle([colossusEnemy(HORIZON)]);
    expect(colossusArt.isReady(HORIZON)).toBe(false);
    const p = new EnemyAnimPreview('loop', 1, previewTarget(s.display, ['Chaos'], () => null));
    const step = (): void => { s.display.update(p.frameDt(1)); };
    for (let f = 0; f < 5; f++) step();                       // the preview fired while the placeholder was up
    await colossusArt.ensure([HORIZON]);
    await new Promise((r) => setTimeout(r, 0));               // the slot's upgrade (ensureFor().then)
    const view = s.display.colossus.view(0)!;
    expect(view.form.layers.length).toBeGreaterThan(1);       // the fixture form, not the placeholder
    const poses = s.display.enemyView!.poses;
    const seen = new Set<string>();
    const ys: number[] = [];
    for (let f = 0; f < colossusSchedule().cycle + 5; f++) {
      step();
      const m = poses.colossusMode(0);
      if (m && m !== 'idle') seen.add(m);
      ys.push(view.canvasOffset().y);
    }
    expect([...seen].sort()).toEqual(['beam', 'cast', 'hurt', 'slam']);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(40);
  });
});
