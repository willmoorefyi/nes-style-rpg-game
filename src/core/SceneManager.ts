import { Container } from 'pixi.js';
import type { Scene } from '../types/index.js';

export class SceneManager {
  private scenes = new Map<string, Scene>();
  private lazyFactories = new Map<string, () => Promise<Scene>>();
  private sceneStack: Array<{ name: string; scene: Scene }> = [];
  private currentScene: Scene | null = null;
  private currentName: string | null = null;
  /** Lazy scenes whose factory is still running: a second request waits for the same instance (S3). */
  private pending = new Map<string, Promise<Scene>>();
  /** switchTo / push calls still in flight, by kind and name: a repeat joins the running one (S3). */
  private running = new Map<string, Promise<void>>();
  /** Scene changes in flight; no scene is updated until its enter() has resolved (S1). */
  private transitions = 0;
  readonly stage: Container;

  constructor(stage: Container) {
    this.stage = stage;
  }

  register(name: string, scene: Scene): void {
    this.scenes.set(name, scene);
  }

  registerLazy(name: string, factory: () => Promise<Scene>): void {
    this.lazyFactories.set(name, factory);
  }

  unregister(name: string): void {
    this.scenes.delete(name);
  }

  private async resolve(name: string): Promise<Scene> {
    const eager = this.scenes.get(name);
    if (eager) return eager;

    const factory = this.lazyFactories.get(name);
    if (!factory) throw new Error(`Scene '${name}' not found`);

    let loading = this.pending.get(name);
    if (!loading) {
      loading = factory().then((scene) => {
        this.scenes.set(name, scene);
        return scene;
      });
      this.pending.set(name, loading);
      // removed on settle either way, so a failed load can be retried
      loading.then(() => this.pending.delete(name), () => this.pending.delete(name));
    }
    return loading;
  }

  /** Run a scene change with updates held off until it settles; the same change already in flight is joined. */
  private gated(key: string, change: () => Promise<void>): Promise<void> {
    const joined = this.running.get(key);
    if (joined) return joined;
    this.transitions++;
    const run = (async () => {
      try {
        await change();
      } finally {
        this.transitions--;
        this.running.delete(key);
      }
    })();
    this.running.set(key, run);
    return run;
  }

  switchTo(name: string): Promise<void> {
    return this.gated(`switch:${name}`, async () => {
      const next = await this.resolve(name);

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
    });
  }

  push(name: string): Promise<void> {
    return this.gated(`push:${name}`, async () => {
      const next = await this.resolve(name);

      if (this.currentScene && this.currentName) {
        this.currentScene.onPause?.();
        this.currentScene.container.visible = next.transparent === true;
        this.sceneStack.push({ name: this.currentName, scene: this.currentScene });
      }

      this.currentScene = next;
      this.currentName = name;
      this.stage.addChild(next.container);
      await next.enter();
    });
  }

  async pop(): Promise<void> {
    if (this.sceneStack.length === 0) {
      throw new Error('Scene stack is empty');
    }
    this.transitions++;
    try {
      if (this.currentScene) {
        await this.currentScene.exit();
        this.stage.removeChild(this.currentScene.container);
      }

      const prev = this.sceneStack.pop()!;
      this.currentScene = prev.scene;
      this.currentName = prev.name;
      prev.scene.container.visible = true;
      prev.scene.onResume?.();
    } finally {
      this.transitions--;
    }
  }

  update(dt: number): void {
    if (this.transitions > 0) return;
    this.currentScene?.update(dt);
  }

  /** Scenes paused under the current one (0 with a single scene). */
  get depth(): number {
    return this.sceneStack.length;
  }

  get current(): string | null {
    return this.currentName;
  }

  get<T extends Scene>(name: string): T | undefined {
    return this.scenes.get(name) as T | undefined;
  }
}