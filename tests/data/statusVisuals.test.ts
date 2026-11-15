/** Pass F item 5b: assets/data/status-visuals.yaml covers every status, and its art exists in the fx atlas. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { OVERLAY_GLYPHS, STATUS_OVERLAYS } from '../../src/scenes/battle/fx/statusEmitters.js';
import { STATUS_POSTURES } from '../../src/types/fxData.js';
import { loadStatusVisuals } from '../helpers/statusVisuals.js';

const STATUS_EFFECTS = ['poison', 'stun', 'sleep', 'blind', 'silence', 'death', 'stone', 'fear'] as const;
const VISUALS = loadStatusVisuals();
const RAW = (parse(readFileSync(resolve(__dirname, '../../assets/data/status-visuals.yaml'), 'utf8')) as { statuses: object }).statuses;
const ATLAS = JSON.parse(readFileSync(resolve(__dirname, '../../assets/sprites/battle-fx.json'), 'utf8')) as { glyphs: Record<string, unknown> };
const STATUS_SRC = readFileSync(resolve(__dirname, '../../src/battle/StatusEffects.ts'), 'utf8');

describe('status-visuals.yaml', () => {
  it('the StatusEffect list this test checks is the one in StatusEffects.ts', () => {
    const union = /export type StatusEffect = ([^;]+);/.exec(STATUS_SRC)?.[1] ?? '';
    expect(union.split('|').map((s) => s.trim().replace(/'/g, '')).sort()).toEqual([...STATUS_EFFECTS].sort());
  });

  it('every entry validates (none dropped)', () => {
    expect(Object.keys(VISUALS)).toEqual(Object.keys(RAW));
  });

  it('every StatusEffect except death has an entry, and is not reserved', () => {
    for (const s of STATUS_EFFECTS.filter((e) => e !== 'death')) {
      expect(VISUALS[s], s).toBeDefined();
      expect(VISUALS[s].reserved ?? false, s).toBe(false);
    }
    expect(VISUALS.death).toBeUndefined();
  });

  it('reserved entries (frozen, confuse) are not StatusEffects', () => {
    const reserved = Object.entries(VISUALS).filter(([, v]) => v.reserved).map(([s]) => s);
    expect(reserved.sort()).toEqual(['confuse', 'frozen']);
    for (const s of reserved) expect(STATUS_EFFECTS as readonly string[]).not.toContain(s);
  });

  it('every icon and overlay glyph is in battle-fx.json, every overlay is a known loop, every posture is known', () => {
    for (const [s, v] of Object.entries(VISUALS)) {
      expect(v.icon, s).toBeDefined();
      expect(ATLAS.glyphs[`${v.icon}.icon`], `${s} icon ${v.icon}`).toBeDefined();
      if (v.overlay) {
        expect(STATUS_OVERLAYS[v.overlay], `${s} overlay ${v.overlay}`).toBeDefined();
        for (const key of OVERLAY_GLYPHS[v.overlay]) expect(ATLAS.glyphs[key], `${s} overlay glyph ${key}`).toBeDefined();
      }
      if (v.posture) expect(STATUS_POSTURES as readonly string[]).toContain(v.posture);
    }
  });

  it('the table follows the plan: sleep and stun daze, stone stone, fear trembles; the icon priority order', () => {
    expect([VISUALS.sleep.posture, VISUALS.stun.posture, VISUALS.stone.posture, VISUALS.fear.posture]).toEqual(['daze', 'daze', 'stone', 'tremble']);
    expect(Object.keys(VISUALS).filter((s) => !VISUALS[s].reserved)).toEqual(['stone', 'stun', 'sleep', 'fear', 'silence', 'blind', 'poison']);
    expect(VISUALS.poison.tint).toBe(0xc8ffc8);
    expect(VISUALS.fear.tint).toBe(0xd8e4ff);
    expect(VISUALS.frozen.tint).toBe(0x9cc8ff);
  });
});
