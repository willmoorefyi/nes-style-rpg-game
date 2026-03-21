import { Container, Texture } from 'pixi.js';
import type { Scene, MapData } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { TilemapRenderer } from '../rendering/TilemapRenderer.js';
import { Camera } from '../rendering/Camera.js';
import { CollisionMap } from '../rendering/CollisionMap.js';
import { PlayerController } from '../entities/PlayerController.js';
import { NPC, type NPCData } from '../entities/NPC.js';
import { MapTransitionSystem } from '../systems/MapTransition.js';
import { NPCInteractionSystem } from '../systems/NPCInteraction.js';
import { DialogBox } from '../ui/DialogBox.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';

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
  private dialogBox: DialogBox;
  private currentDialog: string[] = [];
  private dialogIndex = 0;
  private inDialog = false;

  private tilesetTexture: Texture | null = null;
  private playerTexture: Texture | null = null;
  private errorDisplay: ErrorDisplay;

  constructor(game: Game) {
    this.game = game;
    this.camera = new Camera(this.worldContainer);
    this.mapTransition = new MapTransitionSystem(game.data);
    this.npcInteraction = new NPCInteractionSystem();
    this.dialogBox = new DialogBox({
      onComplete: () => this.advanceDialog(),
    });
    this.dialogBox.visible = false;
    this.errorDisplay = new ErrorDisplay();
    this.container.addChild(this.worldContainer);
    this.container.addChild(this.uiContainer);
    this.uiContainer.addChild(this.dialogBox);
    this.uiContainer.addChild(this.errorDisplay.container);
  }

  async enter(): Promise<void> {
    // Load textures - use placeholder if not available
    try {
      this.tilesetTexture = await this.game.assets.load<Texture>('assets/tiles/tileset.png');
    } catch (e) {
      console.warn('Failed to load tileset, using fallback:', e);
      this.tilesetTexture = Texture.WHITE;
    }
    try {
      this.playerTexture = await this.game.assets.load<Texture>('assets/sprites/player.png');
    } catch (e) {
      console.warn('Failed to load player sprite, using fallback:', e);
      this.playerTexture = Texture.WHITE;
    }
    await this.loadMap('test-town');
  }

  async loadMap(mapId: string): Promise<void> {
    // Clear old map
    this.worldContainer.removeChildren();
    this.npcs = [];
    this.errorDisplay.hide();

    let mapData: MapData;
    try {
      mapData = await this.game.data.loadMap(`assets/maps/${mapId}.json`);
    } catch (e) {
      const msg = `Failed to load map: ${mapId}`;
      console.error(msg, e);
      this.errorDisplay.show(msg);
      return;
    }


    // Setup tilemap
    this.collisionMap = new CollisionMap(mapData);
    this.tilemap = new TilemapRenderer(mapData, this.tilesetTexture!, 16);
    this.worldContainer.addChild(this.tilemap.container);

    // Setup camera
    this.camera.setMapBounds(mapData.width, mapData.height);
    this.tilemap.setCamera(this.camera);

    // Setup player
    const spawnX = mapData.width > 1 ? 1 : 0;
    const spawnY = mapData.height > 1 ? 1 : 0;
    this.player = new PlayerController({
      startX: spawnX,
      startY: spawnY,
      texture: this.playerTexture!,
      collisionMap: this.collisionMap,
      input: this.game.input,
      events: this.game.events,
    });
    this.worldContainer.addChild(this.player.animation.sprite);
    this.camera.follow(this.player);

    // Setup NPCs
    for (const npcData of mapData.npcs) {
      const npc = new NPC(npcData as NPCData, Texture.WHITE);
      this.npcs.push(npc);
      this.worldContainer.addChild(npc.sprite);
    }
    this.player.setNPCPositions(this.npcs.map(n => ({ x: n.tileX, y: n.tileY })));
    this.npcInteraction.setNPCs(this.npcs);
    this.npcInteraction.setPlayer(this.player);
    this.npcInteraction.setInput(this.game.input);

    // Setup transitions
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

    // Check for NPC interaction
    const npc = this.npcInteraction.checkInteraction();
    if (npc && npc.dialog.length > 0) {
      this.startDialog(npc.dialog);
      return;
    }

    // Check for map transition after move completes
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

  exit(): void {
    this.worldContainer.removeChildren();
    this.npcs = [];
  }

  setPlayerPosition(x: number, y: number): void {
    this.player?.setPosition(x, y);
  }
}
