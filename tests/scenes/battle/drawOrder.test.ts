/**
 * With an F3-like colossus active (docs/CHAOS_FORMS_PLAN.md 4.1, 9.2): the party sprites, the bottom-strip windows
 * and the message window are all above the colossus in the scene graph, and `floorFront` is above the colossus art.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Container } from 'pixi.js';
import { BattleScene } from '../../../src/scenes/BattleScene.js';
import { BattleLayers } from '../../../src/scenes/battle/BattleLayers.js';
import { Window } from '../../../src/ui/Window.js';
import { battleArt } from '../../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../../src/rendering/CharacterAtlas.js';
import { Character } from '../../../src/entities/Character.js';
import { colossusEnemy, installFixtureArt } from '../../helpers/colossusFixture.js';
import { createMockBattleSceneDeps, testClass } from '../../helpers/testUtils.js';
import { descendants } from '../../helpers/battleLayers.js';

let uninstall: () => void = () => {};
afterEach(() => { uninstall(); vi.restoreAllMocks(); });

describe('draw order with a colossus', () => {
  it('party, strip windows and the message window draw over the colossus; floorFront over its art', async () => {
    uninstall = await installFixtureArt();
    vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
    vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
    vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
    const party = ['WAR', 'THF', 'WHM', 'BLM'].map((name) => new Character({ name, classData: testClass() }));
    const s = new BattleScene(createMockBattleSceneDeps(), { party, enemies: [colossusEnemy()], rng: () => 0.5 });
    s.enter();
    const layers = BattleLayers.of(s.container);
    const order = [s.container, ...descendants(s.container, (c): c is Container => c instanceof Container)];
    const art = descendants(layers.colossus, (c): c is Container => c.label === 'colossus.art')[0];
    const floor = descendants(layers.colossus, (c): c is Container => c.label === 'colossus.floorFront')[0];
    expect(art).toBeDefined();
    expect(order.indexOf(floor)).toBeGreaterThan(order.indexOf(art));
    const top = Math.max(...descendants(layers.colossus, (_c): _c is Container => true).map((c) => order.indexOf(c)));
    const windows = [...layers.ui.children, ...layers.hud.children].filter((c): c is Window => c instanceof Window);
    expect(windows).toHaveLength(4);
    for (const w of windows) expect(order.indexOf(w)).toBeGreaterThan(top);
    for (const p of s.partySprites) expect(order.indexOf(p)).toBeGreaterThan(top);
    s.exit();
  });
});
