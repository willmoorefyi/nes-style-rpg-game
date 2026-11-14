import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { Character } from '../../src/entities/Character.js';
import type { DataLoader } from '../../src/core/DataLoader.js';
import type { CharacterClassData } from '../../src/types/index.js';
import { GameOverScene, WEAK_RETRY_HINT } from '../../src/scenes/GameOverScene.js';
import type { Game } from '../../src/core/Game.js';
import { createMockAudio } from '../helpers/testUtils.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { Inventory } from '../../src/entities/Inventory.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { captureBattleSnapshot } from '../../src/systems/BattleRetry.js';

function createGame() {
  const pressed = new Set<string>();
  const game = {
    scenes: { switchTo: vi.fn(), push: vi.fn() },
    input: {
      isPressed: vi.fn().mockReturnValue(false),
      isJustPressed: vi.fn((action: string) => pressed.has(action)),
    },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    audio: createMockAudio(),
    party: new PartyManager(),
    inventory: new Inventory(),
    gameFlags: new GameFlags(),
    currentMapId: 'temple-of-fiends',
    playerPosition: { x: 11, y: 6 },
    playTime: 50,
    pendingEntrance: null as string | null,
    battleRetry: null as ReturnType<typeof captureBattleSnapshot>,
    pendingBattle: null as unknown,
    restoreState(d: { party: PartyManager; inventory: Inventory; flags: GameFlags; currentMap: string;
      playerPosition: { x: number; y: number }; playTime: number }) {
      game.party = d.party; game.inventory = d.inventory; game.gameFlags = d.flags;
      game.currentMapId = d.currentMap; game.playerPosition = d.playerPosition; game.playTime = d.playTime;
    },
  };
  /** Press `keys` in order, one frame each. */
  const press = (scene: GameOverScene, ...keys: string[]) => {
    for (const k of keys) {
      pressed.clear(); pressed.add(k);
      scene.update(1);
    }
    pressed.clear();
  };
  return { game, press };
}

const garland = { enemyIds: ['garland'], bossConfig: { canRun: false, isBoss: true, flag: 'GARLAND_DEFEATED', postVictoryCutscene: 'garland_defeated' } };

beforeAll(async () => {
  ClassRegistry.reset();
  const classes = parse(readFileSync(new URL('../../assets/data/classes.yaml', import.meta.url), 'utf-8')) as CharacterClassData[];
  await ClassRegistry.init({ loadClasses: async () => classes } as unknown as DataLoader);
});

describe('GameOverScene', () => {
  it('without a retry snapshot offers Load Game and Title; Title returns to the title screen', () => {
    const { game, press } = createGame();
    const scene = new GameOverScene(game as unknown as Game);
    scene.enter();
    press(scene, 'down', 'confirm');
    expect(game.scenes.switchTo).toHaveBeenCalledWith('title');
  });

  it('Load Game opens the load menu', () => {
    const { game, press } = createGame();
    const scene = new GameOverScene(game as unknown as Game);
    scene.enter();
    press(scene, 'confirm');
    expect(game.scenes.push).toHaveBeenCalledWith('loadMenu');
  });

  it('does nothing until a choice is made', () => {
    const { game } = createGame();
    const scene = new GameOverScene(game as unknown as Game);
    scene.enter();
    scene.update(1);
    expect(game.scenes.switchTo).not.toHaveBeenCalled();
    expect(game.scenes.push).not.toHaveBeenCalled();
  });

  it('Retry Battle restores the game as it was when the battle began and queues the same battle', () => {
    const { game, press } = createGame();
    game.party.add(new Character({ name: 'WAR', classData: ClassRegistry.getClass('warrior')! }));
    game.party.all[0].currentHp = 20;           // hurt before the battle
    game.party.addGold(250);
    game.inventory.add('potion', 3);
    game.battleRetry = captureBattleSnapshot(game as unknown as Game, garland);
    // the battle went badly: gold spent, potions used, a flag changed
    game.party.setGold(0);
    game.party.all[0].currentHp = 0;
    game.inventory.remove('potion', 3);
    game.gameFlags.set('SOMETHING_ELSE');
    game.currentMapId = 'overworld';
    game.playTime = 99;

    const scene = new GameOverScene(game as unknown as Game);
    scene.enter();
    press(scene, 'confirm');   // Retry Battle is the first choice

    expect(game.party.gold).toBe(250);
    expect(game.party.all[0].currentHp).toBe(20);   // the HP it had when the battle began, not full
    expect(game.inventory.getQuantity('potion')).toBe(3);
    expect(game.gameFlags.has('SOMETHING_ELSE')).toBe(false);
    expect(game.currentMapId).toBe('temple-of-fiends');
    expect(game.playerPosition).toEqual({ x: 11, y: 6 });
    expect(game.playTime).toBe(99);            // play time keeps counting
    expect(game.pendingBattle).toEqual(garland);
    expect(game.scenes.switchTo).toHaveBeenCalledWith('exploration');
  });

  describe('U4: Return to Field and the weak-party hint', () => {
    /** A two-member party snapshot; the second member went in at `hp2` HP. */
    function withSnapshot(hp2: number) {
      const { game, press } = createGame();
      game.party.add(new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')! }));
      game.party.add(new Character({ name: 'THIEF', classData: ClassRegistry.getClass('thief')! }));
      game.party.all[1].currentHp = hp2;
      game.battleRetry = captureBattleSnapshot(game as unknown as Game, garland);
      game.party.all[0].currentHp = 0;
      game.party.all[1].currentHp = 0;
      return { game, press, snapHp: [game.battleRetry!.party.members[0].currentHp, hp2] };
    }

    it('a weak snapshot: four choices, the hint, the cursor on Return to Field', () => {
      const { game } = withSnapshot(1);
      const scene = new GameOverScene(game as unknown as Game);
      scene.enter();
      expect(scene.choices).toEqual(['Retry Battle', 'Return to Field', 'Load Game', 'Title']);
      expect(scene.hintText?.replace(/\s+/g, ' ')).toBe(WEAK_RETRY_HINT);
      expect(scene.selectedIndex).toBe(1);
    });

    it('Return to Field restores the snapshot with no battle queued', () => {
      const { game, press, snapHp } = withSnapshot(1);
      const scene = new GameOverScene(game as unknown as Game);
      scene.enter();
      press(scene, 'confirm');
      expect(game.party.all.map((m) => m.currentHp)).toEqual(snapHp);
      expect(game.pendingBattle).toBeNull();
      expect(game.currentMapId).toBe('temple-of-fiends');
      expect(game.scenes.switchTo).toHaveBeenCalledWith('exploration');
    });

    it('a healthy snapshot: no hint, the cursor on Retry Battle', () => {
      const { game } = withSnapshot(1000);
      const scene = new GameOverScene(game as unknown as Game);
      scene.enter();
      expect(scene.choices).toEqual(['Retry Battle', 'Return to Field', 'Load Game', 'Title']);
      expect(scene.hintText).toBeNull();
      expect(scene.selectedIndex).toBe(0);
    });

    it('no snapshot: no Retry Battle or Return to Field', () => {
      const { game } = createGame();
      const scene = new GameOverScene(game as unknown as Game);
      scene.enter();
      expect(scene.choices).toEqual(['Load Game', 'Title']);
      expect(scene.hintText).toBeNull();
    });
  });
});
