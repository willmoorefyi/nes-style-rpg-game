import { Container } from 'pixi.js';
import type { Scene, ScriptedEncounter, VehicleType } from '../types/index.js';
import { resolveNPCDialog } from '../types/index.js';
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
import { KeyItemGateSystem } from '../systems/KeyItemGateSystem.js';
import { VehicleManager } from '../systems/VehicleManager.js';
import { ShopScene } from './ShopScene.js';
import { MagicShopScene } from './MagicShopScene.js';
import { InnScene } from './InnScene.js';
import { ShopRegistry } from '../data/ShopRegistry.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { upgradeParty } from '../systems/ClassUpgradeSystem.js';
import { WalkingMode } from '../entities/WalkingMode.js';
import { CanoeMode } from '../entities/CanoeMode.js';
import { ShipMode } from '../entities/ShipMode.js';
import { AirshipMode } from '../entities/AirshipMode.js';
import type { MovementMode } from '../entities/MovementMode.js';
import type { NPC } from '../entities/NPC.js';

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
  private keyItemGateSystem: KeyItemGateSystem;
  private vehicleManager: VehicleManager;
  private walkingMode: MovementMode = new WalkingMode();
  private pendingNpcAction: NPC | null = null;
  // Stored reference for cleanup in exit() to prevent listener leaks
  private handleBattleEnd = (data: { victory: boolean; xpReward: number; goldReward: number }) => this.battleTrigger.onBattleEnd(data);
  private handleShowDialog = (data: { text: string; onComplete: () => void }) => {
    this.dialogManager.start([data.text]);
    // Override advance to call onComplete when dialog finishes
    const origAdvance = this.dialogManager.advance.bind(this.dialogManager);
    const self = this;
    this.dialogManager.advance = function () {
      origAdvance();
      if (!self.dialogManager.isActive) {
        self.dialogManager.advance = origAdvance;
        data.onComplete();
      }
    };
  };

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
    this.keyItemGateSystem = new KeyItemGateSystem(game.inventory, game.gameFlags);
    // Build vehicle movement mode map
    const vehicleModes = new Map<VehicleType, MovementMode>([
      ['canoe', new CanoeMode()],
      ['ship', new ShipMode()],
      ['airship', new AirshipMode()],
    ]);
    this.vehicleManager = new VehicleManager(game.gameFlags, vehicleModes);
    this.container.addChild(this.worldContainer);
    this.container.addChild(this.uiContainer);
    this.uiContainer.addChild(dialogBox);
    this.uiContainer.addChild(this.errorDisplay.container);
    this.encounterSystem.setOnEncounter((enemies) => this.battleTrigger.triggerBattle(enemies));
    this.game.events.on('battleEnd', this.handleBattleEnd);
    this.game.events.on('showDialog', this.handleShowDialog);
  }

  async enter(): Promise<void> {
    this.encounterSystem.start();
    if (this.savedPosition && this.currentMapId) {
      await this.loadMap(this.currentMapId);
      this.player?.setPosition(this.savedPosition.x, this.savedPosition.y);
      this.savedPosition = null;
    } else if (this.game.currentMapId) {
      // Restore from save
      await this.loadMap(this.game.currentMapId);
      this.player?.setPosition(this.game.playerPosition.x, this.game.playerPosition.y);
    } else {
      await this.loadMap('cornelia');
    }
  }

  async loadMap(mapId: string): Promise<void> {
    this.worldContainer.removeChildren();
    this.errorDisplay.hide();
    this.currentMapId = mapId;
    this.game.currentMapId = mapId;
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
    // Wire key item gates
    this.keyItemGateSystem.setGates(mapData.keyItemGates ?? []);
    // Wire vehicle spawns
    this.vehicleManager.setSpawns(mapData.vehicles ?? []);
    this.camera.update();
    tilemap.render();
  }

  update(dt: number): void {
    if (this.paused) return;
    if (this.dialogManager.isActive) {
      this.dialogManager.update(dt, this.game.input);
      return;
    }
    // Handle pending NPC actions after dialog completes
    if (this.pendingNpcAction) {
      this.handleNpcPostDialog(this.pendingNpcAction);
      this.pendingNpcAction = null;
      return;
    }
    if (this.game.input.isJustPressed('start')) {
      this.game.scenes.push('fieldMenu');
      return;
    }
    if (!this.player) return;

    // Sync encounter rate multiplier from movement mode
    this.encounterSystem.setRateMultiplier(this.player.encounterRateMultiplier);

    // Check vehicle boarding on confirm key (when not moving)
    if (!this.player.isMoving && this.game.input.isJustPressed('confirm')) {
      const vehicleMode = this.vehicleManager.checkBoarding(this.player.gridX, this.player.gridY);
      if (vehicleMode) {
        this.player.currentMode = vehicleMode;
        return;
      }
    }

    const wasMoving = this.player.isMoving;
    this.player.update(dt);
    // Track player position in game for save/load
    this.game.playerPosition = { x: this.player.gridX, y: this.player.gridY };
    const npc = this.npcInteraction.checkInteraction();
    if (npc && npc.dialog.length > 0) {
      const lines = resolveNPCDialog(npc.dialog, (flag) => this.game.gameFlags.has(flag));
      if (lines.length > 0) {
        // Store NPC for post-dialog action (shop, class upgrade, etc.)
        if (npc.shopId || npc.action) {
          this.pendingNpcAction = npc;
        }
        this.dialogManager.start(lines);
        return;
      }
    }
    if (wasMoving && !this.player.isMoving) {
      // Check key item gates at new position
      const gateResult = this.keyItemGateSystem.check(this.player.gridX, this.player.gridY);
      if (gateResult.blocked) {
        // Revert to previous position by stepping back
        this.dialogManager.start([gateResult.message ?? 'The way is blocked.']);
        return;
      }

      const transition = this.mapTransition.getTransitionAt(this.player.gridX, this.player.gridY);
      if (transition) {
        // Check if transition requires a story flag
        if (transition.requiredFlag && !this.game.gameFlags.has(transition.requiredFlag)) {
          // Blocked — don't transition
        } else {
          this.executeTransition(transition);
          return;
        }
      }
      // Check for scripted encounters at new position
      const encounter = this.getScriptedEncounterAt(this.player.gridX, this.player.gridY);
      if (encounter) {
        this.triggerScriptedEncounter(encounter);
        return;
      }
    }
    this.camera.update();
  }

  /** Handle NPC post-dialog actions (shop, class upgrade) */
  private handleNpcPostDialog(npc: NPC): void {
    if (npc.action === 'classUpgrade') {
      const messages = upgradeParty(
        [...this.game.party.all],
        this.game.gameFlags,
        ClassRegistry.getAllClasses(),
      );
      if (messages.length > 0) {
        this.dialogManager.start(messages);
      } else {
        this.dialogManager.start(['You are not yet ready for this.']);
      }
      return;
    }
    if (npc.shopId) {
      this.openShopForNPC(npc.shopId);
    }
  }

  /** Open the appropriate shop scene for a given shopId */
  private openShopForNPC(shopId: string): void {
    const shopData = ShopRegistry.getShop(shopId);
    if (!shopData) return;

    const tempName = `_shop_${shopId}`;
    if (shopData.type === 'inn') {
      this.game.scenes.register(tempName, new InnScene(this.game, shopData));
    } else if (shopData.type === 'magic') {
      this.game.scenes.register(tempName, new MagicShopScene(this.game, shopId));
    } else {
      this.game.scenes.register(tempName, new ShopScene(this.game, shopId));
    }
    this.game.scenes.push(tempName);
  }

  private async executeTransition(transition: { targetMap: string; targetX: number; targetY: number }): Promise<void> {
    // Disembark vehicle on map transition — return to walking
    if (this.player && this.player.currentMode.id !== 'walking') {
      this.player.currentMode = this.walkingMode;
    }
    await this.loadMap(transition.targetMap);
    if (this.player) {
      this.player.setPosition(transition.targetX, transition.targetY);
      this.camera.update();
    }
  }

  /** Find a scripted encounter at the given tile, checking flag prerequisites */
  private getScriptedEncounterAt(x: number, y: number): ScriptedEncounter | null {
    const encounters = this.currentMapData?.scriptedEncounters;
    if (!encounters) return null;
    for (const enc of encounters) {
      if (enc.x !== x || enc.y !== y) continue;
      // Already completed (one-time)
      if (this.game.gameFlags.has(enc.flag)) continue;
      // Check prerequisite flag
      if (enc.requiredFlag && !this.game.gameFlags.has(enc.requiredFlag)) continue;
      return enc;
    }
    return null;
  }

  /** Trigger a scripted encounter: show message, then start battle */
  private triggerScriptedEncounter(encounter: ScriptedEncounter): void {
    const startBattle = () => {
      this.battleTrigger.triggerBattle(encounter.enemyIds, {
        canRun: !encounter.isBoss,
        flag: encounter.flag,
        isBoss: encounter.isBoss,
        postVictoryCutscene: encounter.postVictoryCutscene,
      });
    };

    if (encounter.message) {
      this.dialogManager.start([encounter.message]);
      // Wait for dialog to finish, then trigger battle
      const origAdvance = this.dialogManager.advance.bind(this.dialogManager);
      const self = this;
      this.dialogManager.advance = function () {
        origAdvance();
        if (!self.dialogManager.isActive) {
          // Restore original advance
          self.dialogManager.advance = origAdvance;
          startBattle();
        }
      };
    } else {
      startBattle();
    }
  }

  exit(): void {
    this.encounterSystem.stop();
    this.game.events.off('battleEnd', this.handleBattleEnd);
    this.game.events.off('showDialog', this.handleShowDialog);
    this.worldContainer.removeChildren();
  }

  onPause(): void {
    this.paused = true;
    this.encounterSystem.stop();
  }

  onResume(): void {
    this.paused = false;
    this.encounterSystem.start();
    // Cleanup temp shop scenes on resume
    this.cleanupTempScenes();
  }

  /** Remove temporary shop scenes registered during NPC interaction */
  private cleanupTempScenes(): void {
    // Temp scenes are prefixed with _shop_
    // SceneManager.unregister is safe to call even if not registered
    if (this.currentMapData?.npcs) {
      for (const npc of this.currentMapData.npcs) {
        if (npc.shopId) {
          this.game.scenes.unregister(`_shop_${npc.shopId}`);
        }
      }
    }
  }

  setPlayerPosition(x: number, y: number): void {
    this.player?.setPosition(x, y);
  }

  getMapId(): string {
    return this.currentMapId;
  }

  canSave(): boolean {
    return this.currentMapData?.canSave ?? true;
  }
}
