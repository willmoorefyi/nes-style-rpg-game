/**
 * Pass K data and contract checks (docs/KNEEL_PLAN.md D-K1, D-K16, sections 6 to 8): status-visuals.yaml's poison kneel,
 * the posture rank and additive fear, the kneel_pilot scenario, the bestiary's hasKneel, the pure modules' imports and
 * the K1 line budgets.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Texture } from 'pixi.js';
import { POSTURE_RANK, postureOf, trembleOn, trembles, withKneel } from '../../src/scenes/battle/fx/statusRules.js';
import { STATUS_POSTURES } from '../../src/types/fxData.js';
import { validateStatusVisuals } from '../../src/core/schemaValidationFx.js';
import { Character } from '../../src/entities/Character.js';
import { enemyStatusOf, type DebugScenario } from '../../src/systems/DebugScenarioLoader.js';
import { isStatus } from '../../src/systems/debugParty.js';
import { formationFits } from '../../src/scenes/battle/EnemyLayoutAi.js';
import { hasKneel } from '../../src/scenes/bestiary/BestiaryPreview.js';
import { isWeak } from '../../src/scenes/battle/kneelChoreography.js';
import { layoutInput } from '../helpers/atlasFrames.js';
import { loadStatusVisuals } from '../helpers/statusVisuals.js';
import type { CharacterClassData } from '../../src/types/index.js';

afterEach(() => { vi.restoreAllMocks(); });

const VISUALS = loadStatusVisuals();
const lines = (path: string): number => readFileSync(path, 'utf-8').split('\n').length - 1;

describe('the kneel posture data (D-K16)', () => {
  it('poison has posture kneel and keeps its overlay, tint, pulse, icon and tag', () => {
    expect(VISUALS.poison).toMatchObject({ posture: 'kneel', overlay: 'bubbles', tint: 0xc8ffc8, pulse: [6, 60], icon: 'icon_poison', tag: 'PSN' });
    expect(STATUS_POSTURES).toContain('kneel');
    expect(validateStatusVisuals({ statuses: { x: { posture: 'kneel' }, y: { posture: 'kneels' } } }).statuses).toEqual({ x: { posture: 'kneel' } });
  });

  it('the rank: stone 5 > daze 4 > still 3 > kneel 2 > tremble 1 > none', () => {
    expect(POSTURE_RANK).toEqual({ stone: 5, daze: 4, still: 3, kneel: 2, tremble: 1, none: 0 });
    expect(postureOf(['sleep', 'poison'], VISUALS)).toBe('daze');          // a disabled kneel
    expect(postureOf(['frozen', 'poison'], VISUALS)).toBe('still');        // holds ready
    expect(postureOf(['poison', 'fear'], VISUALS)).toBe('kneel');
    expect(postureOf(['stone', 'sleep'], VISUALS)).toBe('stone');
  });

  it('trembles is additive: any fear trembles, shown on any posture but stone and daze', () => {
    expect(trembles(['poison', 'fear'], VISUALS)).toBe(true);
    expect(trembles(['poison'], VISUALS)).toBe(false);
    expect(trembleOn('kneel', ['poison', 'fear'], VISUALS)).toBe(true);
    expect(trembleOn('daze', ['sleep', 'fear'], VISUALS)).toBe(false);
    expect(trembleOn('stone', ['stone', 'fear'], VISUALS)).toBe(false);
  });

  it('withKneel (the dev preview) lifts none and tremble to kneel and keeps the stronger postures', () => {
    expect(STATUS_POSTURES.map((p) => withKneel(p))).toEqual(['kneel', 'daze', 'kneel', 'stone', 'kneel', 'still']);
  });
});

describe('the kneel_pilot scenario (section 8)', () => {
  const scenarios = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
  const s = scenarios.find((x) => x.id === 'kneel_pilot')!;
  const classes = parse(readFileSync('assets/data/classes.yaml', 'utf-8')) as CharacterClassData[];

  it('resolves: WAR weak, WHM asleep, WHM2 poisoned, WAR2 the full-HP control; known statuses only', () => {
    expect(s).toBeDefined();
    expect(s.party.map((m) => [m.name, m.class, m.level])).toEqual([['WAR', 'warrior', 10], ['WHM', 'white_mage', 10],
      ['WHM2', 'white_mage', 10], ['WAR2', 'warrior', 10]]);
    const war = new Character({ name: 'WAR', classData: classes.find((c) => c.id === 'warrior')!, level: 10 });
    expect(isWeak(s.party[0].hp!, war.maxHp)).toBe(true);                 // hp * 4 <= maxHp
    expect(s.party[0].hp! * 4).toBeLessThanOrEqual(war.maxHp);
    expect(s.party[1].status).toEqual(['sleep']);
    expect(s.party[2].status).toEqual(['poison']);
    expect(s.party[3].hp).toBeUndefined();
    expect(s.party.flatMap((m) => m.status ?? []).every(isStatus)).toBe(true);
    expect(s.items.potion).toBeGreaterThan(0);                            // WHM2's scripted Potion
  });

  it('goblin 0 asleep, goblin 1 poisoned, wolf 2 stunned, wolf 3 the control; the formation fits; grassland', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(s.enemies).toEqual(['goblin', 'goblin', 'wolf', 'wolf']);
    expect(enemyStatusOf(s)).toEqual({ 0: ['sleep'], 1: ['poison'], 2: ['stun'] });
    expect(error).not.toHaveBeenCalled();
    expect(formationFits(s.enemies.map(layoutInput))).toBe(true);
    expect(s.background).toBe('assets/backgrounds/grassland.webp');
  });
});

describe('the kt_pilot scenarios (docs/KNEEL_TWEEN_PLAN.md 8)', () => {
  const scenarios = parse(readFileSync('assets/data/debug-scenarios.yaml', 'utf-8')) as DebugScenario[];
  const classes = parse(readFileSync('assets/data/classes.yaml', 'utf-8')) as CharacterClassData[];
  const cases: [string, string[], Record<number, string[]>][] = [
    ['kt_pilot', ['goblin', 'wolf', 'green_slime', 'cobra'], { 0: ['poison'], 1: ['sleep'], 2: ['stun'], 3: ['poison'] }],
    ['kt_pilot_big', ['blue_dragon', 'garland'], { 0: ['sleep'], 1: ['poison'] }],
  ];
  it.each(cases)('%s: every pilot enemy kneels from a status, the formation fits, WAR weak, WHM poisoned', (id, enemies, st) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = scenarios.find((x) => x.id === id)!;
    expect(s.enemies).toEqual(enemies);
    expect(enemyStatusOf(s)).toEqual(st);
    expect(error).not.toHaveBeenCalled();
    expect(formationFits(s.enemies.map(layoutInput))).toBe(true);
    const war = new Character({ name: 'WAR', classData: classes.find((c) => c.id === 'warrior')!, level: s.party[0].level });
    expect(isWeak(s.party[0].hp!, war.maxHp)).toBe(true);
    expect(s.party[1].status).toEqual(['poison']);
    expect(s.party.flatMap((m) => m.status ?? []).every(isStatus)).toBe(true);
  });
});

describe('the bestiary daze step (D-K15)', () => {
  it('hasKneel is texture identity: own kneel frames when kneel !== daze', () => {
    const daze = new Texture();
    expect(hasKneel({ textures: { kneel: daze, daze } as never })).toBe(false);
    expect(hasKneel({ textures: { kneel: new Texture(), daze } as never })).toBe(true);
  });
});

describe('pass K contracts', () => {
  it('the new pure modules import nothing from pixi.js', () => {
    for (const f of ['kneelChoreography', 'partyPose', 'enemyPoseTypes', 'enemyOffsets', 'EnemyPoseController', 'enemyChoreography',
      'enemyAttackTables', 'attackChoreography']) {
      expect(readFileSync(`src/scenes/battle/${f}.ts`, 'utf-8'), f).not.toMatch(/from 'pixi\.js'/);
    }
  });

  it.each([
    ['src/scenes/battle/BattleAnimationController.ts', 306], ['src/scenes/battle/kneelChoreography.ts', 150],
    ['src/scenes/battle/partyPose.ts', 130], ['src/scenes/battle/enemyPoseTypes.ts', 70], ['src/scenes/battle/kneelPreview.ts', 110],
    ['src/scenes/battle/AiEnemyView.ts', 246], ['src/rendering/BattleArt.ts', 240], ['src/rendering/CharacterAtlas.ts', 240],
    ['src/scenes/BattleScene.ts', 594],
  ])('%s stays within its K1 budget (%i lines)', (path, max) => {
    expect(lines(path)).toBeLessThanOrEqual(max);
  });
});
