/**
 * B3 (docs/FIX_PLAN_PENINSULA.md R2): a spell is announced once, by its name (not "casts fire!" then "casts FIRE!"),
 * and an item is named ("W.MAG uses Potion!", not "uses item!"). Runs the real state machine under the controller.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { BattleAnimationController } from '../../../src/scenes/battle/BattleAnimationController.js';
import { BattleStateMachine } from '../../../src/battle/BattleStateMachine.js';
import { Character } from '../../../src/entities/Character.js';
import { Inventory } from '../../../src/entities/Inventory.js';
import { ClassRegistry } from '../../../src/data/ClassRegistry.js';
import { loadRealRegistries } from '../../helpers/realData.js';
import { enemyCopy, SPELLS } from '../../helpers/balanceData.js';
import type { BattleDisplayManager } from '../../../src/scenes/battle/BattleDisplayManager.js';
import type { InputManager } from '../../../src/core/InputManager.js';
import type { Window } from '../../../src/ui/Window.js';
import type { BattleCommand } from '../../../src/battle/BattleCommands.js';

beforeAll(async () => { await loadRealRegistries(); });

const box = (x: number) => { const g = new Graphics(); g.rect(0, 0, 160, 160).fill(0xffffff); g.position.set(x, 300); return g; };

/** One round: `commands(bsm)` for the party, then the controller plays it; returns every message-window line. */
function play(party: Character[], commands: BattleCommand[], inventory?: Inventory): string[] {
  const goblin = enemyCopy('goblin');
  goblin.stats.hp = 999; // it survives, so the round plays out
  goblin.stats.agility = 0;
  const bsm = new BattleStateMachine({ party, enemies: [goblin], spells: SPELLS, inventory }, () => 0.5);
  bsm.startBattle();
  bsm.advanceFromIntro();
  bsm.allEnemies[0].status.apply('sleep'); // the goblin loses its turn: only the party's lines
  for (const c of commands) bsm.submitCommand(c);
  bsm.prepareRound();
  const main = new Container();
  const display = {
    enemySprites: [box(400)], partySprites: party.map((_, i) => box(1400 + i * 40)), enemyView: null,
    setActorPose: vi.fn(), flashHurt: vi.fn(), updatePartyDisplay: vi.fn(), updateEnemySprites: vi.fn(), updatePartySprites: vi.fn(),
  } as unknown as BattleDisplayManager;
  const win = { contentX: 0, contentY: 0, contentWidth: 292, contentHeight: 252, addChild: vi.fn(), removeChild: vi.fn() } as unknown as Window;
  const lines: string[] = [];
  const ctrl = new BattleAnimationController(main, bsm, display, { isJustPressed: () => false } as unknown as InputManager,
    win, new Container(), t => lines.push(t), vi.fn());
  for (let i = 0; i < 2000 && ctrl.animPhase !== 'round_end'; i++) ctrl.updateAnimating(1);
  return lines;
}

const member = (cls: string, name: string) => new Character({ name, classData: ClassRegistry.getClass(cls)! });

describe('B3: announcements', () => {
  it('FIRE is announced once by name, then its damage: ["B.MAG casts FIRE!", "Goblin takes N damage!"]', () => {
    const mage = member('black_mage', 'B.MAG');
    mage.learnSpell('fire', 1);
    const lines = play([mage], [{ type: 'magic', actorId: 'party_0', targetId: 'enemy_0', spellId: 'fire' }]);
    const goblinLines = lines.filter(t => t.startsWith('Goblin'));
    expect(lines.filter(t => / casts /i.test(t))).toEqual(['B.MAG casts FIRE!']);
    expect(lines.slice(0, 2)).toEqual(['B.MAG casts FIRE!', goblinLines[0]]);
    expect(goblinLines[0]).toMatch(/^Goblin takes \d+ damage!$/);
  });

  it('a Potion is named: "W.MAG uses Potion!", then "FGHTR recovers N HP!"', () => {
    const wm = member('white_mage', 'W.MAG');
    const fighter = member('warrior', 'FGHTR');
    fighter.currentHp = 5;
    const inventory = new Inventory();
    inventory.add('potion', 1);
    const lines = play([wm, fighter], [
      { type: 'item', actorId: 'party_0', targetId: 'party_1', itemId: 'potion' },
      { type: 'run', actorId: 'party_1' },
    ], inventory);
    const i = lines.indexOf('W.MAG uses Potion!');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(lines[i + 1]).toMatch(/^FGHTR recovers \d+ HP!$/);
    expect(lines.some(t => t.includes('uses item'))).toBe(false);
  });
});
