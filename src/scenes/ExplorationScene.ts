import { Container } from 'pixi.js';
import { battleBackgroundPath } from '../rendering/BattleBackground.js';
import type { MapData, Scene, ScriptedEncounter } from '../types/index.js';
import { resolveNPCDialog, TerrainType } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Camera } from '../rendering/Camera.js';
import { PlayerController } from '../entities/PlayerController.js';
import { MapTransitionSystem, arrivalFor, entrancePosition, safeSpawn } from '../systems/MapTransition.js';
import type { MapTransition as MapTransitionData } from '../types/index.js';
import { NPCInteractionSystem } from '../systems/NPCInteraction.js';
import { EncounterSystem } from '../systems/EncounterSystem.js';
import { DialogBox } from '../ui/DialogBox.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { PlaceholderTextures } from '../rendering/PlaceholderTextures.js';
import { battleArt } from '../rendering/BattleArt.js';
import { MapLoader } from '../systems/MapLoader.js';
import { DialogManager } from '../systems/DialogManager.js';
import { BattleTrigger, type BattleEndData } from '../systems/BattleTrigger.js';
import { KeyItemGateSystem } from '../systems/KeyItemGateSystem.js';
import { VehicleManager } from '../systems/VehicleManager.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { upgradeParty } from '../systems/ClassUpgradeSystem.js';
import { WalkingMode } from '../entities/WalkingMode.js';
import type { MovementMode } from '../entities/MovementMode.js';
import type { NPC } from '../entities/NPC.js';
import { FieldHUD } from '../ui/FieldHUD.js';
import { ControlsHint } from '../ui/ControlsHint.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { FadeOverlay } from '../rendering/FadeOverlay.js';
import { BattleFlashEffect } from './exploration/BattleFlashEffect.js';
import { inspectAt } from './exploration/FieldInspect.js';
import { createFieldStateSystems, openShopScene } from './exploration/FieldSystems.js';
import { playFieldCutscene, npcCutsceneDue, npcsToRemove } from './exploration/ExplorationCutscenes.js';
import { noWanderTiles, updateWanderers } from './exploration/NpcWander.js';
import { encounterStepFilter } from './exploration/FieldTiles.js';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../core/LayoutConstants.js';

export class ExplorationScene implements Scene {
  readonly container = new Container();
  private game: Game;
  private worldContainer = new Container();
  private uiContainer = new Container();
  private camera: Camera;
  private tilemap: import('../rendering/MapRenderer.js').MapRenderer | null = null;
  private player: PlayerController | null = null;
  private mapTransition: MapTransitionSystem;
  private npcInteraction: NPCInteractionSystem;
  private encounterSystem: EncounterSystem;
  private errorDisplay: ErrorDisplay;
  private placeholders: PlaceholderTextures;
  private currentMapId: string = '';
  private battleBackgrounds: MapData['battleBackgrounds'];
  private currentMapData: import('../types/index.js').MapData | null = null;
  /** A field cutscene is playing: the player can't move, talk, open the menu or meet monsters. */
  private cutsceneRunning = false;
  private mapLoader: MapLoader;
  private dialogManager: DialogManager;
  private battleTrigger: BattleTrigger;
  private paused = false;
  private keyItemGateSystem!: KeyItemGateSystem;
  /** Where the current step began (a blocked key-item gate sends the player back here). */
  private stepOrigin = { x: 0, y: 0 };
  private vehicleManager!: VehicleManager;
  private walkingMode: MovementMode = new WalkingMode();
  /** NPC in conversation (faces the heroes until the dialog closes). */
  private talkingNpc: NPC | null = null;
  private pendingNpcAction: NPC | null = null;
  private fieldHUD: FieldHUD;
  private controlsHint: ControlsHint;
  private battleFlash = new BattleFlashEffect(this.container);
  private fadeOverlay: FadeOverlay;
  private npcs: NPC[] = [];
  private collisionMap: import('../rendering/CollisionMap.js').CollisionMap | null = null;
  /** Tiles wandering NPCs never enter on this map (doors, warps, gates, entrances, the map's noWander list). */
  private wanderForbidden: ReadonlySet<string> = new Set();
  // Stored reference for cleanup in exit() to prevent listener leaks
  private handleBattleEnd = (data: BattleEndData) => this.battleTrigger.onBattleEnd(data);
  private handleShowDialog = (data: { text: string; onComplete: () => void }) => {
    this.dialogManager.enqueue([data.text], data.onComplete);
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
    this.battleTrigger.setCutscenePlayer((id) => this.playCutscene(id));
    this.battleTrigger.setOnBattleTriggered(() => {
      this.encounterSystem.stop();
      this.battleFlash.start();
    });
    this.bindGameState();
    this.container.addChild(this.worldContainer);
    this.container.addChild(this.uiContainer);
    this.fieldHUD = new FieldHUD(game.party);
    this.container.addChild(this.fieldHUD.container);
    this.controlsHint = new ControlsHint();
    this.container.addChild(this.controlsHint.container);
    this.fadeOverlay = new FadeOverlay();
    this.container.addChild(this.fadeOverlay.overlay);
    // Dialog must be ABOVE fade overlay so cutscene dialog is visible on black screen
    this.container.addChild(dialogBox);
    this.uiContainer.addChild(this.errorDisplay.container);
    this.encounterSystem.setOnEncounter((enemies) => this.battleTrigger.triggerBattle(enemies, undefined, this.battleBackground()));
  }

