/**
 * F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 3): the battle draws bg < ui < actors < fx (status < spell < flash <
 * numbers) < hud, so nothing on the field (a travelling or tall enemy) ever covers the message text.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { BattleScene } from '../../../src/scenes/BattleScene.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { Window } from '../../../src/ui/Window.js';
import { TextRenderer } from '../../../src/ui/TextRenderer.js';
import { Character } from '../../../src/entities/Character.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { createMockBattleSceneDeps, testClass, testEnemy } from '../../helpers/testUtils.js';
import { descendants } from '../../helpers/battleLayers.js';
import { GAME_WIDTH } from '../../../src/core/LayoutConstants.js';
import { BATTLE_MESSAGE_HEIGHT } from '../../../src/scenes/battle/BattleSceneTypes.js';

afterEach(() => { vi.restoreAllMocks(); });

/** Every node under `root` in draw order (depth first, children in order). */
function drawOrder(root: Container): Container[] {
  return [root, ...descendants(root, (c): c is Container => c instanceof Container)];
}

function scene(): { scene: BattleScene; layers: BattleLayers } {
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
  const party = ['WAR', 'THF'].map((name) => new Character({ name, classData: testClass() }));
  const s = new BattleScene(createMockBattleSceneDeps(), { party, enemies: [testEnemy(), testEnemy({ size: 'boss' })], rng: () => 0.5 });
  s.enter();
  return { scene: s, layers: BattleLayers.of(s.container) };
}

describe('battle layers', () => {
  it('the scene container holds bg, ui, actors, fx, hud in that order; fx holds status, spell, flash, numbers', () => {
    const { scene: s, layers } = scene();
    expect(s.container.children).toEqual([layers.bg, layers.ui, layers.actors, layers.fx, layers.hud]);
    expect(s.container.children.map((c) => c.label)).toEqual(['bg', 'ui', 'actors', 'fx', 'hud']);
    expect(layers.fx.children).toEqual([layers.fx.status, layers.fx.spell, layers.fx.flash, layers.fx.numbers]);
    expect(s.container.children[s.container.children.length - 1]).toBe(layers.hud);
  });

  it('the windows are in ui (enemy list, command, party panel) and hud (the message window); sprites in actors, enemies first', () => {
    const { scene: s, layers } = scene();
    expect(layers.ui.children.filter((c) => c instanceof Window)).toHaveLength(3);
    const hudWindows = layers.hud.children.filter((c): c is Window => c instanceof Window);
    expect(hudWindows).toHaveLength(1);
    expect(descendants(hudWindows[0], (c): c is TextRenderer => c instanceof TextRenderer)).toHaveLength(1);
    const actors = layers.actors.children;
    expect(actors).toHaveLength(4);
    s.partySprites.forEach((p) => expect(actors.indexOf(p)).toBeGreaterThanOrEqual(2));
  });

  it('a sprite in actors that overlaps the message window is drawn below the message text', () => {
    const { layers } = scene();
    const tall = new Graphics().rect(0, 0, 400, 400).fill(0xff0000);
    tall.position.set(200, -100);           // a boss head reaching over the top window
    layers.actors.addChild(tall);
    const message = layers.hud.children.find((c): c is Window => c instanceof Window)!;
    const text = descendants(message, (c): c is TextRenderer => c instanceof TextRenderer)[0];
    const a = tall.getBounds();
    const m = { x: message.x, y: message.y, width: GAME_WIDTH, height: BATTLE_MESSAGE_HEIGHT };  // the window's rect
    expect(a.x < m.x + m.width && m.x < a.x + a.width && a.y < m.y + m.height && m.y < a.y + a.height).toBe(true);
    const order = drawOrder(layers.root);
    expect(order.indexOf(tall)).toBeLessThan(order.indexOf(message));
    expect(order.indexOf(tall)).toBeLessThan(order.indexOf(text));
  });

  it('BattleLayers.of builds the layers once per container and runs the update hooks until removed', () => {
    const root = new Container();
    const old = new Container();
    root.addChild(old);
    const layers = BattleLayers.of(root);
    expect(BattleLayers.of(root)).toBe(layers);
    expect(root.children[0]).toBe(old);     // what a plain container already held stays below
    const seen: number[] = [];
    const off = layers.onUpdate((dt) => seen.push(dt));
    layers.update(1);
    off();
    layers.update(2);
    expect(seen).toEqual([1]);
    root.removeChildren();
    expect(BattleLayers.of(root)).not.toBe(layers);   // rebuilt after the scene cleared its container
  });
});
