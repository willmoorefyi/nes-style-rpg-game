import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container } from 'pixi.js';
import { SceneManager } from '../../src/core/SceneManager.js';
import type { Scene } from '../../src/types/index.js';

interface MockScene extends Scene {
  enterCalls: number;
  exitCalls: number;
  updateCalls: number[];
}

function createMockScene(): MockScene {
  const container = new Container();
  const scene: MockScene = {
    container,
    enterCalls: 0,
    exitCalls: 0,
    updateCalls: [],
    enter: vi.fn(() => { scene.enterCalls++; }),
    exit: vi.fn(() => { scene.exitCalls++; }),
    update: vi.fn((dt: number) => { scene.updateCalls.push(dt); }),
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
});