import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import type { Scene } from '../../src/types/index.js';

interface MockScene extends Scene {
  enterCalls: number;
  exitCalls: number;
  updateCalls: number[];
  pauseCalls: number;
  resumeCalls: number;
}

function createMockScene(): MockScene {
  const container = new Container();
  const scene: MockScene = {
    container,
    enterCalls: 0,
    exitCalls: 0,
    updateCalls: [],
    pauseCalls: 0,
    resumeCalls: 0,
    enter: vi.fn(() => { scene.enterCalls++; }),
    exit: vi.fn(() => { scene.exitCalls++; }),
    update: vi.fn((dt: number) => { scene.updateCalls.push(dt); }),
    onPause: vi.fn(() => { scene.pauseCalls++; }),
    onResume: vi.fn(() => { scene.resumeCalls++; }),
  };
  return scene;
}

describe('SceneManager', () => {
  let stage: Container;
  let manager: SceneManager;

  beforeEach(() => {
    stage = new Container();
    manager = new SceneManager(stage);
  });

  it('registers scenes by name', () => {
    const scene = createMockScene();
    manager.register('test', scene);
    expect(manager.current).toBeNull();
  });

  it('switches to a registered scene and calls enter', async () => {
    const scene = createMockScene();
    manager.register('test', scene);
    await manager.switchTo('test');
    expect(scene.enterCalls).toBe(1);
    expect(manager.current).toBe('test');
    expect(stage.children).toContain(scene.container);
  });

  it('throws when switching to unregistered scene', async () => {
    await expect(manager.switchTo('missing')).rejects.toThrow("Scene 'missing' not found");
  });

  it('calls exit on previous scene when switching', async () => {
    const scene1 = createMockScene();
    const scene2 = createMockScene();
    manager.register('s1', scene1);
    manager.register('s2', scene2);

    await manager.switchTo('s1');
    await manager.switchTo('s2');

    expect(scene1.exitCalls).toBe(1);
    expect(scene2.enterCalls).toBe(1);
    expect(stage.children).not.toContain(scene1.container);
    expect(stage.children).toContain(scene2.container);
  });

  it('calls update on current scene', async () => {
    const scene = createMockScene();
    manager.register('test', scene);
    await manager.switchTo('test');
    manager.update(16);
    manager.update(17);
    expect(scene.updateCalls).toEqual([16, 17]);
  });

  it('lifecycle order: exit before enter', async () => {
    const order: string[] = [];
    const scene1: Scene = {
      container: new Container(),
      enter: () => { order.push('s1-enter'); },
      exit: () => { order.push('s1-exit'); },
      update: () => {},
    };
    const scene2: Scene = {
      container: new Container(),
      enter: () => { order.push('s2-enter'); },
      exit: () => { order.push('s2-exit'); },
      update: () => {},
    };
    manager.register('s1', scene1);
    manager.register('s2', scene2);

    await manager.switchTo('s1');
    await manager.switchTo('s2');

    expect(order).toEqual(['s1-enter', 's1-exit', 's2-enter']);
  });

  describe('push/pop', () => {
    it('push adds scene to stack and calls enter on new scene', async () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      manager.register('s1', scene1);
      manager.register('s2', scene2);

      await manager.switchTo('s1');
      await manager.push('s2');

      expect(scene2.enterCalls).toBe(1);
      expect(manager.current).toBe('s2');
      expect(stage.children).toContain(scene2.container);
    });

    it('push calls onPause on the scene being pushed over', async () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      manager.register('s1', scene1);
      manager.register('s2', scene2);

      await manager.switchTo('s1');
      await manager.push('s2');

      expect(scene1.pauseCalls).toBe(1);
    });

    it('IN-6: pushing a transparent scene keeps the previous container visible; pop is unchanged', async () => {
      const scene1 = createMockScene();
      const overlay = { ...createMockScene(), transparent: true };
      manager.register('s1', scene1);
      manager.register('overlay', overlay);

      await manager.switchTo('s1');
      await manager.push('overlay');
      expect(scene1.container.visible).toBe(true);
      expect(scene1.pauseCalls).toBe(1);

      await manager.pop();
      expect(scene1.container.visible).toBe(true);
      expect(scene1.resumeCalls).toBe(1);
    });

    it('push hides previous scene container', async () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      manager.register('s1', scene1);
      manager.register('s2', scene2);

      await manager.switchTo('s1');
      await manager.push('s2');

      expect(scene1.container.visible).toBe(false);
    });

    it('pop calls exit on current and restores previous scene', async () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      manager.register('s1', scene1);
      manager.register('s2', scene2);

      await manager.switchTo('s1');
      await manager.push('s2');
      await manager.pop();

      expect(scene2.exitCalls).toBe(1);
      expect(manager.current).toBe('s1');
      expect(scene1.container.visible).toBe(true);
    });

    it('pop calls onResume on the restored scene', async () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      manager.register('s1', scene1);
      manager.register('s2', scene2);

      await manager.switchTo('s1');
      await manager.push('s2');
      await manager.pop();

      expect(scene1.resumeCalls).toBe(1);
    });

    it('pop on empty stack throws', async () => {
      const scene = createMockScene();
      manager.register('test', scene);
      await manager.switchTo('test');

      await expect(manager.pop()).rejects.toThrow('Scene stack is empty');
    });

    it('push throws when scene not registered', async () => {
      await expect(manager.push('missing')).rejects.toThrow("Scene 'missing' not found");
    });

    it('switchTo clears the stack and calls exit on stacked scenes', async () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      const scene3 = createMockScene();
      manager.register('s1', scene1);
      manager.register('s2', scene2);
      manager.register('s3', scene3);

      await manager.switchTo('s1');
      await manager.push('s2');
      await manager.switchTo('s3');

      expect(scene1.exitCalls).toBe(1);
      expect(scene2.exitCalls).toBe(1);
      expect(scene3.enterCalls).toBe(1);
    });

    it('update only updates top-of-stack scene', async () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      manager.register('s1', scene1);
      manager.register('s2', scene2);

      await manager.switchTo('s1');
      await manager.push('s2');
      manager.update(16);

      expect(scene1.updateCalls).toEqual([]);
      expect(scene2.updateCalls).toEqual([16]);
    });
  });

  describe('registerLazy', () => {
    it('switchTo resolves a lazy-registered scene', async () => {
      const scene = createMockScene();
      const factory = vi.fn(async () => scene);
      manager.registerLazy('lazy', factory);

      await manager.switchTo('lazy');

      expect(factory).toHaveBeenCalledOnce();
      expect(scene.enterCalls).toBe(1);
      expect(manager.current).toBe('lazy');
    });

    it('push resolves a lazy-registered scene', async () => {
      const scene1 = createMockScene();
      const scene2 = createMockScene();
      manager.register('s1', scene1);
      manager.registerLazy('lazy', async () => scene2);

      await manager.switchTo('s1');
      await manager.push('lazy');

      expect(scene2.enterCalls).toBe(1);
      expect(scene1.pauseCalls).toBe(1);
    });

    it('caches the lazy scene after first resolution', async () => {
      const scene = createMockScene();
      const factory = vi.fn(async () => scene);
      manager.registerLazy('lazy', factory);

      await manager.switchTo('lazy');
      // Push another scene then switch back to lazy
      const other = createMockScene();
      manager.register('other', other);
      await manager.switchTo('other');
      await manager.switchTo('lazy');

      expect(factory).toHaveBeenCalledOnce();
      expect(scene.enterCalls).toBe(2);
    });

    it('eager register takes priority over lazy', async () => {
      const eager = createMockScene();
      const lazy = createMockScene();
      manager.register('scene', eager);
      manager.registerLazy('scene', async () => lazy);

      await manager.switchTo('scene');

      expect(eager.enterCalls).toBe(1);
      expect(lazy.enterCalls).toBe(0);
    });

    it('throws for scene not in eager or lazy maps', async () => {
      await expect(manager.switchTo('missing')).rejects.toThrow("Scene 'missing' not found");
      await expect(manager.push('missing')).rejects.toThrow("Scene 'missing' not found");
    });
  });
});

