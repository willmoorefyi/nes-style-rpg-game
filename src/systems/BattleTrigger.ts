import type { Game } from '../core/Game.js';
import type { EnemyData } from '../types/index.js';
import { BattleScene, type BattleSceneDeps, type BattleSceneConfig } from '../scenes/BattleScene.js';
import { GameOverScene } from '../scenes/GameOverScene.js';
import type { EnemyAiPatterns } from '../scenes/battle/BattleSceneTypes.js';
import { captureBattleSnapshot, type BossBattleConfig } from './BattleRetry.js';

export interface BattleEndData {
  victory: boolean;
  /** The party ran away: no rewards and no Game Over. */
  escaped?: boolean;
  xpReward: number;
  goldReward: number;
}

export type { BossBattleConfig } from './BattleRetry.js';

export class BattleTrigger {
  private game: Game;
  private enemyDataCache: Map<string, EnemyData> = new Map();
  private onBattleTriggered: (() => void) | null = null;
  /** Stored boss config for the current battle, cleared after battle ends */
  private currentBossConfig: BossBattleConfig | null = null;
  /** Plays a post-victory cutscene in the field (provided by the exploration scene). */
  private cutscenePlayer: ((id: string) => Promise<void>) | null = null;

  constructor(game: Game) {
    this.game = game;
  }

  setOnBattleTriggered(callback: () => void): void {
    this.onBattleTriggered = callback;
  }

  setCutscenePlayer(player: (id: string) => Promise<void>): void {
    this.cutscenePlayer = player;
  }

  async triggerBattle(enemyIds: string[], bossConfig?: BossBattleConfig, background?: string,
                      enemyAi?: EnemyAiPatterns): Promise<void> {
    const enemies = await this.loadEnemyData(enemyIds);
    if (enemies.length === 0) return;

    const party = [...this.game.party.all];
    if (party.length === 0) return;

    // Game Over > Retry Battle puts the game back exactly as it is now
    this.game.battleRetry = captureBattleSnapshot(this.game, { enemyIds, bossConfig, background, enemyAi });
    this.onBattleTriggered?.();
    this.currentBossConfig = bossConfig ?? null;

    const spells = await this.game.data.loadSpells('assets/data/spells.yaml');
    // audio: the battle scene plays the battle and victory tracks itself (IN-1)
    const deps: BattleSceneDeps = { input: this.game.input, events: this.game.events, audio: this.game.audio };
    const sceneConfig: BattleSceneConfig = {
      party,
      enemies,
      inventory: this.game.inventory,
      canRun: bossConfig?.canRun ?? true,
      spells,
      background,
      enemyAi,
      music: bossConfig?.isBoss ? 'boss' : undefined,
    };
    const battleScene = new BattleScene(deps, sceneConfig);
    // Drop old scene references before creating new ones to prevent leaks
    this.game.scenes.unregister('battle');
    this.game.scenes.unregister('gameover');
    this.game.scenes.register('battle', battleScene);
    this.game.scenes.register('gameover', new GameOverScene(this.game));
    await this.game.scenes.push('battle');
  }

  onBattleEnd(data: BattleEndData): void {
    if (data.escaped) {
      // back to the field where the battle started (boss battles never allow Run); nothing to retry
      this.currentBossConfig = null;
      this.game.battleRetry = null;
      this.game.scenes.pop();
      return;
    }
    if (!data.victory) {
      this.currentBossConfig = null;
      this.game.scenes.switchTo('gameover');
      return;
    }
    this.game.battleRetry = null;
    // C4: Track levels before XP distribution for level-up detection
    const levelsBefore = this.game.party.all.map(m => m.level);
    this.game.party.distributeXp(data.xpReward);
    this.game.party.addGold(data.goldReward);
    // Set story flag on boss victory
    if (this.currentBossConfig?.flag) {
      this.game.gameFlags.set(this.currentBossConfig.flag);
      this.game.events.emit('bossDefeated', { flag: this.currentBossConfig.flag });
    }
    // Level-up messages queue in the field dialog, ahead of any post-victory cutscene
    this.game.party.all.forEach((member, i) => {
      if (member.level > levelsBefore[i]) {
        this.game.events.emit('showDialog', { text: `${member.name} reached Level ${member.level}!`, onComplete: () => {} });
      }
    });
    const cutsceneId = this.currentBossConfig?.postVictoryCutscene;
    this.currentBossConfig = null;
    this.game.scenes.pop();
    if (cutsceneId) {
      if (this.cutscenePlayer) {
        this.cutscenePlayer(cutsceneId).catch((e) => console.error(`Cutscene ${cutsceneId} failed:`, e));
      } else {
        console.error(`No field scene to play post-victory cutscene ${cutsceneId}`);
      }
    }
  }

  private async loadEnemyData(ids: string[]): Promise<EnemyData[]> {
    const result: EnemyData[] = [];
    for (const id of ids) {
      let data = this.enemyDataCache.get(id);
      if (!data) {
        const enemies = await this.game.data.loadEnemies('assets/data/enemies.yaml');
        for (const e of enemies) this.enemyDataCache.set(e.id, e);
        data = this.enemyDataCache.get(id);
      }
      if (data) result.push(data);
    }
    return result;
  }
}
