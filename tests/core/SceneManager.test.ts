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