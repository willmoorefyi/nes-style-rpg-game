import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  AUTO, CUSTOM, MAX_CUSTOM, addCustom, cycleBackground, cycleClass, cycleFormation, cycleKit, cycleLevel, defaultConfig,
  enemiesOf, kitOf, levelOf, parseDeepLink, removeLastCustom, sanitizeConfig, togglePromoted, type SandboxData,
} from '../../../src/scenes/debugSandbox/sandboxModel.js';
import { MAX_LAYOUT } from '../../../src/scenes/battle/EnemyLayoutAi.js';
import { ROWS, changeRow, nextSpeed, rowLabel } from '../../../src/scenes/debugSandbox/sandboxRows.js';
import { SandboxSession } from '../../../src/scenes/debugSandbox/sandboxSession.js';
import { kitFor, kitMember, buildMember, type Kits } from '../../../src/systems/debugParty.js';
import { loadRealRegistries } from '../../helpers/realData.js';

const DATA = parse(readFileSync('assets/data/debug-sandbox.yaml', 'utf-8')) as SandboxData;
const KITS = parse(readFileSync('assets/data/kits.yaml', 'utf-8')) as Kits;
const ENEMY_IDS = new Set((parse(readFileSync('assets/data/enemies.yaml', 'utf-8')) as { id: string }[]).map((e) => e.id));

afterEach(() => { vi.restoreAllMocks(); });

describe('sandbox model: cycling', () => {
  it('the cursor opens on Fight!, and the rows end with Fight! and Title', () => {
    expect(ROWS.slice(-2)).toEqual(['fight', 'title']);
  });

  it('cycling the level visits every level once and wraps; it resets the formation', () => {
    let c = { ...defaultConfig(DATA), formation: 1 };
    const seen: string[] = [];
    for (let i = 0; i < DATA.levels.length; i++) { seen.push(c.level); c = cycleLevel(DATA, c, 1); }
    expect(seen).toEqual(DATA.levels.map((l) => l.id));
    expect(c.level).toBe(DATA.levels[0].id);
    expect(c.formation).toBe(0);
    expect(cycleLevel(DATA, defaultConfig(DATA), -1).level).toBe(DATA.levels[DATA.levels.length - 1].id);
  });

  it('a slot cycles through the 8 base classes, and through all 16 with promoted on', () => {
    const N = DATA.classes.base.length;   // pass CB: one slot cycles through every base class
    let c = defaultConfig(DATA);
    c = { ...c, party: ['warrior', ...c.party.slice(1)] };
    const seen = new Set<string>();
    for (let i = 0; i < N; i++) { seen.add(c.party[0]); c = cycleClass(DATA, c, 0, 1); }
    expect([...seen]).toEqual(DATA.classes.base);
    c = togglePromoted(DATA, c);
    seen.clear();
    for (let i = 0; i < N; i++) { seen.add(c.party[0]); c = cycleClass(DATA, c, 0, 1); }
    expect(seen.size).toBe(N);
    expect(DATA.classes.promoted).toEqual(expect.arrayContaining(['knight', 'ninja', 'master', 'white_wizard', 'black_wizard', 'red_wizard', 'berserker', 'centurion', 'ranger', 'paladin', 'samurai', 'summoner', 'necromancer', 'mystic_warrior', 'sage_hero', 'rifleman', 'valkyrie', 'virtuoso', 'duelist', 'plague_doctor', 'machinist', 'chronomancer', 'inquisitor', 'abyssal_knight', 'blade_dancer', 'sky_captain', 'void_walker']));
  });

  it('turning promoted off demotes a promoted member to its base class', () => {
    const c = { ...togglePromoted(DATA, defaultConfig(DATA)), party: ['knight', 'thief', 'white_wizard', 'black_mage'] };
    expect(togglePromoted(DATA, c).party).toEqual(['warrior', 'thief', 'white_mage', 'black_mage']);
  });

  it('kit, enemies and background cycle through auto / their options / Custom', () => {
    const c = { ...defaultConfig(DATA), level: 'l2_garland' };
    expect(kitOf(DATA, c)).toBe('lv2');
    expect(cycleKit(DATA, c, 1).kit).toBe(DATA.kits[0]);
    expect(cycleKit(DATA, c, -1).kit).toBe(DATA.kits[DATA.kits.length - 1]);
    expect(cycleFormation(DATA, c, 1).formation).toBe(CUSTOM);          // one formation, then Custom
    expect(cycleBackground(DATA, c, 1).background).toBe(DATA.backgrounds[0]);
    expect(cycleBackground(DATA, cycleBackground(DATA, c, 1), -1).background).toBe(AUTO);
  });

  it('every row the arrows change gives a new configuration; Fight! and Title have none', () => {
    const c = defaultConfig(DATA);
    for (const row of ROWS) {
      const next = changeRow(row, c, DATA, 1);
      if (row === 'fight' || row === 'title' || row === 'speed') expect(next).toBeNull();
      else expect(next).not.toEqual(c);
    }
    expect(nextSpeed(5, 1)).toBe(5);
    expect(nextSpeed(1, -1)).toBe(1);
    expect(nextSpeed(3, -1)).toBe(2);
  });
});

