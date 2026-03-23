import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';

export class SceneManager {
  private scenes = new Map<string, Scene>();
  private sceneStack: Array<{ name: string; scene: Scene }> = [];
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

    // Clear the stack - switchTo is a hard transition
    for (const entry of this.sceneStack) {
      await entry.scene.exit();
      this.stage.removeChild(entry.scene.container);
    }
    this.sceneStack = [];

    if (this.currentScene) {
      await this.currentScene.exit();
      this.stage.removeChild(this.currentScene.container);
    }

    this.currentScene = next;
    this.currentName = name;
    this.stage.addChild(next.container);
    await next.enter();
  }

  async push(name: string): Promise<void> {
    const next = this.scenes.get(name);
    if (!next) throw new Error(`Scene '${name}' not found`);

    if (this.currentScene && this.currentName) {
      this.currentScene.onPause?.();
      this.currentScene.container.visible = false;
      this.sceneStack.push({ name: this.currentName, scene: this.currentScene });
    }

    this.currentScene = next;
    this.currentName = name;
    this.stage.addChild(next.container);
    await next.enter();
  }

  async pop(): Promise<void> {
    if (this.sceneStack.length === 0) {
      throw new Error('Scene stack is empty');
    }

    if (this.currentScene) {
      await this.currentScene.exit();
      this.stage.removeChild(this.currentScene.container);
    }

    const prev = this.sceneStack.pop()!;
    this.currentScene = prev.scene;
    this.currentName = prev.name;
    prev.scene.container.visible = true;
    prev.scene.onResume?.();
  }

  update(dt: number): void {
    this.currentScene?.update(dt);
  }

  get current(): string | null {
    return this.currentName;
  }
}