  /**
   * Systems that hold the game's inventory and flags. Game.restoreState / resetState replace those objects (load,
   * retry, new game), so these are rebuilt on every enter, before loadMap hands them the map's gates and vehicles.
   */
  private bindGameState(): void {
    ({ gates: this.keyItemGateSystem, vehicles: this.vehicleManager } = createFieldStateSystems(this.game));
  }

  /**
   * The scene is created once and reused, so every enter starts it fresh: it may come back from a switchTo while it was
   * still paused and hidden under a battle (Game Over > Load / Retry, Field > Load), with a dialog or flash left over.
   */
  private resetForEnter(): void {
    this.paused = false;
    this.container.visible = true;
    // black until the map is loaded; fadeInOnEnter reveals it
    this.fadeOverlay.overlay.alpha = 1;
    this.cutsceneRunning = false;
    this.battleFlash.finish();
    this.dialogManager.clear();
    this.talkingNpc = null;
    this.pendingNpcAction = null;
    this.game.events.off('battleEnd', this.handleBattleEnd);
    this.game.events.off('showDialog', this.handleShowDialog);
    this.game.events.on('battleEnd', this.handleBattleEnd);
    this.game.events.on('showDialog', this.handleShowDialog);
    this.bindGameState();
  }

  async enter(): Promise<void> {
    this.resetForEnter();
    await this.placeholders.loadArt();
    await battleArt.load();
    this.encounterSystem.start();
    // the saved / retried / scenario map, or a new game: Cornelia's south gate
    const mapId = this.game.currentMapId || 'cornelia';
    const entrance = this.game.currentMapId ? this.game.pendingEntrance : 'south_gate';
    this.game.pendingEntrance = null;
    await this.loadMap(mapId);
    if (this.currentMapData) {
      const map = this.currentMapData;
      const hasEntrance = entrance !== null && map.entrances?.[entrance] !== undefined;
      if (entrance !== null && !hasEntrance) console.warn(`map ${map.id} has no entrance '${entrance}'; using the saved position`);
      const pos = hasEntrance ? entrancePosition(map, entrance) : safeSpawn(map, this.game.playerPosition);
      this.player?.setPosition(pos.x, pos.y);
      this.game.playerPosition = { x: pos.x, y: pos.y };
      this.camera.update();
      this.tilemap?.render();
    }
    this.fadeInOnEnter();
    // Game Over > Retry Battle: the same fight again, from where it started
    const retry = this.game.pendingBattle;
    this.game.pendingBattle = null;
    if (retry && this.currentMapData) {
      this.battleTrigger.triggerBattle(retry.enemyIds, retry.bossConfig, retry.background, retry.enemyAi)
        .catch((e) => console.error('Retry battle failed to start:', e));
    }
  }

  /** Every arrival in the field (new game, load, retry) fades in from black. */
  private fadeInOnEnter(): void {
    if (typeof requestAnimationFrame === 'undefined') {
      this.fadeOverlay.overlay.alpha = 0;
      return;
    }
    this.fadeOverlay.overlay.alpha = 1;
    this.fadeOverlay.fadeIn(400).catch((e) => console.error('Fade-in failed:', e));
  }

