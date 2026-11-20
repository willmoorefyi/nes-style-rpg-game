import { Application } from 'pixi.js';
import { isMutedByUrl } from './artPreview.js';
import { SceneManager } from './SceneManager.js';
import { AssetLoader } from './AssetLoader.js';
import { InputManager } from './InputManager.js';
import { EventBus } from './EventBus.js';
import { DataLoader } from './DataLoader.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { ShopRegistry } from '../data/ShopRegistry.js';
import { ClassRegistry } from '../data/ClassRegistry.js';
import { PartyManager } from '../entities/PartyManager.js';
import { Inventory } from '../entities/Inventory.js';
import { AudioManager, type AudioManifest } from './AudioManager.js';
import { GameFlags } from './GameFlags.js';
import { CutsceneRegistry } from '../systems/CutsceneRegistry.js';
import type { BattleRequest, BattleRetrySnapshot } from '../systems/BattleRetry.js';
import type { Direction } from '../rendering/SpriteAnimation.js';
import type { FieldMode, VehicleState } from '../types/index.js';
import { installNESFont } from '../ui/NESFont.js';
import { setUiEventBus } from '../ui/uiSounds.js';
import { wireAudioEvents } from './audioEvents.js';
import { GAME_WIDTH, GAME_HEIGHT } from './LayoutConstants.js';
import { HALTED_TEXT, TraceLog, traceEnabled, type Overlay } from './diagnostics.js';
import { defaultBoosts, type Boosts } from './Boosts.js';

export const WIDTH = GAME_WIDTH;
export const HEIGHT = GAME_HEIGHT;
/** Frames after every scene change during which no press counts as new (about 133 ms; U2). */
export const SCENE_ENTRY_HOLDOFF_FRAMES = 8;

export class Game {
  readonly app: Application;
  readonly scenes: SceneManager;
  readonly assets: AssetLoader;
  readonly input: InputManager;
  readonly events: EventBus;
  readonly data: DataLoader;
  readonly party: PartyManager;
  readonly inventory: Inventory;
  readonly audio: AudioManager;
  readonly gameFlags: GameFlags;
  playTime = 0;
  currentMapId = '';
  playerPosition = { x: 0, y: 0 };
  /** The way the field hero faces (kept by the exploration scene; Game Over > Retry / Return to Field restore it). */
  playerFacing: Direction = 'down';
  /** The facing the exploration scene applies on its next enter (set by Retry / Return to Field), then clears. */
  pendingFacing: Direction | null = null;
  /** Entrance of `currentMapId` to place the player at on the next exploration enter (debug field scenarios). */
  pendingEntrance: string | null = null;
  /** The game as it was when the current battle started (Game Over > Retry Battle); null when not retryable. */
  battleRetry: BattleRetrySnapshot | null = null;
  /** A battle the exploration scene starts as soon as it has entered (set by Retry Battle). */
  pendingBattle: BattleRequest | null = null;
  /** The party's field mode and the parked vehicles of every map (save v2, the retry snapshot; FieldVehicles). */
  fieldMode: FieldMode = 'walking';
  vehicles: VehicleState[] = [];
  /** `a1`: `playerPosition` is an act-1 overworld cell from a version-1 save, translated on the next field enter. */
  pendingFrame: 'a1' | null = null;
  /** The playthrough's boosts (src/core/Boosts.ts; save v3): defaults on a new game and for an older save. */
  boosts: Boosts = defaultBoosts();

  /** The scene / error trace, on with `?trace=1` (off by default; src/core/diagnostics.ts). */
  readonly trace: TraceLog | null;
  /** Where a fatal message (the loop halted) is shown; main.ts sets a banner over the page. */
  fatalOverlay: Overlay | null = null;

  constructor() {
    this.trace = typeof window !== 'undefined' && traceEnabled(window.location.search, window.localStorage)
      ? new TraceLog() : null;
    this.app = new Application();
    this.input = new InputManager();
    this.scenes = new SceneManager(this.app.stage, {
      onSettled: () => this.input.holdOff(SCENE_ENTRY_HOLDOFF_FRAMES),
      onTrace: this.trace ? (line) => this.trace?.log(line) : undefined,
    });
    this.assets = new AssetLoader();
    this.events = new EventBus();
    this.data = new DataLoader(this.assets);
    this.party = new PartyManager();
    this.inventory = new Inventory();
    this.audio = new AudioManager();
    this.gameFlags = new GameFlags();
  }