/** A promise and its resolver, to hold an enter() or a factory open. */
function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('S1 / S3: scene changes in flight', () => {
  let manager: SceneManager;
  beforeEach(() => { manager = new SceneManager(new Container()); });

  it('update is not forwarded while enter() is pending', async () => {
    const title = createMockScene();
    manager.register('title', title);
    await manager.switchTo('title');
    const slow = createMockScene();
    const entered = deferred();
    slow.enter = vi.fn(() => entered.promise);
    manager.register('field', slow);
    const switching = manager.switchTo('field');
    await Promise.resolve();
    manager.update(1);
    expect(slow.updateCalls).toEqual([]);
    expect(title.updateCalls).toEqual([]);
    entered.resolve();
    await switching;
    manager.update(2);
    expect(slow.updateCalls).toEqual([2]);
  });

  it('update is not forwarded while a lazy factory is still loading', async () => {
    const title = createMockScene();
    manager.register('title', title);
    await manager.switchTo('title');
    const built = deferred<Scene>();
    manager.registerLazy('menu', () => built.promise);
    const pushing = manager.push('menu');
    manager.update(1);
    expect(title.updateCalls).toEqual([]);
    built.resolve(createMockScene());
    await pushing;
  });

  it('two switchTo calls in flight build the lazy scene once and enter it once', async () => {
    const scene = createMockScene();
    const built = deferred<Scene>();
    const factory = vi.fn(() => built.promise);
    manager.registerLazy('a', factory);
    const first = manager.switchTo('a');
    const second = manager.switchTo('a');
    built.resolve(scene);
    await Promise.all([first, second]);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(scene.enterCalls).toBe(1);
  });

  it('a double push while the scene loads pushes it once (depth 1)', async () => {
    manager.register('title', createMockScene());
    await manager.switchTo('title');
    const built = deferred<Scene>();
    manager.registerLazy('battle', () => built.promise);
    const first = manager.push('battle');
    const second = manager.push('battle');
    built.resolve(createMockScene());
    await Promise.all([first, second]);
    expect(manager.depth).toBe(1);
    expect(manager.current).toBe('battle');
  });

  it('a lazy load that failed can be retried', async () => {
    let calls = 0;
    const scene = createMockScene();
    manager.registerLazy('flaky', async () => {
      calls++;
      if (calls === 1) throw new Error('chunk failed');
      return scene;
    });
    await expect(manager.switchTo('flaky')).rejects.toThrow('chunk failed');
    manager.update(1);                                         // the gate is released after a failure
    await manager.switchTo('flaky');
    expect(scene.enterCalls).toBe(1);
    manager.update(3);
    expect(scene.updateCalls).toEqual([3]);
  });

  it('depth counts the scenes paused under the current one', async () => {
    manager.register('a', createMockScene());
    manager.register('b', createMockScene());
    expect(manager.depth).toBe(0);
    await manager.switchTo('a');
    expect(manager.depth).toBe(0);
    await manager.push('b');
    expect(manager.depth).toBe(1);
    await manager.pop();
    expect(manager.depth).toBe(0);
  });
});