  /** Play a field cutscene with the player frozen; afterwards NPCs that the new flags remove leave the map. */
  async playCutscene(id: string): Promise<void> {
    this.cutsceneRunning = true;
    try {
      await playFieldCutscene(id, {
        dialog: this.dialogManager,
        fadeOut: (ms) => this.fadeOverlay.fadeOut(ms),
        fadeIn: (ms) => this.fadeOverlay.fadeIn(ms),
        flags: this.game.gameFlags,
        party: this.game.party.all,
        onFlagSet: () => this.refreshNpcPresence(),
      });
    } finally {
      this.cutsceneRunning = false;
      this.refreshNpcPresence();
    }
  }

  /** Drop NPCs whose showIf / hideIf no longer pass (e.g. Garland and the captive princess after the battle). */
  private refreshNpcPresence(): void {
    if (!this.currentMapData) return;
    const gone = npcsToRemove(this.npcs, this.currentMapData.npcs, (f) => this.game.gameFlags.has(f));
    if (gone.length === 0) return;
    for (const npc of gone) npc.sprite.parent?.removeChild(npc.sprite);
    this.npcs = this.npcs.filter((n) => !gone.includes(n));
    this.npcInteraction.setNPCs(this.npcs);
    this.player?.setNPCPositions(this.npcs.map(n => ({ x: n.tileX, y: n.tileY })));
  }

  async loadMap(mapId: string): Promise<void> {
    this.worldContainer.removeChildren();
    this.errorDisplay.hide();
    this.currentMapId = mapId;
    this.game.currentMapId = mapId;
    let result;
    try {
      result = await this.mapLoader.loadMap(mapId, (flag) => this.game.gameFlags.has(flag));
    } catch (e) {
      console.error(`Failed to load map: ${mapId}`, e);
      this.errorDisplay.show(`Failed to load map: ${mapId}`);
      return;
    }
    const { mapData, tilemap, collisionMap, npcs } = result;
    this.currentMapData = mapData;
    this.npcs = npcs;
    this.collisionMap = collisionMap;
    this.battleBackgrounds = mapData.battleBackgrounds;
    this.wanderForbidden = noWanderTiles(mapData, (x, y) => collisionMap.isWalkable(x, y, this.walkingMode));
    this.playMapMusic();
    // no random battle on a warp, gate or scripted-battle tile (EB-2)
    this.encounterSystem.setStepFilter(encounterStepFilter(mapData));
    if (mapData.encounterRate) this.encounterSystem.setRate(mapData.encounterRate);
    // a map without an encounter table has no random battles (towns, castles, interiors); never keep the last map's
    this.encounterSystem.setEncounters(mapData.encounters ?? []);
    this.worldContainer.sortableChildren = true;
    this.worldContainer.addChild(tilemap.container);
    if (tilemap.aboveContainer) this.worldContainer.addChild(tilemap.aboveContainer);
    this.camera.setMapBounds(mapData.width, mapData.height);
    tilemap.setCamera(this.camera);
    this.tilemap = tilemap;
    const spawnX = mapData.width > 1 ? 1 : 0;
    const spawnY = mapData.height > 1 ? 1 : 0;
    const leaderArt = this.placeholders.getPlayerArt(this.game.party.get(0)?.classData.id ?? 'warrior');
    this.player = new PlayerController({
      startX: spawnX, startY: spawnY,
      texture: leaderArt?.texture ?? this.placeholders.getPlayerTexture(),
      animation: leaderArt?.animation,
      displayScale: leaderArt?.displayScale,
      collisionMap, input: this.game.input, events: this.game.events,
    });
    this.worldContainer.addChild(this.player.animation.sprite);
    this.camera.follow(this.player);
    for (const npc of npcs) this.worldContainer.addChild(npc.sprite);
    this.player.setNPCPositions(npcs.map(n => ({ x: n.tileX, y: n.tileY })));
    this.npcInteraction.setNPCs(npcs);
    this.npcInteraction.setPlayer(this.player);
    this.npcInteraction.setCounterCheck((x, y) => collisionMap.isCounter(x, y));
    this.npcInteraction.setInspectCheck((x, y) => inspectAt(mapData, x, y, (f) => this.game.gameFlags.has(f)));
    this.npcInteraction.setInput(this.game.input);
    this.mapTransition.setTransitions(mapData.transitions);
    // Wire key item gates
    this.keyItemGateSystem.setGates(mapData.keyItemGates ?? []);
    // Wire vehicle spawns
    this.vehicleManager.setSpawns(mapData.vehicles ?? []);
    this.camera.update();
    tilemap.render();
    // B5: Update HUD with map name and gold
    this.fieldHUD.setMapName(mapData.name ?? mapData.id);
    this.fieldHUD.setGold(this.game.party.gold);
  }