  async init(): Promise<void> {
    await this.app.init({
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: 0x000000,
      resolution: 1,
      autoDensity: true,
    });

    await this.assets.init();
    installNESFont();
    await ClassRegistry.init(this.data);
    await ItemRegistry.init(this.data);
    await SpellRegistry.init(this.data);
    await ShopRegistry.init(this.data);
    await CutsceneRegistry.init(this.assets);
    
    // Initialize audio (dev ?mute=1 disables it completely, e.g. for automated browser tests)
    if (isMutedByUrl()) this.audio.disable();
    try {
      const manifest = await this.assets.loadJson<AudioManifest>('assets/data/audio-manifest.json');
      await this.audio.init(manifest);
      wireAudioEvents(this.events, this.audio);
    } catch (e) {
      console.warn('Failed to load audio manifest:', e);
    }
    // menus built without their own bus still make cursor sounds (here, not in the constructor: unit tests stay quiet)
    setUiEventBus(this.events);

    this.input.attach();
    this.setupAccessibility();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    let consecutiveErrors = 0;
    this.app.ticker.add((ticker) => {
      try {
        this.scenes.update(ticker.deltaTime);
        this.input.update();
        this.playTime += ticker.deltaTime / 60;
        consecutiveErrors = 0;
      } catch (e) {
        consecutiveErrors++;
        console.error('Game loop error:', e);
        if (consecutiveErrors >= 3) {
          this.app.ticker.stop();
          console.error('Game halted after 3 consecutive errors.');
          this.trace?.log('game loop halted', String(e));
          this.fatalOverlay?.show(HALTED_TEXT);
        }
      }
    });
  }

  private setupAccessibility(): void {
    const canvas = this.app.canvas;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'FF1-Style RPG Game');
    canvas.setAttribute('tabindex', '0');
    // Focus after DOM insertion (called again in main.ts after appendChild)
  }

  /** Call after canvas is added to the DOM to ensure focus works */
  focusCanvas(): void {
    this.app.canvas.focus();
  }

  private resize(): void {
    const scale = Math.min(
      window.innerWidth / WIDTH,
      window.innerHeight / HEIGHT
    );
    const canvas = this.app.canvas;
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${HEIGHT * scale}px`;
    canvas.style.imageRendering = 'pixelated';
  }

  restoreState(data: {
    party: PartyManager;
    inventory: Inventory;
    flags: GameFlags;
    currentMap: string;
    playerPosition: { x: number; y: number };
    playTime: number;
    fieldMode?: FieldMode;
    vehicles?: VehicleState[];
    frame?: 'a1' | null;
    /** Missing keeps the current boosts (a retry: they cannot change in battle). */
    boosts?: Boosts;
  }): void {
    (this as { party: PartyManager }).party = data.party;
    (this as { inventory: Inventory }).inventory = data.inventory;
    (this as { gameFlags: GameFlags }).gameFlags = data.flags;
    this.currentMapId = data.currentMap;
    this.playerPosition = data.playerPosition;
    this.playTime = data.playTime;
    this.fieldMode = data.fieldMode ?? 'walking';
    this.vehicles = data.vehicles ?? [];
    this.pendingFrame = data.frame ?? null;
    if (data.boosts) this.boosts = { ...data.boosts };
  }

  /** A brand-new game: empty party, no gold, items or flags, no map yet, play time 0. */
  resetState(): void {
    this.restoreState({
      party: new PartyManager(),
      inventory: new Inventory(),
      flags: new GameFlags(),
      currentMap: '',
      playerPosition: { x: 0, y: 0 },
      playTime: 0,
      boosts: defaultBoosts(),
    });
    this.pendingEntrance = null;
    this.battleRetry = null;
    this.pendingBattle = null;
    this.pendingFacing = null;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }
}
