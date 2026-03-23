import { Container } from 'pixi.js';
import type { Scene, MapData, EnemyData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { TilemapRenderer } from '../rendering/TilemapRenderer.js';
import { Camera } from '../rendering/Camera.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import { PlayerController } from '../entities/PlayerController.js';
import { NPC, type NPCData } from '../entities/NPC.js';
import { MapTransitionSystem } from '../systems/MapTransition.js';
import { NPCInteractionSystem } from '../systems/NPCInteraction.js';
import { EncounterSystem } from '../systems/EncounterSystem.js';
import { DialogBox } from '../ui/DialogBox.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { PlaceholderTextures } from '../rendering/PlaceholderTextures.js';
import { BattleScene } from './BattleScene.js';
import { GameOverScene } from './GameOverScene.js';

export class ExplorationScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private worldContainer = new Container();
  private uiContainer = new Container();
  private camera: Camera;
  private tilemap: TilemapRenderer | null = null;
  private collisionMap: CollisionMap | null = null;
  private player: PlayerController | null = null;
  private npcs: NPC[] = [];
  private mapTransition: MapTransitionSystem;
  private npcInteraction: NPCInteractionSystem;
  private encounterSystem: EncounterSystem;
  private dialogBox: DialogBox;
  private currentDialog: string[] = [];
  private dialogIndex = 0;
  private inDialog = false;
  private errorDisplay: ErrorDisplay;
  private placeholders: PlaceholderTextures;
  private currentMapId: string = '';
  private savedPosition: { x: number; y: number } | null = null;
  private enemyDataCache: Map<string, EnemyData> = new Map();

  constructor(game: Game) {
    this.game = game;
    this.camera = new Camera(this.worldContainer);
    this.mapTransition = new MapTransitionSystem(game.data);
    this.npcInteraction = new NPCInteractionSystem();
    this.encounterSystem = new EncounterSystem(game.events);
    this.dialogBox = new DialogBox({ onComplete: () => this.advanceDialog() });
    this.dialogBox.visible = false;
    this.errorDisplay = new ErrorDisplay();
    this.placeholders = new PlaceholderTextures({ app: game.app });
    this.container.addChild(this.worldContainer);
    this.container.addChild(this.uiContainer);
    this.uiContainer.addChild(this.dialogBox);
    this.uiContainer.addChild(this.errorDisplay.container);

    this.encounterSystem.setOnEncounter((enemies) => this.triggerBattle(enemies));
    this.game.events.on('battleEnd', (data) => this.onBattleEnd(data));
  }

  async enter(): Promise<void> {
    this.encounterSystem.start();
    if (this.savedPosition && this.currentMapId) {
      await this.loadMap(this.currentMapId);
      this.player?.setPosition(this.savedPosition.x, this.savedPosition.y);
      this.savedPosition = null;
    } else {
      await this.loadMap('test-town');
    }
  }

  async loadMap(mapId: string): Promise<void> {
    this.worldContainer.removeChildren();
    this.npcs = [];
    this.errorDisplay.hide();
    this.currentMapId = mapId;

    let mapData: MapData;
    try {
      mapData = await this.game.data.loadMap(`assets/maps/${mapId}.json`);
    } catch (e) {
      const msg = `Failed to load map: ${mapId}`;
      console.error(msg, e);
      this.errorDisplay.show(msg);
      return;
    }

    if (mapData.encounterRate) {
      this.encounterSystem.setRate(mapData.encounterRate);
    }
    if (mapData.encounters) {
      this.encounterSystem.setEncounters(mapData.encounters);
    }

    this.collisionMap = new CollisionMap(mapData);
    this.tilemap = new TilemapRenderer(mapData, null, 16, this.placeholders);
    this.worldContainer.addChild(this.tilemap.container);

    this.camera.setMapBounds(mapData.width, mapData.height);
    this.tilemap.setCamera(this.camera);

    const spawnX = mapData.width > 1 ? 1 : 0;
    const spawnY = mapData.height > 1 ? 1 : 0;
    this.player = new PlayerController({
      startX: spawnX,
      startY: spawnY,
      texture: this.placeholders.getPlayerTexture(),
      collisionMap: this.collisionMap,
      input: this.game.input,
      events: this.game.events,
    });
    this.worldContainer.addChild(this.player.animation.sprite);
    this.camera.follow(this.player);

    for (const npcData of mapData.npcs) {
      const npc = new NPC(npcData as NPCData, this.placeholders.getNPCTexture());
      this.npcs.push(npc);
      this.worldContainer.addChild(npc.sprite);
    }
    this.player.setNPCPositions(this.npcs.map(n => ({ x: n.tileX, y: n.tileY })));
    this.npcInteraction.setNPCs(this.npcs);
    this.npcInteraction.setPlayer(this.player);
    this.npcInteraction.setInput(this.game.input);

    this.mapTransition.setTransitions(mapData.transitions);

    this.camera.update();
    this.tilemap.render();
  }

  update(dt: number): void {
    if (this.inDialog) {
      this.dialogBox.update(dt, this.game.input);
      return;
    }

    if (!this.player) return;

    const wasMoving = this.player.isMoving;
    this.player.update(dt);

    const npc = this.npcInteraction.checkInteraction();
    if (npc && npc.dialog.length > 0) {
      this.startDialog(npc.dialog);
      return;
    }

    if (wasMoving && !this.player.isMoving) {
      const transition = this.mapTransition.getTransitionAt(this.player.gridX, this.player.gridY);
      if (transition) {
        this.executeTransition(transition);
        return;
      }
    }

    this.camera.update();
    this.tilemap?.render();
  }

  private startDialog(lines: string[]): void {
    this.currentDialog = lines;
    this.dialogIndex = 0;
    this.inDialog = true;
    this.dialogBox.show(lines[0]);
  }

  private advanceDialog(): void {
    this.dialogIndex++;
    if (this.dialogIndex < this.currentDialog.length) {
      this.dialogBox.show(this.currentDialog[this.dialogIndex]);
    } else {
      this.inDialog = false;
      this.dialogBox.visible = false;
    }
  }

  private async executeTransition(transition: { targetMap: string; targetX: number; targetY: number }): Promise<void> {
    await this.loadMap(transition.targetMap);
    if (this.player) {
      this.player.setPosition(transition.targetX, transition.targetY);
      this.camera.update();
      this.tilemap?.render();
    }
  }

  private async triggerBattle(enemyIds: string[]): Promise<void> {
    if (!this.player) return;
    this.savedPosition = { x: this.player.gridX, y: this.player.gridY };
    this.encounterSystem.stop();

    const enemies = await this.loadEnemyData(enemyIds);
    if (enemies.length === 0) return;

    const party = [...this.game.party.all];
    if (party.length === 0) return;

    const battleScene = new BattleScene(this.game, { party, enemies });
    this.game.scenes.register('battle', battleScene);
    this.game.scenes.register('gameover', new GameOverScene(this.game));
    await this.game.scenes.switchTo('battle');
  }

  private async loadEnemyData(ids: string[]): Promise<EnemyData[]> {
    const result: EnemyData[] = [];
    for (const id of ids) {
      let data = this.enemyDataCache.get(id);
      if (!data) {
        try {
          const enemies = await this.game.data.loadEnemies('assets/data/enemies.json');
          for (const e of enemies) this.enemyDataCache.set(e.id, e);
          data = this.enemyDataCache.get(id);
        } catch (e) {
          console.error(`Failed to load enemy data for '${id}':`, e);
          this.errorDisplay.show(`Failed to load enemy data`);
        }
      }
      if (data) result.push(data);
    }
    return result;
  }

  private onBattleEnd(data: { victory: boolean; xpReward: number; goldReward: number }): void {
    if (data.victory) {
      this.game.party.distributeXp(data.xpReward);
      this.game.party.addGold(data.goldReward);
      this.game.scenes.switchTo('exploration');
    } else {
      this.game.scenes.switchTo('gameover');
    }
  }

  exit(): void {
    this.encounterSystem.stop();
    this.worldContainer.removeChildren();
    this.npcs = [];
  }

  setPlayerPosition(x: number, y: number): void {
    this.player?.setPosition(x, y);
  }
}