describe('sandbox model: custom formation', () => {
  it('caps at 9 (the layout limit) and removes the last', () => {
    expect(MAX_CUSTOM).toBe(MAX_LAYOUT);
    let c = defaultConfig(DATA);
    for (let i = 0; i < MAX_CUSTOM; i++) {
      const r = addCustom(c, 'goblin');
      expect(r.added).toBe(true);
      c = r.config;
    }
    const full = addCustom(c, 'wolf');
    expect(full.added).toBe(false);
    expect(enemiesOf(DATA, full.config)).toHaveLength(9);
    expect(enemiesOf(DATA, removeLastCustom(c))).toHaveLength(8);
    expect(c.formation).toBe(CUSTOM);
  });

  it('every level formation is within the layout limit', () => {
    for (const level of DATA.levels) for (const f of level.formations) expect(f.length).toBeLessThanOrEqual(MAX_LAYOUT);
  });
});

describe('sandbox model: deep link and stored config', () => {
  it('?sandbox=&party=&enemies= sets level, classes (promoted on for a promoted class) and a custom formation', () => {
    const c = parseDeepLink(DATA, '?mute=1&sandbox=l3_garland&party=knight,thief,white_mage,black_mage&enemies=garland', ENEMY_IDS)!;
    expect(c.level).toBe('l3_garland');
    expect(c.party).toEqual(['knight', 'thief', 'white_mage', 'black_mage']);
    expect(c.promoted).toBe(true);
    expect(enemiesOf(DATA, c)).toEqual(['garland']);
    expect(levelOf(DATA, c).level).toBe(3);
    expect(parseDeepLink(DATA, '?mute=1&scenario=f_pace', ENEMY_IDS)).toBeNull();
  });

  it('unknown ids log and fall back', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = parseDeepLink(DATA, '?sandbox=nowhere&party=warrior,no_such_class&enemies=goblin,yeti', ENEMY_IDS)!;
    expect(c.level).toBe(DATA.levels[0].id);
    expect(c.party).toEqual(['warrior', DATA.party[1], DATA.party[2], DATA.party[3]]);
    expect(enemiesOf(DATA, c)).toEqual(['goblin']);
    expect(warn).toHaveBeenCalledTimes(3);
    // only unknown enemies: the level's first formation, not an empty fight
    const none = parseDeepLink(DATA, '?sandbox=l2_garland&enemies=yeti', ENEMY_IDS)!;
    expect(enemiesOf(DATA, none)).toEqual(['garland']);
  });

  it('a stored configuration round-trips; garbage gives the default', () => {
    const c = { ...cycleKit(DATA, cycleLevel(DATA, defaultConfig(DATA), 3), 2), background: 'desert' };
    expect(sanitizeConfig(DATA, JSON.parse(JSON.stringify(c)), ENEMY_IDS)).toEqual(c);
    expect(sanitizeConfig(DATA, null, ENEMY_IDS)).toEqual(defaultConfig(DATA));
    expect(sanitizeConfig(DATA, 'x', ENEMY_IDS)).toEqual(defaultConfig(DATA));
  });
});

describe('sandbox: kits per level and class', () => {
  beforeAll(async () => { await loadRealRegistries(); });

  it("every level's kit (and every Kit-row kit) equips with no refusal for every base class", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kits = new Set([...DATA.levels.map((l) => l.kit), ...DATA.kits]);
    for (const kit of kits) {
      for (const cls of DATA.classes.base) {
        expect(KITS[kit]?.[cls], `${kit}.${cls}`).toBeDefined();
        const c = buildMember(kitMember(kitFor(KITS, kit, cls), cls, 5, cls), 'test');
        expect(c, `${kit}.${cls}`).not.toBeNull();
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('a promoted class uses its base class kit; a missing entry goes naked with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(kitFor(KITS, 'lv2', 'knight')).toEqual(KITS.lv2.warrior);
    expect(kitFor({ start: {} }, 'start', 'warrior')).toEqual({ gear: [], spells: [] });
    expect(kitFor(KITS, 'nope', 'warrior')).toEqual({ gear: [], spells: [] });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('the party scales through the class growth: a Lv 10 warrior has more HP than a Lv 1 one', () => {
    const lv = (n: number) => buildMember(kitMember(KITS.start.warrior, 'warrior', n, 'W'), 'test')!.maxHp;
    expect(lv(10)).toBeGreaterThan(lv(1));
  });
});

describe('sandbox rows and the results line', () => {
  it('the labels show the level, kit, enemies and speed', () => {
    const ctx = { data: DATA, kits: KITS, className: (id: string) => id, enemyName: (id: string) => id, speed: 3 as const };
    const c = { ...defaultConfig(DATA), level: 'l1_fields' };
    expect(rowLabel('level', c, ctx)).toContain('Lv 1');
    expect(rowLabel('kit', c, ctx)).toContain('auto: start');
    expect(rowLabel('enemies', c, ctx)).toContain('goblin x5');
    expect(rowLabel('speed', c, ctx)).toContain('[3]');
    expect(rowLabel('kit', { ...c, kit: 'gone' }, ctx)).toContain('MISSING');
  });

  it('the tally counts W / L / escape per setup and remembers the last battle', () => {
    const s = new SandboxSession();
    s.record('a', { outcome: 'win', rounds: 4, hpPercent: 61 });
    s.record('a', { outcome: 'loss', rounds: 7, hpPercent: 0 });
    s.record('b', { outcome: 'escape', rounds: 1, hpPercent: 100 });
    expect(s.tally('a')).toEqual({ win: 1, loss: 1, escape: 0 });
    expect(s.summary('b')).toBe('W 0  L 0  Run 1   Last: ran, 1 rounds, party HP 100%');
    expect(s.summary('a')).toContain('(other setup)');
  });
});
