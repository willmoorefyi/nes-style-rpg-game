import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { BattleTrigger } from '../../src/systems/BattleTrigger.js';
import { BattleScene } from '../../src/scenes/BattleScene.js';
import { ExplorationScene } from '../../src/scenes/ExplorationScene.js';
import { Character } from '../../src/entities/Character.js';
import type { Game } from '../../src/core/Game.js';
import type { CharacterClassData, EnemyData } from '../../src/types/index.js';
import { createMockGame, createMapData } from '../helpers/testUtils.js';

const root = join(__dirname, '../..');
const SHOP_INTERIORS = ['armor-shop', 'black-magic', 'inn', 'item-shop', 'weapon-shop', 'white-magic'];

describe('shop and inn music (IN-1)', () => {
  for (const id of SHOP_INTERIORS) {
    for (const path of [`assets-src/maps/cornelia-${id}.yaml`, `assets/maps/cornelia-${id}.yaml`, `assets/maps/ai/cornelia-${id}.yaml`]) {
      it(`${path} plays the shop track`, () => {
        expect(parse(readFileSync(join(root, path), 'utf-8')).music).toBe('shop');
      });
    }
  }
});

const fighter: CharacterClassData = {
  id: 'fighter', name: 'Fighter',
  baseStats: { hp: 30, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 1, vitality: 2, luck: 1 },
  usableEquipment: ['sword'], spellLevels: { white: 0, black: 0 },
};
const goblin: EnemyData = {
  id: 'goblin', name: 'Goblin',
  stats: { hp: 10, strength: 5, agility: 4, intelligence: 2, vitality: 3, luck: 2, attack: 5, defense: 2, magicDefense: 1 },
  xpReward: 10, goldReward: 5, sprite: 'goblin.png',
};

describe('battle music', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('BattleTrigger hands the game audio to the battle, which plays the battle track on enter', async () => {
    const base = createMockGame();
    const game = {
      ...base,
      party: { ...base.party, all: [new Character({ name: 'Hero', classData: fighter })], toJSON: () => ({}) },
      data: { ...base.data, loadEnemies: vi.fn().mockResolvedValue([goblin]) },
    };
    await new BattleTrigger(game as unknown as Game).triggerBattle(['goblin']);
    const registered = game.scenes.register.mock.calls.find(([name]) => name === 'battle');
    const battle = registered?.[1];
    expect(battle).toBeInstanceOf(BattleScene);
    (battle as BattleScene).enter();
    expect(game.audio.playMusic).toHaveBeenCalledWith('battle');
  });

  it('returning to the field restarts the map track', async () => {
    const game = createMockGame(createMapData({ id: 'town', music: 'town' }));
    game.currentMapId = 'town';
    const scene = new ExplorationScene(game as unknown as Game);
    await scene.enter();
    expect(game.audio.playMusic).toHaveBeenLastCalledWith('town');
    scene.onPause();
    game.audio.playMusic('battle');           // the battle (and its victory fanfare) took over
    scene.onResume();
    expect(game.audio.playMusic).toHaveBeenLastCalledWith('town');
  });
});