  update(dt: number): void {
    if (this.paused) return;
    // C5: Battle flash animation
    if (this.battleFlash.active) {
      this.battleFlash.update();
      return;
    }
    // C1: Controls hint overlay
    if (!this.controlsHint.isDismissed) {
      this.controlsHint.update(this.game.input);
      return;
    }
    // B5: Update HUD each frame
    this.fieldHUD.update(this.game.party);
    if (this.dialogManager.isActive) {
      this.fieldHUD.container.visible = false;
      this.dialogManager.update(dt, this.game.input);
      return;
    }
    if (this.cutsceneRunning) return;
    this.fieldHUD.container.visible = true;
    // the conversation box was dismissed: the NPC may turn back
    if (this.talkingNpc) {
      this.talkingNpc.endTalk();
      this.talkingNpc = null;
    }
    // Handle pending NPC actions after dialog completes
    if (this.pendingNpcAction) {
      this.handleNpcPostDialog(this.pendingNpcAction);
      this.pendingNpcAction = null;
      return;
    }
    if (this.game.input.isJustPressed('cancel')) {
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
    if (!wasMoving) this.stepOrigin = { x: this.player.gridX, y: this.player.gridY };
    this.player.update(dt);
    // Wandering NPCs: near home, on foot-walkable ground, off doors and warps, still while the player is beside them
    const collision = this.collisionMap;
    updateWanderers(this.npcs, dt, {
      isWalkable: (x, y) => collision?.isWalkable(x, y, this.walkingMode) ?? false,
      forbidden: this.wanderForbidden,
      playerTiles: [{ x: this.player.gridX, y: this.player.gridY }, this.player.targetTile],
    });
    this.player.setNPCPositions(this.npcs.map(n => ({ x: n.tileX, y: n.tileY })));
    // Track player position in game for save/load
    this.game.playerPosition = { x: this.player.gridX, y: this.player.gridY };
    const hit = this.npcInteraction.interact();
    if (hit?.kind === 'inspect') {
      this.dialogManager.start(hit.lines);
      return;
    }
    const npc = hit?.npc ?? null;
    if (npc) {
      // the NPC turns to face the heroes and keeps facing them until the conversation box is dismissed
      npc.faceToward(this.player.gridX, this.player.gridY);
      this.talkingNpc = npc;
      // C2: Chest interaction — add item to inventory, set flag
      if (npc.chestItem && npc.chestFlag) {
        if (this.game.gameFlags.has(npc.chestFlag)) {
          this.dialogManager.start(['Already opened.']);
        } else {
          this.game.inventory.add(npc.chestItem, 1);
          this.game.gameFlags.set(npc.chestFlag);
          const item = ItemRegistry.getItem(npc.chestItem);
          const name = item?.name ?? npc.chestItem;
          this.dialogManager.start([`Found ${name}!`]);
        }
        return;
      }
      if (npc.dialog.length > 0) {
        const lines = [...resolveNPCDialog(npc.dialog, (flag) => this.game.gameFlags.has(flag))];
        if (npc.giftItem && npc.giftFlag && !this.game.gameFlags.has(npc.giftFlag)) {
          this.game.inventory.add(npc.giftItem, 1);
          this.game.gameFlags.set(npc.giftFlag);
          lines.push(`Received ${ItemRegistry.getItem(npc.giftItem)?.name ?? npc.giftItem}!`);
        }
        if (lines.length > 0) {
          // Store NPC for post-dialog action (shop, class upgrade, etc.)
          if (npc.shopId || npc.action || npcCutsceneDue(npc, (f) => this.game.gameFlags.has(f))) {
            this.pendingNpcAction = npc;
          }
          this.dialogManager.start(lines);
          return;
        }
      }
    }
    if (wasMoving && !this.player.isMoving) {
      // Check key item gates at new position
      const gateResult = this.keyItemGateSystem.check(this.player.gridX, this.player.gridY);
      if (gateResult.blocked) {
        // the gate cell cannot be entered: step back to where the move started
        this.player.setPosition(this.stepOrigin.x, this.stepOrigin.y);
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
    this.tilemap?.render();
  }

  /** Handle NPC post-dialog actions (shop, class upgrade) */
  private handleNpcPostDialog(npc: NPC): void {
    const cutscene = npcCutsceneDue(npc, (f) => this.game.gameFlags.has(f));
    if (cutscene) {
      this.playCutscene(cutscene).catch((e) => console.error(`Cutscene ${cutscene} failed:`, e));
      return;
    }
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
      openShopScene(this.game, npc.shopId);
    }
  }

  private async executeTransition(transition: MapTransitionData): Promise<void> {
    // Disembark vehicle on map transition — return to walking
    if (this.player && this.player.currentMode.id !== 'walking') {
      this.player.currentMode = this.walkingMode;
    }

    const isShopInterior = transition.targetMap.startsWith('cornelia-');

    if (isShopInterior) {
      // Zoom-into-door effect for shop interiors
      await this.zoomTransition(transition.x, transition.y);
      await this.loadMap(transition.targetMap);
      if (this.player && this.currentMapData) {
        const at = arrivalFor(transition, this.currentMapData);
        this.player.setPosition(at.x, at.y);
        this.camera.update();
        this.tilemap?.render();
      }
      await this.fadeOverlay.fadeIn(300);
    } else {
      // D3: Fade out → load map → fade in
      await this.fadeOverlay.fadeOut(300);
      await this.loadMap(transition.targetMap);
      if (this.player && this.currentMapData) {
        const at = arrivalFor(transition, this.currentMapData);
        this.player.setPosition(at.x, at.y);
        this.camera.update();
        this.tilemap?.render();
      }
      await this.fadeOverlay.fadeIn(300);
    }
  }

  /** Zoom-into-door animation: scale up worldContainer toward the door tile while fading out */
  private async zoomTransition(doorTileX: number, doorTileY: number): Promise<void> {
    this.paused = true;
    const wc = this.worldContainer;
    // Calculate the screen-center point to zoom toward (door pixel position)
    const centerX = -wc.x + GAME_WIDTH / 2;
    const centerY = -wc.y + GAME_HEIGHT / 2;
    const doorX = doorTileX * TILE_SIZE + TILE_SIZE / 2;
    const doorY = doorTileY * TILE_SIZE + TILE_SIZE / 2;
    // Use midpoint between camera center and door as zoom focus
    const focusX = (centerX + doorX) / 2;
    const focusY = (centerY + doorY) / 2;
    const origX = wc.x;
    const origY = wc.y;
    // Set pivot to focus point; adjust position to compensate
    wc.pivot.set(focusX, focusY);
    wc.position.set(origX + focusX, origY + focusY);

    const frames = 24;
    for (let i = 1; i <= frames; i++) {
      const t = i / frames;
      wc.scale.set(1 + t);
      wc.alpha = 1 - t;
      await new Promise<void>(r => requestAnimationFrame(() => r()));
    }

    // Reset worldContainer transforms
    wc.scale.set(1);
    wc.alpha = 1;
    wc.pivot.set(0, 0);
    wc.position.set(origX, origY);
    // Set fade overlay to black (as if fadeOut completed)
    this.fadeOverlay.overlay.alpha = 1;
    this.paused = false;
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

  /** Backdrop for a battle here: per-terrain override from the map data, else the map default. */
  private battleBackground(): string | undefined {
    const cfg = this.battleBackgrounds;
    if (!cfg) return undefined;
    let id = cfg.default;
    if (this.collisionMap && this.player && cfg.terrain) {
      const terrain = TerrainType[this.collisionMap.getTerrainType(this.player.gridX, this.player.gridY)];
      id = (terrain && cfg.terrain[terrain.toLowerCase()]) || id;
    }
    return id ? battleBackgroundPath(id) : undefined;
  }

  /** Trigger a scripted encounter: show message, then start battle */
  private triggerScriptedEncounter(encounter: ScriptedEncounter): void {
    const startBattle = () => {
      this.battleTrigger.triggerBattle(encounter.enemyIds, {
        canRun: !encounter.isBoss,
        flag: encounter.flag,
        isBoss: encounter.isBoss,
        postVictoryCutscene: encounter.postVictoryCutscene,
      }, this.battleBackground());
    };

    if (encounter.message) {
      this.dialogManager.start([encounter.message], startBattle);
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

  /** The current map's track (overworld when it names none); playMusic keeps a track that is already playing. */
  private playMapMusic(): void {
    const track = this.currentMapData?.music ?? 'overworld';
    this.game.audio.playMusic(track).catch((e) => console.error(`Music ${track} failed:`, e));
  }

  onResume(): void {
    this.paused = false;
    this.encounterSystem.start();
    // back from a battle (battle / victory music) or a menu: the map's own track again
    this.playMapMusic();
    this.refreshNpcPresence();
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
