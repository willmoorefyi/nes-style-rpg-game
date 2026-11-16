/**
 * CHAOS_FORMS_PLAN 2.3 (R13, R18, R19, A1, A2, D-O8, D-O15): the transformation interlude scripts in
 * assets/data/battle-interludes.yaml. Unskipped time at message speed 3 (BATTLE_MESSAGE_FRAMES 90 per message, SHAKE_FRAMES
 * 8 per shake, `with: previous` runs alongside the step before it), each script's total pinned; the pan offsets within the
 * coverage limits derived from the colossus geometry and the start rule; the swap / rise / variant rules per form pair.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import {
  INTERLUDE_CAP_FRAMES, interludeCap, interludeFormErrors, interludeFrames, panLimits, validateInterludeScript,
  type InterludeScript, type PanLimits,
} from '../../src/data/interludeScripts.js';
import type { EnemyData } from '../../src/types/index.js';

const SCRIPTS = parse(readFileSync('assets/data/battle-interludes.yaml', 'utf-8')) as InterludeScript[];
const ENEMIES = parse(readFileSync('assets/data/enemies.yaml', 'utf-8')) as EnemyData[];
const byId = (id: string): EnemyData => ENEMIES.find((e) => e.id === id)!;

/**
 * The colossus geometry the pan limits come from: colossus.json once it has the form (A5), else the planned F3 canvas
 * (4.2: place (-390, -300), 2700 x 1560 screen px at scale 3) and F2 (place (-60, 60), 1320 x 900).
 */
const PLANNED: Record<string, { place: { x: number; y: number }; w: number; h: number; scale: number }> = {
  chaos_horizon: { place: { x: -390, y: -300 }, w: 2700, h: 1560, scale: 3 },
  chaos_orrery: { place: { x: -60, y: 60 }, w: 1320, h: 900, scale: 3 },
};
function limitsOf(art: string): PanLimits | undefined {
  const path = 'assets/sprites/colossus.json';
  const json = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) as { forms?: Record<string, typeof PLANNED[string]> } : {};
  const g = json.forms?.[art] ?? PLANNED[art];
  return g ? panLimits(g.place, { w: g.w, h: g.h }, g.scale) : undefined;
}

/** Every form-bearing phase with an interlude: [script id, from record, to record]. */
const PAIRS: Array<[string, EnemyData, EnemyData]> = ENEMIES.flatMap((e) => (e.bossPhases ?? [])
  .filter((p) => p.form && p.interlude).map((p): [string, EnemyData, EnemyData] => [p.interlude!, e, byId(p.form!)]));

describe('battle-interludes.yaml', () => {
  it('every script validates', () => {
    expect(SCRIPTS.map((s) => s.id).sort()).toEqual(['chaos_i1', 'chaos_i2', 'chaos_i3']);
    for (const s of SCRIPTS) expect(() => validateInterludeScript(s), s.id).not.toThrow();
  });

  it('each script\'s unskipped total at message speed 3 is pinned and within its cap (480; 600 for chaos_i2)', () => {
    const totals = Object.fromEntries(SCRIPTS.map((s) => [s.id, interludeFrames(s)]));
    expect(totals).toEqual({ chaos_i1: 436, chaos_i2: 577, chaos_i3: 130 });
    for (const s of SCRIPTS) expect(interludeFrames(s), s.id).toBeLessThanOrEqual(interludeCap(s.id));
    expect([interludeCap('chaos_i1'), interludeCap('chaos_i2'), interludeCap('chaos_i3')]).toEqual([INTERLUDE_CAP_FRAMES, 600, 480]);
  });

  it('every form change with an interlude is the swap / rise / variant / pan rules (R13, R19, A2)', () => {
    expect(PAIRS.map(([id, a, b]) => `${id}: ${a.id} -> ${b.id}`))
      .toEqual(['chaos_i1: chaos -> chaos_orrery', 'chaos_i2: chaos_orrery -> chaos_horizon', 'chaos_i3: chaos_horizon -> chaos_horizon_core']);
    for (const [id, from, to] of PAIRS) {
      const script = SCRIPTS.find((s) => s.id === id)!;
      expect(interludeFormErrors(script, from, to, limitsOf(to.colossus ?? '')), id).toEqual([]);
    }
    const swaps = (id: string) => SCRIPTS.find((s) => s.id === id)!.steps.filter((s) => s.type === 'swap').length;
    expect([swaps('chaos_i1'), swaps('chaos_i2'), swaps('chaos_i3')]).toEqual([1, 1, 0]);
  });

  it('the planned F3 pan limits are dx [-128, 128], dy [-160, 138] art px; chaos_i2 pans from (0, -60)', () => {
    expect(limitsOf('chaos_horizon')).toEqual({ dx: [-128, 128], dy: [-160, 138] });
    const pan = SCRIPTS.find((s) => s.id === 'chaos_i2')!.steps.find((s) => s.type === 'pan');
    expect(pan).toMatchObject({ type: 'pan', from: [0, -60], frames: 120, ease: 'out' });
  });
});

