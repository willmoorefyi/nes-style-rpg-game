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
    // Direction index = floor(rng * 4); 0.5 selects index 2, which is "left"
    const npc = new NPC({ ...data, x: 2, y: 2 }, Texture.WHITE, { frames, frameHeight: 96 }, () => 0.5);
    npc.update(200, () => true);
    expect((npc.sprite.texture as unknown as { row: number }).row).toBe(2);
    expect(npc.tileX).toBe(1);
  });
});

describe('NPC display scale', () => {
  it('applies the art scale and lifts by the scaled frame height', () => {
    const frames = [0, 1, 2, 3].map(() => [0, 1, 2].map(() => Texture.WHITE));
    const npc = new NPC({ id: 'k', x: 2, y: 3, sprite: 'knight', dialog: ['hi'] }, Texture.WHITE, { frames, frameHeight: 192, scale: 2 });
    expect(npc.sprite.scale.x).toBe(2);
    expect(npc.sprite.y).toBe(3 * 48 + 48 - 192);
  });
});

describe('NPC conversation facing', () => {
  const art = () => {
    const frames = [0, 1, 2, 3].map(() => [new Texture(), new Texture(), new Texture()]);
    return { frames, frameHeight: 96, scale: 1 };
  };
  it('turns to face the hero for the conversation and back afterwards', () => {
    const a = art();
    const npc = new NPC({ id: 'n', x: 5, y: 5, sprite: 'villager', dialog: ['Hi'] }, Texture.WHITE, a);
    expect(npc.facingDirection).toBe('down');
    npc.faceToward(4, 5);                       // hero to the west
    expect(npc.facingDirection).toBe('left');
    expect(npc.sprite.texture).toBe(a.frames[2][0]);
    npc.faceToward(4, 5);                       // still talking: keeps the original facing for later
    npc.endTalk();
    expect(npc.facingDirection).toBe('down');
    expect(npc.sprite.texture).toBe(a.frames[0][0]);
  });
  it('faces a hero across a counter (two tiles away)', () => {
    const npc = new NPC({ id: 'k', x: 4, y: 3, sprite: 'merchant', dialog: ['Hi'] }, Texture.WHITE, art());
    npc.faceToward(4, 5);
    expect(npc.facingDirection).toBe('down');
    npc.faceToward(6, 3);
    expect(npc.facingDirection).toBe('right');
  });
});
