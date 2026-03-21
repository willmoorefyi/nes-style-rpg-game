import { Application } from 'pixi.js';
import { SceneManager } from './SceneManager.js';
import { AssetLoader } from './AssetLoader.js';
import { InputManager } from './InputManager.js';
import { EventBus } from './EventBus.js';
import { DataLoader } from './DataLoader.js';
import { PartyManager } from '../entities/PartyManager.js';

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

  constructor() {
    this.app = new Application();
    this.scenes = new SceneManager(this.app.stage);
    this.assets = new AssetLoader();
    this.input = new InputManager();
    this.events = new EventBus();
    this.data = new DataLoader(this.assets);
    this.party = new PartyManager();
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
    this.input.attach();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.app.ticker.add((ticker) => {
      this.input.update();
      this.scenes.update(ticker.deltaTime);
    });
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

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }
}