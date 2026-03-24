import { describe, it, expect } from 'vitest';
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
