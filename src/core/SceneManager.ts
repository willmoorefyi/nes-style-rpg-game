import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';

export class SceneManager {
  private scenes = new Map<string, Scene>();
  private currentScene: Scene | null = null;
  private currentName: string | null = null;
  readonly stage: Container;

  constructor(stage: Container) {
    this.stage = stage;
  }

  register(name: string, scene: Scene): void {
    this.scenes.set(name, scene);
  }

  async switchTo(name: string): Promise<void> {
    const next = this.scenes.get(name);
    if (!next) throw new Error(`Scene '${name}' not found`);

    if (this.currentScene) {
      await this.currentScene.exit();
      this.stage.removeChild(this.currentScene.container);
    }

    this.currentScene = next;
    this.currentName = name;
    this.stage.addChild(next.container);
    await next.enter();
  }

  update(dt: number): void {
    this.currentScene?.update(dt);
  }

  get current(): string | null {
    return this.currentName;
  }
}