/**
 * T6 review: battle art that arrives after the placeholders swaps the sprites in place; the active-hero marker
 * (BA-8: step forward, pulse, arrow) must follow the new sprite instead of staying on the removed placeholder.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BattleScene, COMMAND_CONFIRM_GUARD_FRAMES } from '../../../src/scenes/BattleScene.js';
import { ActiveHeroMarker, ACTIVE_STEP } from '../../../src/scenes/battle/ActiveHeroMarker.js';
import { partySpritePosition } from '../../../src/scenes/battle/BattleDisplayManager.js';
import { BATTLE_POSES, characterAtlas, type BattleFrames } from '../../../src/rendering/CharacterAtlas.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { Character } from '../../../src/entities/Character.js';
import { createMockBattleSceneDeps, createMockInput, type MockInput } from '../../helpers/testUtils.js';
import type { CharacterClassData, EnemyData } from '../../../src/types/index.js';

const fighter: CharacterClassData = {
  id: 'fighter', name: 'Fighter',
  baseStats: { hp: 100, strength: 10, agility: 5, intelligence: 3, vitality: 8, luck: 5 },
  statGrowth: { hp: 5, strength: 2, agility: 1, intelligence: 1, vitality: 2, luck: 1 },
  usableEquipment: [], spellLevels: { white: 0, black: 0 },
};
const harmless: EnemyData = {
  id: 'goblin', name: 'Goblin',
  stats: { hp: 500, strength: 5, agility: 1, intelligence: 2, vitality: 3, luck: 2, attack: 1, defense: 2, magicDefense: 1 },
  xpReward: 10, goldReward: 5, sprite: 'goblin',
};

afterEach(() => { vi.restoreAllMocks(); });

function tick(scene: BattleScene, input: MockInput, action?: 'confirm'): void {
  if (action) input.press(action);
  scene.update(1);
  input.clear();
}

describe('T6 review: the active-hero marker survives late art', () => {
  it('ActiveHeroMarker.replace moves the step and the arrow to the new sprite; other sprites are ignored', () => {
    const parent = new Container();
    const placeholder = new Graphics().rect(0, 0, 64, 64).fill(0xff0000);
    placeholder.position.set(1400, 400);
    parent.addChild(placeholder);
    const marker = new ActiveHeroMarker(parent);
    marker.show(placeholder);
    const arrows = () => parent.children.filter(c => c !== placeholder && c !== art && c instanceof Graphics);
    const art = new Sprite(Texture.WHITE);
    art.position.set(1390, 380);           // its own place in line
    marker.replace(new Container(), art);  // not the marked sprite: nothing happens
    expect(marker.current).toBe(placeholder);
    marker.replace(placeholder, art);
    expect(marker.current).toBe(art);
    expect(art.x).toBe(1390 - ACTIVE_STEP);
    expect(arrows()).toHaveLength(1);
    marker.hide();
    expect(art.x).toBe(1390);
    expect(arrows()).toHaveLength(0);
  });

  it('in battle: the art arrives during the hero\'s turn and the new sprite is stepped forward and pulsing', async () => {
    let arrive: () => void = () => {};
    const loaded = new Promise<void>((r) => { arrive = r; });
    let artReady = false;
    vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(false);
    vi.spyOn(battleArt, 'load').mockReturnValue(loaded);
    vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(false);
    const frames: BattleFrames = { frames: BATTLE_POSES.map(() => Texture.WHITE), scale: 2, cell: [80, 80], footRow: 70 };
    vi.spyOn(characterAtlas, 'getBattleFrames').mockImplementation(() => (artReady ? frames : null));

    const input = createMockInput();
    const party = ['KNIGHT', 'THIEF'].map(name => new Character({ name, classData: fighter }));
    const scene = new BattleScene(createMockBattleSceneDeps(input), { party, enemies: [harmless], rng: () => 0.5 });
    scene.enter();
    tick(scene, input, 'confirm'); // skip the intro
    for (let i = 0; i < COMMAND_CONFIRM_GUARD_FRAMES; i++) tick(scene, input);
    const placeholder = scene.partySprites[0];
    expect(placeholder).toBeInstanceOf(Graphics);

    artReady = true;
    arrive();
    await new Promise((r) => setTimeout(r, 0));   // let the display's `load().then(upgradeToArt)` run

    const sprite = scene.partySprites[0];
    expect(sprite).toBeInstanceOf(Sprite);
    expect(sprite.parent).toBe(scene.container);
    expect(sprite.x).toBe(partySpritePosition(0, frames).x - ACTIVE_STEP);   // stepped forward from its place
    expect(scene.partySprites[1].x).toBe(partySpritePosition(1, frames).x); // the other member stays in line
    const tints = new Set<number>();
    for (let i = 0; i < 60; i++) { tick(scene, input); tints.add(sprite.tint); }
    expect(tints.size).toBeGreaterThan(2);  // the pulse runs on the new sprite
    expect(sprite.alpha).toBe(1);
    tick(scene, input, 'confirm'); // Fight
    tick(scene, input, 'confirm'); // the target: the next member's turn, and the new sprite steps back into line
    expect(sprite.x).toBe(partySpritePosition(0, frames).x);
    expect(sprite.tint).toBe(0xffffff);
    expect(scene.partySprites[1].x).toBe(partySpritePosition(1, frames).x - ACTIVE_STEP);
  });
});
