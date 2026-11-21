/**
 * NW2-0 (docs/NW2_EDITS_PLAN.md D-NW2-12, 10): the hike bounds have one source, `world-anchors.yaml`'s `hike:` block,
 * read by the verifier (`questLateData`) and the composer (`world_specs/common.hike()`); T6's `landingNear` is a BFS
 * in the anchor's mode bounded by the cap U; the composer's fight-count rates match the curve model's.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TerrainType, type MapData } from '../../src/types/index.js';
import { buildLateData, loadLateData } from '../../src/progression/questLateData.js';
import { landingNear } from '../../src/progression/questTravel.js';
import { MODE_RATE } from '../../src/progression/questCurve.js';
import { createMapData } from '../helpers/testUtils.js';

const BANDS = { tolerance: 2, fit: { scale: [0.75, 0.95], longPair: 23, ratio: { long: [0.7, 1.3], short: [0.55, 1.6] },
  bearing: { long: 40, short: 60 } } };

/** A one-row strip: the entrance on forest at (0, 0), then `cells` (terrain values). */
function strip(cells: TerrainType[]): MapData {
  const collision = [TerrainType.Forest, ...cells];
  return createMapData({ id: 'overworld', width: collision.length, height: 1, collision, entrances: { site: [0, 0] } });
}

const none = { flags: new Set<string>(), items: new Set<string>() };

describe('NW2 hike bounds', () => {
  it('the repository\'s block: K 25, U 50, the five hike sites and their modes', () => {
    const hike = loadLateData().geo?.hike;
    expect(hike).toEqual({ floor: 25, cap: 50, sites: { wat_onrac: 'walking', wat_waterfall: 'canoe',
      wat_caravan: 'walking', wnd_mirage: 'walking', wnd_lufenia: 'walking' } });
  });

  it('an absent block is null (pass W\'s file); a malformed one throws', () => {
    expect(buildLateData({ geo: BANDS }).geo?.hike).toBeNull();
    expect(() => buildLateData({ geo: { ...BANDS, hike: { floor: 25, cap: 'far', sites: {} } } })).toThrow(/hike/);
    expect(() => buildLateData({ geo: { ...BANDS, hike: { floor: 25, cap: 50, sites: { x: 'ship' } } } })).toThrow(/hike/);
  });

  it('the composer reads the same block, and its MODE_RATE is the curve model\'s', () => {
    const py = readFileSync('assets-src/tools/layouts/world_specs/common.py', 'utf-8');
    expect(py).toMatch(/"hike"/);
    const api = readFileSync('assets-src/tools/layouts/world_api.py', 'utf-8');
    expect(api).toContain(`MODE_RATE = {"walking": ${MODE_RATE.walking.toFixed(1)}, "canoe": ${MODE_RATE.canoe}}`);
  });
});

describe('NW2 landingNear: a BFS in the anchor\'s mode, bounded by the cap', () => {
  const far = strip([TerrainType.Forest, TerrainType.Forest, TerrainType.Forest, TerrainType.Forest, TerrainType.Grass]);
  it('the grass 5 steps away: found within 5, not within 4', () => {
    expect(landingNear(far, 'site', 'walking', 5, none)).toBe(true);
    expect(landingNear(far, 'site', 'walking', 4, none)).toBe(false);
  });

  it('a river on the way: only the canoe mode crosses it (the waterfall, foot+canoe)', () => {
    const river = strip([TerrainType.Forest, TerrainType.River, TerrainType.Forest, TerrainType.Grass]);
    expect(landingNear(river, 'site', 'walking', 50, none)).toBe(false);
    expect(landingNear(river, 'site', 'canoe', 50, none)).toBe(true);
  });

  it('rock blocks the walk (no straight-line shortcut, unlike the old 8-step disc)', () => {
    const rock = strip([TerrainType.Mountain, TerrainType.Grass]);
    expect(landingNear(rock, 'site', 'walking', 50, none)).toBe(false);
    expect(landingNear(rock, 'missing', 'walking', 50, none)).toBe(false);
  });
});
