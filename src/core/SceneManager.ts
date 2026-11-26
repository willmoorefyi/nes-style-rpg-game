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
  /** Called once each switchTo / push / pop has finished (not for a joined repeat): Game holds input off (U2). */
  private onSettled: (() => void) | undefined;

  /** Debug trace of every scene change (`?trace=1`, src/core/diagnostics.ts); undefined = off. */
  private readonly onTrace: ((line: string) => void) | undefined;

  constructor(stage: Container, opts: { onSettled?: () => void; onTrace?: (line: string) => void } = {}) {
    this.stage = stage;
    this.onSettled = opts.onSettled;
    this.onTrace = opts.onTrace;
  }

  private trace(what: string, name?: string): void {
    this.onTrace?.(`scene ${what}${name ? ` ${name}` : ''} (now ${this.currentName ?? 'none'}, stack ${this.sceneStack.length})`);
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
      } catch (e) {
        this.onTrace?.(`scene change ${key} failed: ${String(e)}`);
        throw e;
      } finally {
        this.transitions--;
        this.running.delete(key);
        this.onSettled?.();
      }
    })();
    this.running.set(key, run);
    return run;
  }

  switchTo(name: string): Promise<void> {
    return this.gated(`switch:${name}`, async () => {
      this.trace('switchTo', name);
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
      next.container.visible = true; // a scene hidden under an earlier push comes back visible
      await next.enter();
    });
  }

  push(name: string): Promise<void> {
    return this.gated(`push:${name}`, async () => {
      this.trace('push', name);
      const next = await this.resolve(name);

      if (this.currentScene && this.currentName) {
        this.currentScene.onPause?.();
        this.currentScene.container.visible = next.transparent === true;
        this.sceneStack.push({ name: this.currentName, scene: this.currentScene });
      }

      this.currentScene = next;
      this.currentName = name;
      this.stage.addChild(next.container);
      // a cached scene left hidden under a stack that a switchTo cleared (Field menu > Load) is shown again (ESC)
      next.container.visible = true;
      await next.enter();
    });
  }

  async pop(): Promise<void> {
    if (this.sceneStack.length === 0) {
      throw new Error('Scene stack is empty');
    }
    this.transitions++;
    this.trace('pop');
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
      this.onSettled?.();
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