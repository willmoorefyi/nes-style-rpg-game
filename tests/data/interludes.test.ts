/**
 * CHAOS_FORMS_PLAN 2.3 (R18, R19, A1, D-O8, D-O15) and rev 4 (18.4 B4, 18.8 row 2c B5): the interlude scripts in
 * assets/data/battle-interludes.yaml. Unskipped time at message speed 3 (BATTLE_MESSAGE_FRAMES 90 per message, SHAKE_FRAMES
 * 8 per shake, `with: previous` runs alongside the step before it), each script's total pinned; the pan offsets within the
 * B4 border limits of the colossus geometry; a `rise` ends at the next `pan`'s `from`; the swap / rise / variant rules per
 * form pair, and per non-form phase (the same record on both sides: chaos_crack on F3's 0.25 phase).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import {
  INTERLUDE_CAP_FRAMES, PAN_ENVELOPE, interludeCap, interludeFormErrors, interludeFrames, panLimits, riseSpan, validateInterludeScript,
  type InterludeScript, type PanGeometry, type PanLimits,
} from '../../src/data/interludeScripts.js';
import { InterludeRegistry } from '../../src/data/InterludeRegistry.js';
import type { EnemyData } from '../../src/types/index.js';

const RAW = parse(readFileSync('assets/data/battle-interludes.yaml', 'utf-8')) as { interludes: InterludeScript[] };
const SCRIPTS = RAW.interludes;
const ENEMIES = parse(readFileSync('assets/data/enemies.yaml', 'utf-8')) as EnemyData[];
const byId = (id: string): EnemyData => ENEMIES.find((e) => e.id === id)!;
const script = (id: string): InterludeScript => SCRIPTS.find((s) => s.id === id)!;

/**
 * The colossus geometry the pan limits come from: colossus.json once it has the form (A5, the 18.5 contract shape), else
 * the planned rev-4 geometry (18.4: F3 canvas 2700 x 1080 at scale 1, rest place (-527, -210), the disc `core` at canvas
 * (1347, 510); F2 1320 x 900 at scale 1, place (40, -20)).
 */
type Geometry = PanGeometry & { anchors?: { core: [number, number] } };
const PLANNED: Record<string, Geometry> = {
  chaos_horizon: { canvas: [2700, 1080], scale: 1, place: [-527, -210], anchors: { core: [1347, 510] } },
  chaos_orrery: { canvas: [1320, 900], scale: 1, place: [40, -20] },
};
function geometryOf(art: string): Geometry | undefined {
  const path = 'assets/sprites/colossus.json';
  const json = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) as { forms?: Record<string, Geometry> } : {};
  return json.forms?.[art] ?? PLANNED[art];
}
function limitsOf(art: string): PanLimits | undefined {
  const g = geometryOf(art);
  return g ? panLimits(g) : undefined;
}

/** Every phase with an interlude: [script id, from record, to record]; a non-form phase keeps its record. */
const PAIRS: Array<[string, EnemyData, EnemyData]> = ENEMIES.flatMap((e) => (e.bossPhases ?? [])
  .filter((p) => p.interlude).map((p): [string, EnemyData, EnemyData] => [p.interlude!, e, p.form ? byId(p.form) : e]));

