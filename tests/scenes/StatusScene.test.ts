import { describe, it, expect, beforeAll } from 'vitest';
import { StatusScene } from '../../src/scenes/StatusScene.js';
import type { Game } from '../../src/core/Game.js';
import { Character } from '../../src/entities/Character.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { SpellRegistry } from '../../src/data/SpellRegistry.js';
import { xpToReach } from '../../src/entities/ExperienceTable.js';
import { loadRealRegistries, tapInput, visibleLabels } from '../helpers/realData.js';

beforeAll(loadRealRegistries);

function statusFor(...members: Character[]) {
  const party = new PartyManager();
  for (const m of members) party.add(m);
  const game = { party, input: tapInput(), scenes: { pop: () => {} } };
  const scene = new StatusScene(game as unknown as Game);
  scene.enter();
  const text = () => visibleLabels(scene.container).join('\n');
  return { scene, game, text };
}

describe('MS-7: Status screen', () => {
  it('shows the XP to the next level and the slot labels Weapon / Body / Shield / Helmet', () => {
    const war = new Character({ name: 'FGHTR', classData: ClassRegistry.getClass('warrior')!, level: 2, xp: xpToReach(2) + 10 });
    const { text } = statusFor(war);
    expect(text()).toContain(`Next: ${xpToReach(3) - xpToReach(2) - 10}`);
    for (const label of ['Weapon:', 'Body:', 'Shield:', 'Helmet:']) expect(text()).toContain(label);
    expect(text()).not.toContain('Armor:');
    expect(text()).not.toContain('Spells:');
  });

  it('lists learned spells with their level charges', () => {
    const wm = new Character({ name: 'WHITE', classData: ClassRegistry.getClass('white_mage')! });
    expect(wm.learnSpell('cure', 1)).toBe(true);
    wm.setSpellCharges(1, 1);
    const { text } = statusFor(wm);
    const cure = SpellRegistry.getSpell('cure')!.name;
    expect(text()).toContain('Spells:');
    expect(text()).toMatch(new RegExp(`L1 1/${wm.getMaxCharges(1)}\\s+${cure}`));
  });

  it('left/right switches the member', () => {
    const a = new Character({ name: 'AAA', classData: ClassRegistry.getClass('warrior')! });
    const b = new Character({ name: 'BBB', classData: ClassRegistry.getClass('white_mage')! });
    const { scene, game, text } = statusFor(a, b);
    expect(text()).toContain('AAA (1/2)');
    game.input.tap('right', () => scene.update(1));
    expect(text()).toContain('BBB (2/2)');
  });
});