describe('the interlude validator (refusals)', () => {
  const ok: InterludeScript = { id: 't', steps: [{ type: 'message', text: 'Hi!' }, { type: 'wait', frames: 10 }] };
  const bad = (steps: unknown[], re: RegExp) => expect(() => validateInterludeScript({ id: 't', steps } as InterludeScript)).toThrow(re);

  it('accepts a good script and refuses unknown steps, bad fields and an empty list', () => {
    expect(() => validateInterludeScript(ok)).not.toThrow();
    bad([], /steps/);
    bad([{ type: 'dance' }], /dance/);
    bad([{ type: 'wait', frames: 0 }], /frames/);
    bad([{ type: 'flash', color: 'white', frames: 4, alpha: 1 }], /color/);
    bad([{ type: 'flash', color: '#ffffff', frames: 4, alpha: 0 }], /alpha/);
    bad([{ type: 'dissolve', frames: 4, style: 'melt' }], /style/);
    bad([{ type: 'pose', name: 'dance' }], /pose/);
    bad([{ type: 'shake', times: 0 }], /times/);
    bad([{ type: 'message', text: 'café' }], /ASCII/);
    bad([{ type: 'wait', frames: 5, with: 'next' }], /with/);
    bad([{ type: 'wait', frames: 5, with: 'previous' }], /first/);
  });

  it('with: previous runs alongside the step before it; the total is the longest branch', () => {
    const s: InterludeScript = { id: 't', steps: [{ type: 'rise', frames: 120, from_dy: 300 }, { type: 'shake', times: 2, with: 'previous' },
      { type: 'wait', frames: 10 }, { type: 'wait', frames: 30, with: 'previous' }] };
    expect(interludeFrames(s)).toBe(150);
  });

  it('form rules: two swaps, rise before swap, variant / pan on an atlas form, a pan outside the limits or the start rule', () => {
    const atlas = { id: 'a', sprite: 'a' } as EnemyData;
    const col = { id: 'c', sprite: 'a', colossus: 'c' } as EnemyData;
    const col2 = { id: 'd', sprite: 'a', colossus: 'c' } as EnemyData;
    const lim: PanLimits = { dx: [-128, 128], dy: [-160, 138] };
    const errs = (steps: InterludeScript['steps'], a: EnemyData, b: EnemyData) => interludeFormErrors({ id: 't', steps }, a, b, lim).join('; ');
    expect(errs([{ type: 'swap' }, { type: 'swap' }], atlas, col)).toMatch(/swap/);
    expect(errs([], atlas, col)).toMatch(/swap/);
    expect(errs([{ type: 'swap' }], col, col2)).toMatch(/swap/);
    expect(errs([{ type: 'rise', frames: 9, from_dy: 9 }, { type: 'swap' }], atlas, col)).toMatch(/rise/);
    expect(errs([{ type: 'swap' }, { type: 'variant', layer: 'core', frame: 'open' }], col, atlas)).toMatch(/variant/);
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [0, -60], frames: 9, ease: 'out' }], col, atlas)).toMatch(/pan/);
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [0, -200], frames: 9, ease: 'out' }], atlas, col)).toMatch(/pan/);
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [10, -20], frames: 9, ease: 'out' }], atlas, col)).toMatch(/dx/);
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [0, 20], frames: 9, ease: 'out' }], atlas, col)).toMatch(/dy/);
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [-20, -60], frames: 9, ease: 'out' }], atlas, col)).toBe('');
    expect(errs([{ type: 'variant', layer: 'core', frame: 'open' }], col, col2)).toBe('');
  });
});