describe('battle-interludes.yaml', () => {
  it('every script validates (the file is the `interludes:` list InterludeRegistry reads)', () => {
    expect(SCRIPTS.map((s) => s.id).sort()).toEqual(['chaos_crack', 'chaos_i1', 'chaos_i2', 'chaos_i3']);
    for (const s of SCRIPTS) expect(() => validateInterludeScript(s), s.id).not.toThrow();
  });

  it('the view\'s registry reads the real file (the scripts without a pan; chaos_i2 needs the view\'s B4 rule, 18.4)', () => {
    const reg = InterludeRegistry.from(RAW);
    for (const id of ['chaos_i1', 'chaos_i3', 'chaos_crack']) expect(reg.get(id), id).toEqual(script(id).steps);
  });

  it('each script\'s unskipped total at message speed 3 is pinned and within its cap (480; 600 for chaos_i2)', () => {
    const totals = Object.fromEntries(SCRIPTS.map((s) => [s.id, interludeFrames(s)]));
    expect(totals).toEqual({ chaos_crack: 102, chaos_i1: 436, chaos_i2: 577, chaos_i3: 130 });
    for (const s of SCRIPTS) expect(interludeFrames(s), s.id).toBeLessThanOrEqual(interludeCap(s.id));
    expect([interludeCap('chaos_i1'), interludeCap('chaos_i2'), interludeCap('chaos_i3'), interludeCap('chaos_crack')])
      .toEqual([INTERLUDE_CAP_FRAMES, 600, 480, 480]);
  });

  it('every phase with an interlude keeps the swap / rise / variant / pan rules (R13, R19, B4, B5)', () => {
    expect(PAIRS.map(([id, a, b]) => `${id}: ${a.id} -> ${b.id}`)).toEqual(['chaos_i1: chaos -> chaos_orrery',
      'chaos_i2: chaos_orrery -> chaos_horizon', 'chaos_crack: chaos_horizon -> chaos_horizon', 'chaos_i3: chaos_horizon -> chaos_horizon_core']);
    for (const [id, from, to] of PAIRS) expect(interludeFormErrors(script(id), from, to, limitsOf(to.colossus ?? '')), id).toEqual([]);
    const swaps = (id: string) => script(id).steps.filter((s) => s.type === 'swap').length;
    expect(['chaos_i1', 'chaos_i2', 'chaos_i3', 'chaos_crack'].map(swaps)).toEqual([1, 1, 0, 0]);
  });

  it('chaos_crack: shake x1, flash white 4, the core\'s crack frame, then the phase message (18.8 row 2c)', () => {
    expect(script('chaos_crack').steps).toEqual([
      { type: 'shake', times: 1 },
      { type: 'flash', color: '#ffffff', frames: 4, alpha: 1 },
      { type: 'variant', layer: 'core', frame: 'crack' },
      { type: 'message', text: 'The horizon groans; core revealed!' },
    ]);
  });

  it('B4: the F3 pan limits are the border rule minus the motion envelope: dx [-247, +521], dy [-80, +324]', () => {
    expect(PAN_ENVELOPE).toEqual({ up: 4, down: 0, left: 0, right: 0 });
    expect(limitsOf('chaos_horizon')).toEqual({ dx: [-247, 521], dy: [-80, 324] });
    // the borders alone (no layer moving): the bottom gives up the 4 px of breathing
    expect(panLimits(PLANNED.chaos_horizon, { up: 0, down: 0, left: 0, right: 0 })).toEqual({ dx: [-247, 521], dy: [-84, 324] });
  });

  it('chaos_i2 (18.4): rise from_dy 700 over 120 frames ending at the pan start, then the pan from (+480, +120) to rest', () => {
    const steps = script('chaos_i2').steps;
    const rise = steps.findIndex((s) => s.type === 'rise');
    expect(steps[rise]).toEqual({ type: 'rise', frames: 120, from_dy: 700 });
    expect(steps.find((s) => s.type === 'pan')).toEqual({ type: 'pan', from: [480, 120], frames: 120, ease: 'out' });
    expect(riseSpan(steps, rise)).toEqual({ from: [480, 820], to: [480, 120] });
    // F2's rise has no pan after it: it ends at rest
    const i1 = script('chaos_i1').steps;
    expect(riseSpan(i1, i1.findIndex((s) => s.type === 'rise'))).toEqual({ from: [0, 180], to: [0, 0] });
  });

  it('every frame of the F3 reveal pan keeps the border rules, and its first frame shows the disc in the field', () => {
    const g = geometryOf('chaos_horizon')!;
    const lim = limitsOf('chaos_horizon')!;
    const pan = script('chaos_i2').steps.find((s) => s.type === 'pan')!;
    if (pan.type !== 'pan') throw new Error('no pan');
    for (let f = 0; f <= pan.frames; f++) {
      const u = 1 - (1 - f / pan.frames) ** 2;   // ease out; any monotone ease stays between from and rest
      const [dx, dy] = [pan.from[0] * (1 - u), pan.from[1] * (1 - u)];
      expect(dx >= lim.dx[0] && dx <= lim.dx[1] && dy >= lim.dy[0] && dy <= lim.dy[1], `frame ${f}: (${dx}, ${dy})`).toBe(true);
    }
    const core = PLANNED.chaos_horizon.anchors!.core;
    const disc = [g.place[0] + pan.from[0] + core[0] * g.scale, g.place[1] + pan.from[1] + core[1] * g.scale];
    expect(disc).toEqual([1300, 420]);
    expect(disc[0] > 0 && disc[0] < 1920 && disc[1] > 120 && disc[1] < 780).toBe(true);
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

  it('form rules: two swaps, rise before swap, variant / pan on an atlas form, a pan outside the limits', () => {
    const atlas = { id: 'a', sprite: 'a' } as EnemyData;
    const col = { id: 'c', sprite: 'a', colossus: 'c' } as EnemyData;
    const col2 = { id: 'd', sprite: 'a', colossus: 'c' } as EnemyData;
    const lim: PanLimits = { dx: [-247, 521], dy: [-80, 324] };
    const errs = (steps: InterludeScript['steps'], a: EnemyData, b: EnemyData) => interludeFormErrors({ id: 't', steps }, a, b, lim).join('; ');
    expect(errs([{ type: 'swap' }, { type: 'swap' }], atlas, col)).toMatch(/swap/);
    expect(errs([], atlas, col)).toMatch(/swap/);
    expect(errs([{ type: 'swap' }], col, col2)).toMatch(/swap/);
    expect(errs([{ type: 'rise', frames: 9, from_dy: 9 }, { type: 'swap' }], atlas, col)).toMatch(/rise/);
    expect(errs([{ type: 'swap' }, { type: 'variant', layer: 'core', frame: 'open' }], col, atlas)).toMatch(/variant/);
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [0, -60], frames: 9, ease: 'out' }], col, atlas)).toMatch(/pan/);
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [0, -200], frames: 9, ease: 'out' }], atlas, col)).toMatch(/limits/);
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [600, 0], frames: 9, ease: 'out' }], atlas, col)).toMatch(/limits/);
    // the A2 start rule is gone (18.4): any start inside the B4 limits, e.g. the F3 reveal's (+480, +120)
    expect(errs([{ type: 'swap' }, { type: 'pan', from: [480, 120], frames: 9, ease: 'out' }], atlas, col)).toBe('');
    expect(errs([{ type: 'variant', layer: 'core', frame: 'open' }], col, col2)).toBe('');
    // a non-form phase (the same record on both sides): no swap, no rise
    expect(errs([{ type: 'variant', layer: 'core', frame: 'crack' }], col, col)).toBe('');
    expect(errs([{ type: 'swap' }], col, col)).toMatch(/swap/);
  });

  it('a rise ends at the next pan\'s from: the pan may not run alongside the rise, nor a swap or rise come between', () => {
    const atlas = { id: 'a', sprite: 'a' } as EnemyData;
    const col = { id: 'c', sprite: 'a', colossus: 'c' } as EnemyData;
    const errs = (steps: InterludeScript['steps']) => interludeFormErrors({ id: 't', steps }, atlas, col).join('; ');
    type Step = InterludeScript['steps'][number];
    const rise: Step = { type: 'rise', frames: 9, from_dy: 300 };
    const pan: Step = { type: 'pan', from: [100, 50], frames: 9, ease: 'out' };
    expect(errs([{ type: 'swap' }, rise, { type: 'wait', frames: 4 }, pan])).toBe('');
    expect(errs([{ type: 'swap' }, rise, { ...pan, with: 'previous' }])).toMatch(/alongside/);
    expect(errs([{ type: 'swap' }, rise, rise, pan])).toMatch(/between/);
    expect(riseSpan([rise, { type: 'wait', frames: 4 }, pan], 0)).toEqual({ from: [100, 350], to: [100, 50] });
    expect(riseSpan([rise], 0)).toEqual({ from: [0, 300], to: [0, 0] });
  });
});
