/**
 * R27 (docs/CHAOS_FORMS_PLAN.md 4.6; rev 4: 18.1, 18.6): every colossus texture is linear-filtered (no mipmaps; rev 3's
 * nearest is superseded for colossus forms, the atlas stays nearest) and destroyed when the battle ends or
 * the bestiary closes: the live texture count before a colossus battle equals the count after it, and the same for a
 * bestiary visit (one form loaded at a time).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { BattleScene } from '../../../src/scenes/BattleScene.js';
import { colossusArt } from '../../../src/rendering/ColossusArt.js';
import { BestiaryColossus } from '../../../src/scenes/bestiary/bestiaryColossus.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { Character } from '../../../src/entities/Character.js';
import { colossusEnemy, fixtureIo, HORIZON, ORRERY } from '../../helpers/colossusFixture.js';
import { createMockBattleSceneDeps, testClass } from '../../helpers/testUtils.js';

let restore: () => void = () => {};
afterEach(() => { colossusArt.release(); restore(); vi.restoreAllMocks(); });

const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('colossus textures (R27)', () => {
  it('a colossus battle loads its textures (linear) and leaves none behind when it ends', async () => {
    const io = fixtureIo();
    restore = colossusArt.setIo(io);
    vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
    vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
    vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
    const before = colossusArt.liveTextures;
    const party = [new Character({ name: 'WAR', classData: testClass() })];
    const s = new BattleScene(createMockBattleSceneDeps(), { party, enemies: [colossusEnemy(HORIZON)], rng: () => 0.5 });
    s.enter();
    await colossusArt.ensure([HORIZON]);
    await flush();
    s.update(1);
    expect(colossusArt.liveTextures).toBeGreaterThan(before);
    for (const t of io.made) if (!t.destroyed) expect(t.source.scaleMode).toBe('linear');
    s.exit();
    expect(colossusArt.liveTextures).toBe(before);
    expect(io.made.every((t) => t.destroyed)).toBe(true);
  });

  it('a bestiary visit loads one form at a time and releases it on exit', async () => {
    const io = fixtureIo();
    restore = colossusArt.setIo(io);
    const before = colossusArt.liveTextures;
    const parent = new Container();
    const b = new BestiaryColossus(parent, colossusArt);
    await b.show(colossusEnemy(HORIZON));
    const one = colossusArt.liveTextures;
    expect(one).toBeGreaterThan(before);
    expect(colossusArt.loadedForms()).toEqual([HORIZON]);
    await b.show(colossusEnemy(ORRERY));
    expect(colossusArt.loadedForms()).toEqual([ORRERY]);
    b.dispose();
    expect(colossusArt.liveTextures).toBe(before);
  });
});
