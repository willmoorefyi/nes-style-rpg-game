import type { Game } from '../core/Game.js';
import type { EnemyData } from '../types/index.js';
import { BattleScene } from '../scenes/BattleScene.js';
import { GameOverScene } from '../scenes/GameOverScene.js';

export interface BattleEndData {
  victory: boolean;
  xpReward: number;
  goldReward: number;
}

export class BattleTrigger {
  private game: Game;
  private enemyDataCache: Map<string, EnemyData> = new Map();
  private onBattleTriggered: (() => void) | null = null;

  constructor(game: Game) {
    this.game = game;
  }

  setOnBattleTriggered(callback: () => void): void {
    this.onBattleTriggered = callback;
  }

  async triggerBattle(enemyIds: string[]): Promise<void> {
    const enemies = await this.loadEnemyData(enemyIds);
    if (enemies.length === 0) return;

    const party = [...this.game.party.all];
    if (party.length === 0) return;

    this.onBattleTriggered?.();

    const battleScene = new BattleScene(this.game, { party, enemies });
    this.game.scenes.register('battle', battleScene);
    this.game.scenes.register('gameover', new GameOverScene(this.game));
    await this.game.scenes.switchTo('battle');
  }

  onBattleEnd(data: BattleEndData): void {
    if (data.victory) {
      this.game.party.distributeXp(data.xpReward);
      this.game.party.addGold(data.goldReward);
      this.game.scenes.switchTo('exploration');
    } else {
      this.game.scenes.switchTo('gameover');
    }
  }

  private async loadEnemyData(ids: string[]): Promise<EnemyData[]> {
    const result: EnemyData[] = [];
    for (const id of ids) {
      let data = this.enemyDataCache.get(id);
      if (!data) {
        const enemies = await this.game.data.loadEnemies('assets/data/enemies.json');
        for (const e of enemies) this.enemyDataCache.set(e.id, e);
        data = this.enemyDataCache.get(id);
      }
      if (data) result.push(data);
    }
    return result;
  }
}
