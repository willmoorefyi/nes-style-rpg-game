import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Camera } from '../rendering/Camera.js';
import { PlayerController } from '../entities/PlayerController.js';
import { MapTransitionSystem } from '../systems/MapTransition.js';
import { NPCInteractionSystem } from '../systems/NPCInteraction.js';
import { EncounterSystem } from '../systems/EncounterSystem.js';
import { DialogBox } from '../ui/DialogBox.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { PlaceholderTextures } from '../rendering/PlaceholderTextures.js';
import { MapLoader } from '../systems/MapLoader.js';
import { DialogManager } from '../systems/DialogManager.js';
import { BattleTrigger } from '../systems/BattleTrigger.js';

export class ExplorationScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private worldContainer = new Container();
  private uiContainer = new Container();
  private camera: Camera;
  private player: PlayerController | null = null;
  private mapTransition: MapTransitionSystem;
  private npcInteraction: NPCInteractionSystem;
  private encounterSystem: EncounterSystem;
  private errorDisplay: ErrorDisplay;
  private placeholders: PlaceholderTextures;
  private currentMapId: string = '';
  private currentMapData: import('../types/index.js').MapData | null = null;
  private savedPosition: { x: number; y: number } | null = null;
  private mapLoader: MapLoader;
  private dialogManager: DialogManager;
  private battleTrigger: BattleTrigger;
  private paused = false;

  constructor(game: Game) {
    this.game = game;
    this.camera = new Camera(this.worldContainer);
    this.mapTransition = new MapTransitionSystem(game.data);
    this.npcInteraction = new NPCInteractionSystem();
    this.encounterSystem = new EncounterSystem(game.events);
    this.errorDisplay = new ErrorDisplay();
    this.placeholders = new PlaceholderTextures({ app: game.app });
    const dialogBox = new DialogBox({ onComplete: () => this.dialogManager.advance() });
    dialogBox.visible = false;
    this.dialogManager = new DialogManager(dialogBox);
    this.mapLoader = new MapLoader(game.data, this.placeholders);
    this.battleTrigger = new BattleTrigger(game);
    this.battleTrigger.setOnBattleTriggered(() => {
      if (this.player) this.savedPosition = { x: this.player.gridX, y: this.player.gridY };
      this.encounterSystem.stop();
    });
    this.container.addChild(this.worldContainer);
    this.container.addChild(this.uiContainer);
    this.uiContainer.addChild(dialogBox);
    this.uiContainer.addChild(this.errorDisplay.container);
    this.encounterSystem.setOnEncounter((enemies) => this.battleTrigger.triggerBattle(enemies));
    this.game.events.on('battleEnd', (data) => this.battleTrigger.onBattleEnd(data));
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
    this.errorDisplay.hide();
    this.currentMapId = mapId;
    let result;
    try {
      result = await this.mapLoader.loadMap(mapId);
    } catch (e) {
      console.error(`Failed to load map: ${mapId}`, e);
      this.errorDisplay.show(`Failed to load map: ${mapId}`);
      return;
    }
    const { mapData, tilemap, collisionMap, npcs } = result;
    this.currentMapData = mapData;
    
    // Play map music
    const musicTrack = mapData.music ?? 'overworld';
    this.game.audio.playMusic(musicTrack);
    
    if (mapData.encounterRate) this.encounterSystem.setRate(mapData.encounterRate);
    if (mapData.encounters) this.encounterSystem.setEncounters(mapData.encounters);
    this.worldContainer.addChild(tilemap.container);
    this.camera.setMapBounds(mapData.width, mapData.height);
    tilemap.setCamera(this.camera);
    const spawnX = mapData.width > 1 ? 1 : 0;
    const spawnY = mapData.height > 1 ? 1 : 0;
    this.player = new PlayerController({
      startX: spawnX, startY: spawnY,
      texture: this.placeholders.getPlayerTexture(),
      collisionMap, input: this.game.input, events: this.game.events,
    });
    this.worldContainer.addChild(this.player.animation.sprite);
    this.camera.follow(this.player);
    for (const npc of npcs) this.worldContainer.addChild(npc.sprite);
    this.player.setNPCPositions(npcs.map(n => ({ x: n.tileX, y: n.tileY })));
    this.npcInteraction.setNPCs(npcs);
    this.npcInteraction.setPlayer(this.player);
    this.npcInteraction.setInput(this.game.input);
    this.mapTransition.setTransitions(mapData.transitions);
    this.camera.update();
    tilemap.render();
  }

  update(dt: number): void {
    if (this.paused) return;
    if (this.dialogManager.isActive) {
      this.dialogManager.update(dt, this.game.input);
      return;
    }
    if (this.game.input.isJustPressed('start')) {
      this.game.scenes.push('fieldMenu');
      return;
    }
    if (!this.player) return;
    const wasMoving = this.player.isMoving;
    this.player.update(dt);
    const npc = this.npcInteraction.checkInteraction();
    if (npc && npc.dialog.length > 0) {
      this.dialogManager.start(npc.dialog);
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
  }

  private async executeTransition(transition: { targetMap: string; targetX: number; targetY: number }): Promise<void> {
    await this.loadMap(transition.targetMap);
    if (this.player) {
      this.player.setPosition(transition.targetX, transition.targetY);
      this.camera.update();
    }
  }

  exit(): void {
    this.encounterSystem.stop();
    this.worldContainer.removeChildren();
  }

  onPause(): void {
    this.paused = true;
    this.encounterSystem.stop();
  }

  onResume(): void {
    this.paused = false;
    this.encounterSystem.start();
  }

  setPlayerPosition(x: number, y: number): void {
    this.player?.setPosition(x, y);
  }

  getMapId(): string {
    return this.currentMapId;
  }

  canSave(): boolean {
    return this.currentMapData?.canSave ?? false;
  }
}