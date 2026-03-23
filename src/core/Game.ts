import { Application } from 'pixi.js';
import { SceneManager } from './SceneManager.js';
import { AssetLoader } from './AssetLoader.js';
import { InputManager } from './InputManager.js';
import { EventBus } from './EventBus.js';
import { DataLoader } from './DataLoader.js';
import { ItemRegistry } from '../data/ItemRegistry.js';
import { SpellRegistry } from '../data/SpellRegistry.js';
import { ShopRegistry } from '../data/ShopRegistry.js';
import { PartyManager } from '../entities/PartyManager.js';
import { Inventory } from '../entities/Inventory.js';
import { AudioManager, type AudioManifest } from './AudioManager.js';
import { GameFlags } from './GameFlags.js';

export const WIDTH = 256;
export const HEIGHT = 240;

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

  constructor() {
    this.app = new Application();
    this.scenes = new SceneManager(this.app.stage);
    this.assets = new AssetLoader();
    this.input = new InputManager();
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
    await ItemRegistry.init(this.data);
    await SpellRegistry.init(this.data);
    await ShopRegistry.init(this.data);
    
    // Initialize audio
    try {
      const manifest = await this.assets.loadJson<AudioManifest>('assets/data/audio-manifest.json');
      await this.audio.init(manifest);
      this.setupAudioEvents();
    } catch (e) {
      console.warn('Failed to load audio manifest:', e);
    }

    this.input.attach();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.app.ticker.add((ticker) => {
      this.input.update();
      this.scenes.update(ticker.deltaTime);
      this.playTime += ticker.deltaTime / 60;
    });
  }

  private setupAudioEvents(): void {
    this.events.on('cursorMove', () => this.audio.playSFX('cursor-move'));
    this.events.on('cursorSelect', () => this.audio.playSFX('cursor-select'));
    this.events.on('cursorCancel', () => this.audio.playSFX('cursor-cancel'));
    this.events.on('battleHit', () => this.audio.playSFX('battle-hit'));
    this.events.on('battleMiss', () => this.audio.playSFX('battle-miss'));
    this.events.on('battleVictory', () => this.audio.playSFX('battle-victory'));
    this.events.on('spellCast', () => this.audio.playSFX('spell-cast'));
  }

  private resize(): void {
    const scale = Math.min(
      window.innerWidth / WIDTH,
      window.innerHeight / HEIGHT
    );
    const canvas = this.app.canvas;
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${HEIGHT * scale}px`;
  }

  restoreState(data: {
    party: PartyManager;
    inventory: Inventory;
    flags: GameFlags;
    currentMap: string;
    playerPosition: { x: number; y: number };
    playTime: number;
  }): void {
    (this as { party: PartyManager }).party = data.party;
    (this as { inventory: Inventory }).inventory = data.inventory;
    (this as { gameFlags: GameFlags }).gameFlags = data.flags;
    this.currentMapId = data.currentMap;
    this.playerPosition = data.playerPosition;
    this.playTime = data.playTime;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }
}
