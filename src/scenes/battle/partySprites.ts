/**
 * The party's battle sprites (moved out of BattleDisplayManager to keep it under 250 lines, docs/CHAOS_FORMS_PLAN.md
 * 4.5): the slot positions on the battle plain and the sprite (2x battle art, else a coloured placeholder box).
 */
import { Graphics, Sprite, type Container, type Texture } from 'pixi.js';
import type { Character } from '../../entities/Character.js';
import { characterAtlas } from '../../rendering/CharacterAtlas.js';
import { setHeroBody } from './heroBody.js';

/** Party battle art (80x80 native at 2x): feet line per slot on the background's battle plain
 *  (docs/ART_BATTLE_PLAN.md: every actor's feet at y 360-745, B13), and x per slot (a slight diagonal). */
export const PARTY_FEET_Y = [425, 530, 635, 740];
export const PARTY_X = [1380, 1425, 1470, 1515];
const PLACEHOLDER_SIZE = 64;
const PLACEHOLDER_COLORS = [0x4488ff, 0xff4444, 0x44ff44, 0xffff44];

/** Screen position (top-left) for a party battle sprite whose feet are on `art.footRow`. Pass CL
 *  (docs/CLASS_LANCE_PLAN.md 7.1): an oversize hero is placed by its body box, so the body lands where an 80 x 80
 *  hero's cell does and the lance overhangs up and to the left. */
export function partySpritePosition(i: number, art: { footRow: number; scale: number; body?: { x: number } }): { x: number; y: number } {
  return { x: PARTY_X[i] - (art.body?.x ?? 0) * art.scale, y: PARTY_FEET_Y[i] - (art.footRow + 1) * art.scale };
}

/** Party member i's sprite and its pose textures (null for the placeholder box). */
export function buildPartySprite(char: Character, i: number): { sprite: Container; frames: Texture[] | null } {
  const art = characterAtlas.getBattleFrames(char.classData.id);
  if (art) {
    const sprite = new Sprite(art.frames[0]);
    const pos = partySpritePosition(i, art);
    sprite.position.set(pos.x, pos.y);
    setHeroBody(sprite, art);
    return { sprite, frames: art.frames };
  }
  const g = new Graphics();
  g.rect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE).fill(PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length]);
  g.position.set(PARTY_X[i] + (160 - PLACEHOLDER_SIZE) / 2, PARTY_FEET_Y[i] - PLACEHOLDER_SIZE);
  return { sprite: g, frames: null };
}
