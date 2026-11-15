/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { DebugSandboxScene } from '../../../src/scenes/debugSandbox/DebugSandboxScene.js';
import { SandboxSession } from '../../../src/scenes/debugSandbox/sandboxSession.js';
import { BattleTrigger } from '../../../src/systems/BattleTrigger.js';
import { SaveManager } from '../../../src/systems/SaveManager.js';
import { TitleScene } from '../../../src/scenes/TitleScene.js';
import type { Game } from '../../../src/core/Game.js';
import { createMockGame } from '../../helpers/testUtils.js';
import { loadRealRegistries } from '../../helpers/realData.js';

const yaml = (f: string): unknown => parse(readFileSync(f, 'utf-8'));

function sandboxGame() {
  const game = createMockGame();
  Object.assign(game.assets, { loadYaml: vi.fn(async (path: string) => yaml(path)) });
  game.data.loadEnemies = vi.fn().mockResolvedValue(yaml('assets/data/enemies.yaml'));
  return Object.assign(game, {
    resetState: vi.fn(),
    party: { ...game.party, add: vi.fn(() => true), setGold: vi.fn() },
  });
}

describe('DebugSandboxScene', () => {
  beforeAll(async () => { await loadRealRegistries(); });
  afterEach(() => { window.history.replaceState({}, '', '/'); vi.restoreAllMocks(); });

  it('opens on Fight! and shows itself again after a battle hid it (switchTo after a push)', async () => {
    const scene = new DebugSandboxScene(sandboxGame() as unknown as Game, new SandboxSession());
    scene.container.visible = false;           // what SceneManager.push did when the battle went on top
    await scene.enter();
    expect(scene.container.visible).toBe(true);
    expect(scene.selectedRow).toBe('fight');
    expect(scene.rowLabels[0]).toContain('Lv1 fields');
  });

  it('the ?sandbox= deep link sets the configuration and fights on the first frame, once per page load', async () => {
    window.history.replaceState({}, '', '/?mute=1&sandbox=l3_garland&party=knight,thief,white_mage,black_mage&enemies=garland');
    const game = sandboxGame();
    const session = new SandboxSession();
    const trigger = vi.spyOn(BattleTrigger.prototype, 'triggerBattle').mockResolvedValue(undefined);
    const scene = new DebugSandboxScene(game as unknown as Game, session);
    await scene.enter();
    expect(scene.currentConfig).toMatchObject({ level: 'l3_garland', party: ['knight', 'thief', 'white_mage', 'black_mage'], custom: ['garland'] });
    scene.update(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger.mock.calls[0][0]).toEqual(['garland']);
    await scene.enter();                        // back from the battle: no second auto-start
    scene.update(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('X goes back to the title', async () => {
    const game = sandboxGame();
    game.input.isJustPressed = vi.fn((a: string) => a === 'cancel');
    const scene = new DebugSandboxScene(game as unknown as Game, new SandboxSession());
    await scene.enter();
    scene.update(1);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('title');
  });

  it('the title shows itself again when it is switched back to after the sandbox was pushed over it', () => {
    vi.spyOn(SaveManager, 'getSaveSlots').mockReturnValue([null, null, null]);
    const scene = new TitleScene(createMockGame() as unknown as Game);
    scene.container.visible = false;
    scene.enter();
    expect(scene.container.visible).toBe(true);
  });
});
