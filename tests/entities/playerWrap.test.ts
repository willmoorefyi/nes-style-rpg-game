/**
 * WR (docs/WORLD_WRAP_PLAN.md 4, 10): the hero across the seams of a wrapped map. The drawn target may be unwrapped
 * (-1 or W) so the sprite slides one tile; at the step's end the tile normalises and the sprite jumps by exactly one
 * period. `gridX`, `playerMove`, `targetTile` and `facingTile` are canonical; the carry is kept.
 */
import { describe, it, expect, vi } from 'vitest';
import { Texture } from 'pixi.js';
import { PlayerController } from '../../src/entities/PlayerController.js';
import { CollisionMap } from '../../src/rendering/CollisionMap.js';
import { InputManager } from '../../src/core/InputManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { TILE_SIZE } from '../../src/core/LayoutConstants.js';
import type { Direction } from '../../src/rendering/SpriteAnimation.js';
import type { MapData } from '../../src/types/index.js';

const N = 8;
const map = (wrap: boolean): MapData => ({ id: 'w', width: N, height: N, layers: [[]], tilesets: [],
  collision: Array(N * N).fill(0), npcs: [], transitions: [], ...(wrap ? { wrap: true } : {}) });

function hero(x: number, y: number, wrap = true) {
  const input = new InputManager();
  const events = new EventBus();
  const moves: Array<{ x: number; y: number }> = [];
  events.on('playerMove', (c: { x: number; y: number }) => moves.push({ ...c }));
  let held: Direction | null = null;
  vi.spyOn(input, 'isPressed').mockImplementation((a) => a === held);
  const p = new PlayerController({ startX: x, startY: y, texture: Texture.WHITE, collisionMap: new CollisionMap(map(wrap)),
    input, events, moveSpeed: 100 });
  /** Hold `dir` until one tile is walked; the sprite's x and y each frame. */
  const step = (dir: Direction): Array<{ x: number; y: number }> => {
    held = dir;
    const seen: Array<{ x: number; y: number }> = [];
    const before = moves.length;
    for (let f = 0; f < 60 && moves.length === before; f++) {
      p.update(1);
      seen.push({ x: p.animation.sprite.x, y: p.animation.sprite.y });
    }
    held = null;
    return seen;
  };
  return { p, moves, step };
}

const P = N * TILE_SIZE;

describe('WR: the hero across the seam', () => {
  it.each([
    ['right', N - 1, 3, 0, 3, 'x', 1],
    ['left', 0, 3, N - 1, 3, 'x', -1],
    ['down', 3, N - 1, 3, 0, 'y', 1],
    ['up', 3, 0, 3, N - 1, 'y', -1],
  ] as const)('%s: (%i, %i) to (%i, %i), monotone, then one period jump', (dir, x0, y0, x1, y1, axis, sign) => {
    const { p, moves, step } = hero(x0, y0);
    const start = p.animation.sprite[axis];
    const seen = step(dir).map((c) => c[axis]);
    const during = seen.slice(0, -1);
    for (let i = 1; i < during.length; i++) expect(sign * (during[i] - during[i - 1])).toBeGreaterThan(0);
    expect(sign * (during[during.length - 1] - start)).toBeLessThan(TILE_SIZE);
    expect(seen[seen.length - 1]).toBe(start + sign * TILE_SIZE - sign * P);
    expect([p.gridX, p.gridY]).toEqual([x1, y1]);
    expect(moves).toEqual([{ x: x1, y: y1 }]);
    expect(p.targetTile).toEqual({ x: x1, y: y1 });
  });

  it('the corner takes two steps, each canonical', () => {
    const { p, moves, step } = hero(N - 1, N - 1);
    step('right');
    step('down');
    expect(moves).toEqual([{ x: 0, y: N - 1 }, { x: 0, y: 0 }]);
    expect([p.gridX, p.gridY]).toEqual([0, 0]);
  });

  it('facingTile and the mid-step targetTile are canonical', () => {
    const { p } = hero(N - 1, 2);
    p.face('right');
    expect(p.facingTile).toEqual({ x: 0, y: 2 });
    const top = hero(4, 0).p;
    top.face('up');
    expect(top.facingTile).toEqual({ x: 4, y: N - 1 });
  });

  it('a held direction keeps its carry across the seam', () => {
    const { p, moves, step } = hero(N - 2, 1);
    step('right');
    const a = p.animation.sprite.x;
    step('right');
    expect(moves[moves.length - 1]).toEqual({ x: 0, y: 1 });
    step('right');
    expect(p.animation.sprite.x).toBe(a + 2 * TILE_SIZE - P);
  });

  it('an NPC on (0, y) blocks a step from (W - 1, y); a flat map refuses the edge step', () => {
    const { p, moves, step } = hero(N - 1, 4);
    p.setNPCPositions([{ x: 0, y: 4 }]);
    step('right');
    expect(moves).toEqual([]);
    const flat = hero(N - 1, 4, false);
    flat.step('right');
    expect(flat.moves).toEqual([]);
    expect(flat.p.facingTile).toEqual({ x: N, y: 4 });
  });
});
