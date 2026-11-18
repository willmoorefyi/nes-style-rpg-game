/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Texture } from 'pixi.js';
import { PlayerController } from '../../src/entities/PlayerController.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { InputManager } from '../../src/core/InputManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import type { MapData } from '../../src/types/index.js';
import { SCENE_ENTRY_HOLDOFF_FRAMES } from '../../src/core/Game.js';

// P3-06 / P3-01: a 30 ms tap (keydown and keyup before the next tick) must still turn the hero, and a single confirm tap
// must still be seen, also right after a scene change (the hold-off spends only the presses made BEFORE it).
function map(blocked: number[]): MapData {
  const collision = Array(64).fill(0);
  for (const i of blocked) collision[i] = 1;
  return { id: 't', width: 8, height: 8, layers: [collision.map(() => 1)], tilesets: ['t.png'], collision, npcs: [], transitions: [] };
}
const key = (type: 'keydown' | 'keyup', code: string) => window.dispatchEvent(new KeyboardEvent(type, { code }));

describe('quick taps', () => {
  let input: InputManager;
  beforeEach(() => { input = new InputManager(); input.attach(); });
  afterEach(() => input.detach());

  function hero(blocked: number[]) {
    return new PlayerController({ startX: 3, startY: 3, texture: Texture.WHITE, collisionMap: new CollisionMap(map(blocked)),
      input, events: new EventBus(), moveSpeed: 100 });
  }

  it('a tap shorter than a frame turns the hero toward a blocked cell (the hull) without moving', () => {
    const p = hero([2 * 8 + 3]);                     // (3,2) blocked, above the hero
    key('keydown', 'ArrowUp');
    key('keyup', 'ArrowUp');                         // both before the next tick
    p.update(1);
    expect(p.direction).toBe('up');
    expect(p.facingTile).toEqual({ x: 3, y: 2 });
    expect(p.isMoving).toBe(false);
  });

  it('a tap right after a scene-entry hold-off is still seen: the hold-off spends earlier presses only', () => {
    const p = hero([2 * 8 + 3]);
    input.holdOff(SCENE_ENTRY_HOLDOFF_FRAMES);
    key('keydown', 'ArrowUp');
    key('keyup', 'ArrowUp');
    p.update(1);
    expect(p.direction).toBe('up');
  });

  it('a confirm tap is a press for one tick, but not during its hold-off frames', () => {
    input.holdOff(2, ['confirm']);
    key('keydown', 'Enter');
    key('keyup', 'Enter');
    expect(input.isJustPressed('confirm')).toBe(false);   // held off: the deliberate swallow after a dialog closes
    input.update();
    input.update();
    key('keydown', 'Enter');
    key('keyup', 'Enter');
    expect(input.isJustPressed('confirm')).toBe(true);
  });
});
