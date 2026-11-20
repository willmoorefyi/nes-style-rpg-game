/** The M7-0 pilot's presets (docs/MODE7_PLAN.md 10) and the sky bands: pure, no rendering. */
import { describe, expect, it } from 'vitest';
import { cellToScreen, depthAt, horizonRow } from '../../../src/scenes/exploration/mode7/mode7Math.js';
import { PILOT_PRESETS, SHADOW_ROW, pickPreset, presetView } from '../../../src/scenes/exploration/mode7/pilotPresets.js';
import { SKY_HAZE, SKY_ZENITH, rgb15, skyBands } from '../../../src/scenes/exploration/mode7/FlightSky.js';

describe('pilot presets', () => {
  it('picks A by default and B / C by ?preset=', () => {
    expect(pickPreset('').id).toBe('a');
    expect(pickPreset('?preset=B').id).toBe('b');
    expect(pickPreset('?mode7=pilot&preset=c').id).toBe('c');
    expect(pickPreset('?preset=zz').id).toBe('a');
  });

  it.each(PILOT_PRESETS.map((p) => [p.id, p] as const))('preset %s: its horizon row, P on the shadow row at about 95 px per cell', (_id, preset) => {
    const v = presetView(preset, 75.5, 32.5);
    expect(horizonRow(v)).toBe(preset.horizon);
    const ship = cellToScreen(v, 75.5, 32.5);
    expect(Math.abs((ship?.y ?? 0) - (SHADOW_ROW + 0.5))).toBeLessThan(0.01);
    expect(Math.abs(v.f / depthAt(v, SHADOW_ROW + 0.5) - 95)).toBeLessThanOrEqual(2);
  });

  it('preset A is the plan\'s flight values', () => {
    const v = presetView(PILOT_PRESETS[0], 0, 0);
    expect(v.h).toBe(6);
    expect(v.kappa).toBeCloseTo(1 / 600, 12);
    expect(Math.abs(v.cy - 600)).toBeLessThanOrEqual(1);
    expect(Math.abs(v.back - 11.3)).toBeLessThanOrEqual(0.1);
  });
});

describe('sky bands', () => {
  it('run from the zenith to the haze in 15-bit steps, covering every row to the horizon', () => {
    const bands = skyBands(390);
    expect(bands[0].y).toBe(0);
    expect(bands[0].color).toBe(rgb15(SKY_ZENITH));
    expect(bands[bands.length - 1].color).toBe(rgb15(SKY_HAZE));
    expect(bands.reduce((n, b) => n + b.h, 0)).toBe(390);
    for (const b of bands) expect(b.color & 0x070707).toBe((b.color >> 5) & 0x070707);
  });
});
