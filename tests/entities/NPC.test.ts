import { describe, it, expect, vi } from 'vitest';
import { NPC, type NPCData } from '../../src/entities/NPC.js';
import { Texture } from 'pixi.js';

describe('NPC chest fields', () => {
  it('stores chestItem and chestFlag from data', () => {
    const data: NPCData = {
      id: 'chest1',
      x: 3,
      y: 6,
      sprite: 'chest',
      dialog: ['Found a Potion!'],
      chestItem: 'potion',
      chestFlag: 'CHEST_TOF_POTION',
    };
    const npc = new NPC(data, Texture.WHITE);
    expect(npc.chestItem).toBe('potion');
    expect(npc.chestFlag).toBe('CHEST_TOF_POTION');
  });

  it('chestItem and chestFlag are undefined when not provided', () => {
    const data: NPCData = {
      id: 'villager',
      x: 1,
      y: 1,
      sprite: 'npc',
      dialog: ['Hello!'],
    };
    const npc = new NPC(data, Texture.WHITE);
    expect(npc.chestItem).toBeUndefined();
    expect(npc.chestFlag).toBeUndefined();
  });
});

describe('NPC two-tile art', () => {
  const frames = [0, 1, 2, 3].map((row) => [0, 1, 2].map((col) => ({ row, col }) as unknown as Texture));
  const data: NPCData = { id: 'guard', x: 4, y: 5, sprite: 'guard', dialog: ['Halt!'], wander: true };

  it('lifts a 96px frame one tile so its feet stay on the NPC tile', () => {
    const npc = new NPC(data, Texture.WHITE, { frames, frameHeight: 96 });
    expect(npc.sprite.x).toBe(4 * 48);
    expect(npc.sprite.y).toBe(5 * 48 - 48);
  });

  it('sorts by the feet position', () => {
    const upper = new NPC({ ...data, y: 2 }, Texture.WHITE, { frames, frameHeight: 96 });
    const lower = new NPC({ ...data, y: 6 }, Texture.WHITE, { frames, frameHeight: 96 });
    expect(lower.sprite.zIndex).toBeGreaterThan(upper.sprite.zIndex);
    expect(lower.sprite.zIndex).toBe(6 * 48 + 48);
  });

  it('keeps single-tile placement when no art is supplied', () => {
    const npc = new NPC(data, Texture.WHITE);
    expect(npc.sprite.y).toBe(5 * 48);
  });

  it('faces the direction it wanders and uses that row of frames', () => {
    const npc = new NPC({ ...data, x: 2, y: 2 }, Texture.WHITE, { frames, frameHeight: 96 });
    // Direction index = floor(random * 4); 0.5 selects index 2, which is "left"
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    npc.update(200, () => true);
    spy.mockRestore();
    expect((npc.sprite.texture as unknown as { row: number }).row).toBe(2);
    expect(npc.tileX).toBe(1);
  });
});
