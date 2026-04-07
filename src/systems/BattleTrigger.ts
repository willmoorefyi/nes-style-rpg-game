import type { Game } from '../core/Game.js';
import type { EnemyData } from '../types/index.js';
import { BattleScene, type BattleSceneDeps, type BattleSceneConfig } from '../scenes/BattleScene.js';
import { GameOverScene } from '../scenes/GameOverScene.js';
import { CutsceneManager } from './CutsceneManager.js';
import { CutsceneRegistry } from './CutsceneRegistry.js';

export interface BattleEndData {
  victory: boolean;
  xpReward: number;
  goldReward: number;
}

/** Optional config for boss/scripted battles */
export interface BossBattleConfig {
  canRun: boolean;
  flag?: string;         // story flag to set on victory
  isBoss: boolean;
  postVictoryCutscene?: string;  // cutscene ID to play after victory
}

export class BattleTrigger {
  private game: Game;
  private enemyDataCache: Map<string, EnemyData> = new Map();
  private onBattleTriggered: (() => void) | null = null;
  /** Stored boss config for the current battle, cleared after battle ends */
  private currentBossConfig: BossBattleConfig | null = null;
  /** Optional fade callbacks provided by the rendering layer */
  private fadeDeps: { fadeOut?: (ms: number) => Promise<void>; fadeIn?: (ms: number) => Promise<void> } = {};

  constructor(game: Game) {
    this.game = game;
  }

  setOnBattleTriggered(callback: () => void): void {
    this.onBattleTriggered = callback;
  }

  setFadeDeps(deps: { fadeOut?: (ms: number) => Promise<void>; fadeIn?: (ms: number) => Promise<void> }): void {
    this.fadeDeps = deps;
  }

  async triggerBattle(enemyIds: string[], bossConfig?: BossBattleConfig, background?: string): Promise<void> {
    const enemies = await this.loadEnemyData(enemyIds);
    if (enemies.length === 0) return;

    const party = [...this.game.party.all];
    if (party.length === 0) return;

    this.onBattleTriggered?.();
    this.currentBossConfig = bossConfig ?? null;

    const spells = await this.game.data.loadSpells('assets/data/spells.yaml');
    const deps: BattleSceneDeps = { input: this.game.input, events: this.game.events };
    const sceneConfig: BattleSceneConfig = {
      party,
      enemies,
      inventory: this.game.inventory,
      canRun: bossConfig?.canRun ?? true,
      spells,
      background,
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
    if (data.victory) {
      // C4: Track levels before XP distribution for level-up detection
      const levelsBefore = this.game.party.all.map(m => m.level);
      this.game.party.distributeXp(data.xpReward);
      this.game.party.addGold(data.goldReward);
      // Set story flag on boss victory
      if (this.currentBossConfig?.flag) {
        this.game.gameFlags.set(this.currentBossConfig.flag);
        this.game.events.emit('bossDefeated', { flag: this.currentBossConfig.flag });
      }
      // C4: Build level-up messages
      const levelUpMessages: string[] = [];
      this.game.party.all.forEach((member, i) => {
        if (member.level > levelsBefore[i]) {
          levelUpMessages.push(`${member.name} reached Level ${member.level}!`);
        }
      });
      // Play post-victory cutscene if configured
      const cutsceneId = this.currentBossConfig?.postVictoryCutscene;
      this.currentBossConfig = null;
      if (cutsceneId) {
        this.game.scenes.pop();
        this.playPostVictoryCutscene(cutsceneId);
      } else if (levelUpMessages.length > 0) {
        // Emit level-up dialogs BEFORE pop so the exploration scene's handler is ready
        for (const msg of levelUpMessages) {
          this.game.events.emit('showDialog', { text: msg, onComplete: () => {} });
        }
        this.game.scenes.pop();
      } else {
        this.game.scenes.pop();
      }
    } else {
      this.currentBossConfig = null;
      this.game.scenes.switchTo('gameover');
    }
  }

  private async playPostVictoryCutscene(cutsceneId: string): Promise<void> {
    const script = CutsceneRegistry.get(cutsceneId);
    if (!script) return;
    const cutscene = new CutsceneManager({
      showDialog: (text: string) => new Promise<void>((resolve) => {
        this.game.events.emit('showDialog', { text, onComplete: resolve });
      }),
      fadeOut: this.fadeDeps.fadeOut,
      fadeIn: this.fadeDeps.fadeIn,
      flags: this.game.gameFlags,
      party: [...this.game.party.all],
    });
    await cutscene.play(script);
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
