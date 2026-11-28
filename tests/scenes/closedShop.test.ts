/** Pass EQ D-EQ8: a closed shop (one FF1 lacks) never opens; an open one still does. */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { openShopScene } from '../../src/scenes/exploration/FieldSystems.js';
import type { Game } from '../../src/core/Game.js';
import { createMockGame } from '../helpers/testUtils.js';
import { loadRealRegistries } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

describe('EQ: closed shops', () => {
  it.each(['onrac_weapon', 'onrac_armor', 'melmond_item', 'dwarf_item'])('%s registers and pushes nothing', (id) => {
    const game = createMockGame();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    openShopScene(game as unknown as Game, id);
    expect(game.scenes.register).not.toHaveBeenCalled();
    expect(game.scenes.push).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(`Shop ${id} is closed`);
    info.mockRestore();
  });

  it('an open shop still opens', () => {
    const game = createMockGame();
    openShopScene(game as unknown as Game, 'onrac_item');
    expect(game.scenes.push).toHaveBeenCalledWith('_shop_onrac_item');
  });
});
