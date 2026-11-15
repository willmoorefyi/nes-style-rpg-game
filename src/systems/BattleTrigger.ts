import type { Game } from '../core/Game.js';
import type { EnemyData } from '../types/index.js';
import { BattleScene, type BattleSceneDeps, type BattleSceneConfig } from '../scenes/BattleScene.js';
import { GameOverScene } from '../scenes/GameOverScene.js';
import type { EnemyAiPatterns } from '../scenes/battle/BattleSceneTypes.js';
import type { StatusEffect } from '../battle/StatusEffects.js';
import { captureBattleSnapshot, type BossBattleConfig } from './BattleRetry.js';
import { seenFlag } from '../scenes/bestiary/bestiaryModel.js';
import { battleArt, monsterSpriteKey } from '../rendering/BattleArt.js';

/** Loads the monster atlas pages a formation needs (BattleArt; tests inject their own). Never rejects. */
export interface MonsterArtPreload {
  ensure(sprites: string[]): Promise<void>;
}

export interface BattleEndData {
  victory: boolean;
  /** The party ran away: no rewards and no Game Over. */
  escaped?: boolean;
  xpReward: number;
  goldReward: number;
}

export type { BossBattleConfig } from './BattleRetry.js';

/** How a battle went, for a caller that ends it itself (`TriggerOptions.onEnd`). */
export interface BattleOutcomeData extends BattleEndData {
  /** Rounds that reached the execution phase. */
  rounds: number;
}

export interface TriggerOptions {
  /**
   * End the battle here instead of `onBattleEnd` (the debug sandbox): called once for victory, escape and defeat,
   * with no rewards, no Game Over and no retry snapshot. The callback moves on to the next scene.
   */
  onEnd?: (data: BattleOutcomeData) => void;
}

/** A battle scene that counts the rounds that reached execution (for `TriggerOptions.onEnd`). */
class RoundCountingBattleScene extends BattleScene {
  rounds = 0;

  update(dt: number): void {
    const before = this.battleState;
    super.update(dt);
    if (before !== 'execution' && this.battleState === 'execution') this.rounds++;
  }
}

export class BattleTrigger {
  private game: Game;
  private enemyDataCache: Map<string, EnemyData> = new Map();
  private onBattleTriggered: (() => void) | null = null;
  /** Stored boss config for the current battle, cleared after battle ends */
  private currentBossConfig: BossBattleConfig | null = null;
  /** Plays a post-victory cutscene in the field (provided by the exploration scene). */
  private cutscenePlayer: ((id: string) => Promise<void>) | null = null;

  constructor(game: Game, private readonly art: MonsterArtPreload = battleArt) {
    this.game = game;
  }

  setOnBattleTriggered(callback: () => void): void {
    this.onBattleTriggered = callback;
  }

  setCutscenePlayer(player: (id: string) => Promise<void>): void {
    this.cutscenePlayer = player;
  }

  async triggerBattle(enemyIds: string[], bossConfig?: BossBattleConfig, background?: string,
                      enemyAi?: EnemyAiPatterns, enemyStatus?: Record<number, StatusEffect[]>,
                      options: TriggerOptions = {}): Promise<void> {
    const enemies = await this.loadEnemyData(enemyIds);
    if (enemies.length === 0) return;

    const party = [...this.game.party.all];
    if (party.length === 0) return;
    for (const e of enemies) this.game.gameFlags.set(seenFlag(e.id));   // the bestiary's seen marks (BS-2)

    const { onEnd } = options;
    // Game Over > Retry Battle puts the game back exactly as it is now (a caller-ended battle never retries)
    this.game.battleRetry = onEnd ? null : captureBattleSnapshot(this.game, { enemyIds, bossConfig, background, enemyAi });
    this.onBattleTriggered?.();
    this.currentBossConfig = bossConfig ?? null;

    const spells = await this.game.data.loadSpells('assets/data/spells.yaml');
    // FW-8: the formation's atlas pages load before the battle opens, so its art draws at once (a failed or slow page
    // still opens the battle: those sprites take the late-art path)
    await this.art.ensure(enemies.map(monsterSpriteKey));
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
      enemyStatus,
      music: bossConfig?.isBoss ? 'boss' : undefined,
    };
    const counting = onEnd ? new RoundCountingBattleScene(deps, sceneConfig) : null;
    const battleScene = counting ?? new BattleScene(deps, sceneConfig);
    // Drop old scene references before creating new ones to prevent leaks
    this.game.scenes.unregister('battle');
    this.game.scenes.unregister('gameover');
    this.game.scenes.register('battle', battleScene);
    this.game.scenes.register('gameover', new GameOverScene(this.game));
    const stop = counting && onEnd ? this.endWith(counting, onEnd) : () => {};
    try {
      await this.game.scenes.push('battle');
    } catch (e) {
      stop();
      throw e;
    }
  }

  /** Listen for this battle's end once and hand it to `onEnd`; returns the unsubscribe. */
  private endWith(scene: RoundCountingBattleScene, onEnd: (data: BattleOutcomeData) => void): () => void {
    const events = this.game.events;
    const handler = (data: BattleEndData): void => {
      events.off('battleEnd', handler);
      this.currentBossConfig = null;
      this.game.battleRetry = null;
      onEnd({ ...data, rounds: scene.rounds });
    };
    events.on('battleEnd', handler);
    return () => events.off('battleEnd', handler);
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
