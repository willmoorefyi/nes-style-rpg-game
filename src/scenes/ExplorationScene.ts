import { Container } from 'pixi.js';
import { battleBackgroundPath } from '../rendering/BattleBackground.js';
import { battleBackdropId } from './exploration/BattleBackdrop.js';
import type { MapData, MapNPC, Scene, ScriptedEncounter } from '../types/index.js';
import { TerrainType, npcPresent } from '../types/index.js';
import type { Game } from '../core/Game.js';
import { Camera } from '../rendering/Camera.js';
import type { PlayerController } from '../entities/PlayerController.js';
import { MapTransitionSystem, entrancePosition, restoredSpawn } from '../systems/MapTransition.js';
import { NPCInteractionSystem } from '../systems/NPCInteraction.js';
import { EncounterSystem } from '../systems/EncounterSystem.js';
import { DialogBox } from '../ui/DialogBox.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { PlaceholderTextures } from '../rendering/PlaceholderTextures.js';
import { battleArt } from '../rendering/BattleArt.js';
import { MapLoader } from '../systems/MapLoader.js';
import { DialogManager, DIALOG_CLOSE_HOLDOFF_FRAMES } from '../systems/DialogManager.js';
import { BattleTrigger, type BattleEndData } from '../systems/BattleTrigger.js';
import { fieldStep, modeAfterStep } from '../systems/fieldRules.js';
import { WalkingMode } from '../entities/WalkingMode.js';
import type { MovementMode } from '../entities/MovementMode.js';
import type { NPC } from '../entities/NPC.js';
import { FieldHUD, HUD_BOTTOM_BAND } from '../ui/FieldHUD.js';
import { FieldTransition } from './exploration/FieldTransition.js';
import { applyPendingFacing, createFieldPlayer, leaderClassId, recordPlayer, type FieldPlayer } from './exploration/FieldPlayer.js';
import { ControlsHint } from '../ui/ControlsHint.js';
import { FadeOverlay } from '../rendering/FadeOverlay.js';
import { EndCard } from './exploration/EndCard.js';
import { BattleFlashEffect } from './exploration/BattleFlashEffect.js';
import { inspectAt } from './exploration/FieldInspect.js';
import { FieldVehicles, fieldModeOf } from './exploration/FieldVehicles.js';
import { FieldNpcActions } from './exploration/FieldNpcActions.js';
import { FieldAmbient } from './exploration/FieldAmbient.js';
import { hazardStep } from './exploration/FieldHazard.js';
import { playFieldCutscene } from './exploration/ExplorationCutscenes.js';
import { npcPresenceChanges } from './exploration/NpcPresence.js';
import { noWanderTiles, updateWanderers } from './exploration/NpcWander.js';
import { encounterStepFilter } from './exploration/FieldTiles.js';
import { FlightView } from './exploration/mode7/FlightView.js';

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
  /** enter() is still loading the map (S1). */
  private loading = false;
  /** The class whose art the field sprite wears (E10). */
  private leaderClassId = '';
  private mapLoader: MapLoader;
  private dialogManager: DialogManager;
  private battleTrigger: BattleTrigger;
  private paused = false;
  /** Where the current step began (a blocked key-item gate sends the player back here). */
  private stepOrigin = { x: 0, y: 0 };
  private vehicles: FieldVehicles;
  private ambient = new FieldAmbient(); // the volcano's smoke (LM-INT)
  private npcActions: FieldNpcActions;
  private flight: FlightView; // the Mode 7 airship view (docs/MODE7_PLAN.md)
  private walkingMode: MovementMode = new WalkingMode();
  /** NPC in conversation (faces the heroes until the dialog closes). */
  private talkingNpc: NPC | null = null;
  private fieldHUD: FieldHUD;
  private controlsHint: ControlsHint;
  private battleFlash = new BattleFlashEffect(this.container);
  private fadeOverlay: FadeOverlay;
  private endCard = new EndCard();
  private fieldTransition: FieldTransition;
  private npcs: NPC[] = [];
  /** Every NPC def of the map (flag-hidden ones too) and which of the flagged ones were present at the last refresh. */
  private npcDefs: MapNPC[] = [];
  private npcSignature = '';
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
    this.dialogManager = new DialogManager(dialogBox, { closeHoldOffFrames: DIALOG_CLOSE_HOLDOFF_FRAMES });
    this.mapLoader = new MapLoader(game.data, this.placeholders);
    this.vehicles = new FieldVehicles(game, this.worldContainer);
    this.npcActions = new FieldNpcActions({ game, dialog: this.dialogManager, map: () => this.currentMapData,
      playCutscene: (id) => this.playCutscene(id), startEncounter: (e) => this.triggerScriptedEncounter(e) });
    this.battleTrigger = new BattleTrigger(game);
    this.battleTrigger.setCutscenePlayer((id) => this.playCutscene(id));
    this.battleTrigger.setOnBattleTriggered(() => {
      this.encounterSystem.stop();
      this.battleFlash.start();
    });
    this.bindGameState();
    this.container.addChild(this.worldContainer);
    this.flight = new FlightView({ game, world: this.worldContainer, parent: this.container, at: 1, player: () => this.player, tilemap: () => this.tilemap, camera: this.camera, vehicles: this.vehicles });
    this.container.addChild(this.uiContainer);
    this.fieldHUD = new FieldHUD(game.party);
    this.container.addChild(this.fieldHUD.container);
    this.controlsHint = new ControlsHint();
    this.container.addChild(this.controlsHint.container);
    this.fadeOverlay = new FadeOverlay();
    this.container.addChild(this.fadeOverlay.overlay);
    this.container.addChild(this.endCard.container);
    // Dialog must be ABOVE fade overlay so cutscene dialog is visible on black screen
    this.container.addChild(dialogBox);
    this.uiContainer.addChild(this.errorDisplay.container);
    // M12: rooms scroll and centre above the HUD's party strip, so the hero and the exits stay visible
    this.camera.setViewInsets({ bottom: HUD_BOTTOM_BAND });
    this.fieldTransition = new FieldTransition({
      world: this.worldContainer, fade: this.fadeOverlay, walkingMode: this.walkingMode, encounters: this.encounterSystem,
      player: () => this.player, mapData: () => this.currentMapData, loadMap: (id) => this.loadMap(id),
      setPaused: (p) => { this.paused = p; }, redraw: () => this.redraw(),
      viewReady: () => (this.tilemap as { ready?(): Promise<void> } | null)?.ready?.() ?? Promise.resolve(),
    });
    this.encounterSystem.setOnEncounter((enemies) => this.battleTrigger.triggerBattle(enemies, undefined, this.battleBackground()));
  }

  /** Game.restoreState / resetState replace the flags (load, retry, new game): the vehicles rebind on every enter. */
  private bindGameState(): void {
    this.vehicles.rebind();
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
    // S1: no update until enter() has placed the player; the last map's hero must not write its tile meanwhile
    this.loading = true;
    this.player = null;
    this.battleFlash.finish();
    this.dialogManager.clear();
    this.talkingNpc = null;
    this.npcActions.clear();
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
    // W4: a new game, load or retry rolls a fresh countdown (map changes only clamp it)
    this.encounterSystem.restart();
    if (this.currentMapData) {
      const map = this.currentMapData;
      const hasEntrance = entrance !== null && map.entrances?.[entrance] !== undefined;
      if (entrance !== null && !hasEntrance) console.warn(`map ${map.id} has no entrance '${entrance}'; using the saved position`);
      const pos = hasEntrance ? entrancePosition(map, entrance) : restoredSpawn(map, this.game); // mode, a1 (W1-A)
      this.player?.setPosition(pos.x, pos.y);
      applyPendingFacing(this.game, this.player); // Retry / Return to Field: facing as when the battle began
      this.redraw();
    }
    this.loading = false;
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
        warp: (w) => this.fieldTransition.warp(w),
        onHeal: () => this.game.events.emit('partyHealed', {}),
        inventory: this.game.inventory, showCard: (t) => this.endCard.show(t), endGame: () => this.game.scenes.switchTo('title'), // W1-B (GAP-13)
        setVehicle: (v) => this.vehicles.setVehicle(v), // W1-A
      });
    } finally {
      this.cutsceneRunning = false;
      this.refreshNpcPresence();
      // a step that threw (e.g. a failed warp) must not leave the field behind the black fade
      if (this.fadeOverlay.overlay.alpha > 0) this.fadeInOnEnter();
    }
  }

  /** The ids of the NPCs on the map now (tests, the browser check). */
  get npcIds(): string[] {
    return this.npcs.map((n) => n.id);
  }

  /** How black the field fade is (0 = clear, 1 = black); for tests and debugging. */
  get fadeAlpha(): number {
    return this.fadeOverlay.overlay.alpha;
  }

  /** NPCs follow their showIf / hideIf as flags change: those no longer passing leave, those now passing appear (P3-03). */
  private refreshNpcPresence(): void {
    const map = this.currentMapData;
    if (!map) return;
    const hasFlag = (f: string): boolean => this.game.gameFlags.has(f);
    const signature = this.npcDefs.map((d) => (d.showIf || d.hideIf ? (npcPresent(d, hasFlag) ? '1' : '0') : '')).join('');
    if (signature === this.npcSignature) return; // no flagged NPC changed since the last refresh
    const { gone, appear } = npcPresenceChanges(this.npcs, this.npcDefs, hasFlag);
    // never drop one onto the hero's cell (or the cell about to be entered): it appears a frame later
    const free = appear.filter((d) => !this.player || ![{ x: this.player.gridX, y: this.player.gridY }, this.player.targetTile]
      .some((c) => c.x === d.x && c.y === d.y));
    if (free.length === appear.length) this.npcSignature = signature;
    if (gone.length === 0 && free.length === 0) return;
    for (const npc of gone) npc.sprite.parent?.removeChild(npc.sprite);
    const added = free.map((d) => this.mapLoader.createNpc(d, hasFlag));
    for (const npc of added) this.worldContainer.addChild(npc.sprite);
    this.npcs = [...this.npcs.filter((n) => !gone.includes(n)), ...added];
    map.npcs = this.npcDefs.filter((d) => npcPresent(d, hasFlag)); // the field rules read the present NPCs
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
    this.npcDefs = result.npcDefs ?? mapData.npcs;
    this.npcSignature = '';
    this.collisionMap = collisionMap;
    this.battleBackgrounds = mapData.battleBackgrounds;
    this.wanderForbidden = noWanderTiles(mapData, (x, y) => collisionMap.isWalkable(x, y, this.walkingMode));
    this.playMapMusic();
    // no random battle on a warp, gate or scripted-battle tile (EB-2)
    this.encounterSystem.setStepFilter(encounterStepFilter(mapData));
    // the zone of a step is the one of the mode it ends in (P2-01)
    this.encounterSystem.setStepModeResolver((x, y) => this.player && this.currentMapData
      ? modeAfterStep(this.currentMapData, this.stepOrigin, { x, y },
        this.vehicles.fieldState(fieldModeOf(this.player.currentMode)))
      : null);
    if (mapData.encounterRate) this.encounterSystem.setRate(mapData.encounterRate);
    // a map without an encounter table has no random battles (towns, castles, interiors); never keep the last map's
    this.encounterSystem.setEncounters(mapData.encounters ?? []);
    this.encounterSystem.setZones(mapData.encounterZones ?? []);
    this.worldContainer.sortableChildren = true;
    this.worldContainer.addChild(tilemap.container);
    if (tilemap.aboveContainer) this.worldContainer.addChild(tilemap.aboveContainer);
    this.camera.setMapBounds(mapData.width, mapData.height);
    tilemap.setCamera(this.camera);
    this.tilemap = tilemap;
    for (const npc of npcs) this.worldContainer.addChild(npc.sprite);
    this.npcInteraction.setNPCs(npcs);
    this.adoptPlayer(createFieldPlayer(this.game, this.placeholders, collisionMap, mapData.width > 1 ? 1 : 0, mapData.height > 1 ? 1 : 0));
    this.npcInteraction.setCounterCheck((x, y) => collisionMap.isCounter(x, y));
    this.npcInteraction.setInspectCheck((x, y) => inspectAt(mapData, x, y, (f) => this.game.gameFlags.has(f)));
    this.npcInteraction.setInput(this.game.input);
    this.mapTransition.setTransitions(mapData.transitions);
    this.vehicles.setMap(mapData);
    this.flight.setMap(mapData);
    this.ambient.setMap(mapData, this.worldContainer);
    this.camera.update();
    tilemap.render();
    // B5: Update HUD with map name and gold
    this.fieldHUD.setMapName(mapData.name ?? '');
    this.fieldHUD.setGold(this.game.party.gold);
  }

  /** Make `built` the field hero: its sprite in the world, followed by the camera, known to NPC interaction. */
  private adoptPlayer(built: FieldPlayer): void {
    if (this.player) this.worldContainer.removeChild(this.player.animation.sprite);
    this.player = built.player;
    this.leaderClassId = built.leaderClassId;
    this.worldContainer.addChild(built.player.animation.sprite);
    this.camera.follow(built.player);
    built.player.setNPCPositions(this.npcs.map(n => ({ x: n.tileX, y: n.tileY })));
    this.npcInteraction.setPlayer(built.player);
  }

  /** The party was reordered in the menu: the new leader's art at once, same tile, facing and mode (E10). */
  private refreshLeader(): void {
    const p = this.player;
    if (!p || !this.collisionMap || leaderClassId(this.game) === this.leaderClassId) return;
    this.adoptPlayer(createFieldPlayer(this.game, this.placeholders, this.collisionMap, p.gridX, p.gridY, p.direction, p.currentMode));
    this.redraw();
  }

  /** After the player was placed: the saved tile, the camera and the tilemap. */
  private redraw(): void {
    if (this.player) recordPlayer(this.game, this.player);
    this.camera.update();
    this.tilemap?.render();
  }

  /** Loading, changing maps or in a cutscene: no walking, talking, menu or monsters (S1, S2). */
  private get fieldBusy(): boolean {
    return this.loading || this.fieldTransition.active || this.cutsceneRunning || this.flight.busy;
  }

  update(dt: number): void {
    if (this.paused || this.loading) return;
    this.ambient.update(dt); // loops under dialogs and the battle flash too
    // C5: Battle flash animation
    if (this.battleFlash.active) {
      this.battleFlash.update();
      return;
    }
    // C1: the controls hint overlay. Any key (or 5 s) dismisses it, and the key still acts this frame: the hint used
    // to swallow the first press of a fresh browser, so the first confirm after a load never landed the airship (P3-R1)
    if (!this.controlsHint.isDismissed) this.controlsHint.update(this.game.input);
    if (this.endCard.active) { this.endCard.update(this.game.input); return; }
    // B5: Update HUD each frame
    this.fieldHUD.update(this.game.party);
    this.flight.update(dt);
    if (this.dialogManager.isActive) {
      this.fieldHUD.container.visible = false;
      this.dialogManager.update(dt, this.game.input);
      return;
    }
    if (this.fieldBusy) return;
    this.fieldHUD.container.visible = true;
    // the conversation box was dismissed: the NPC may turn back
    if (this.talkingNpc) {
      this.talkingNpc.endTalk();
      this.talkingNpc = null;
    }
    // Handle pending NPC actions after dialog completes
    if (this.npcActions.runPending()) return;
    if (this.game.input.isJustPressed('cancel')) {
      this.game.scenes.push('fieldMenu');
      return;
    }
    if (!this.player) return;

    this.refreshNpcPresence(); // a flag set anywhere (an NPC's gift, a step, a battle) shows or hides its NPCs (P3-03)
    // the movement mode's encounter rate times the Encounters boost (0 = Off); the Walk speed boost (src/core/Boosts.ts)
    this.encounterSystem.setRateMultiplier(this.player.encounterRateMultiplier * this.game.boosts.encounters);
    this.player.speedBoost = this.game.boosts.walkSpeed;
    this.encounterSystem.setMode(fieldModeOf(this.player.currentMode)); // zone `modes` (W1-B)
    // Check vehicle boarding on confirm key (when not moving)
    if (this.vehicles.tryBoard(this.player)) return;
    const bank = this.vehicles.bankHint(this.player); // a step onto River or Lake without a canoe (P3-11)
    if (bank) {
      this.dialogManager.start([bank]);
      return;
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
    recordPlayer(this.game, this.player);
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
      if (this.npcActions.talk(npc)) return;
    }
    if (wasMoving && !this.player.isMoving && this.currentMapData) {
      // the field rules decide the step just taken: a gate, a transition, a scripted encounter (fieldRules.fieldStep)
      const here = { x: this.player.gridX, y: this.player.gridY };
      const step = fieldStep(this.currentMapData, this.stepOrigin, here,
        this.vehicles.fieldState(fieldModeOf(this.player.currentMode)));
      for (const flag of step.setFlags) this.game.gameFlags.set(flag);
      if (!step.ok) {
        // the cell cannot be entered (a shut gate): step back to where the move started
        this.player.setPosition(this.stepOrigin.x, this.stepOrigin.y);
        recordPlayer(this.game, this.player); // game.playerPosition was the gate cell until the next step (WND-D1)
        if (step.message !== undefined) this.dialogManager.start([step.message]);
        return;
      }
      this.vehicles.afterStep(this.player, this.stepOrigin, step); // boarding, canoe, docks (W1-A)
      if (step.hazard) hazardStep(this.container, this.game.party.all, step.hazard); // lava, peat (W1-B)
      if (step.transition) {
        this.fieldTransition.run(step.transition).catch((e) => console.error('Map transition failed:', e));
        return;
      }
      if (step.encounter) {
        this.triggerScriptedEncounter(step.encounter);
        return;
      }
    }
    this.camera.update();
    this.tilemap?.render();
  }

  /** Backdrop for a battle here (see BattleBackdrop.ts). */
  private battleBackground(): string | undefined {
    const collision = this.collisionMap;
    const pos = this.player ? { x: this.player.gridX, y: this.player.gridY } : null;
    const terrainAt = (x: number, y: number): string | undefined =>
      collision ? TerrainType[collision.getTerrainType(x, y)] : undefined;
    const zoneId = pos ? this.encounterSystem.zoneAt(pos.x, pos.y)?.id ?? null : null;
    const id = battleBackdropId(this.battleBackgrounds, pos, terrainAt, zoneId);
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
    this.ambient.clear();
    this.flight.clear();
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
    // BA-13: the battle was pushed mid-flash; don't replay its last frames on the field
    this.battleFlash.finish();
    this.encounterSystem.start();
    // back from a battle (battle / victory music) or a menu: the map's own track again
    this.playMapMusic();
    this.refreshNpcPresence();
    this.refreshLeader();
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

  /** The current map's display name (the field menu's location line). */
  getMapName(): string {
    return this.currentMapData?.name ?? '';
  }

  canSave(): boolean {
    return this.currentMapData?.canSave ?? true;
  }

  /** Tents and Cabins work only where the map allows camping (MS-8). */
  canCamp(): boolean {
    return this.currentMapData?.camp ?? false;
  }
}
