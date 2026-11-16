/**
 * The synthetic colossus fixture (tests/fixtures/colossus, R22): its index, a texture io that makes blank textures of
 * the tiles' sizes (no images, no renderer), and enemy records that draw a fixture form.
 */
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { Character } from '../../src/entities/Character.js';
import { BattleStateMachine } from '../../src/battle/BattleStateMachine.js';
import { BattleDisplayManager } from '../../src/scenes/battle/BattleDisplayManager.js';
import { BattleAnimationController } from '../../src/scenes/battle/BattleAnimationController.js';
import { Window } from '../../src/ui/Window.js';
import { battleArt } from '../../src/rendering/BattleArt.js';
import { characterAtlas } from '../../src/rendering/CharacterAtlas.js';
import type { InputManager } from '../../src/core/InputManager.js';
import { ENEMY_WINDOW, STRIP_HEIGHT, STRIP_Y } from '../../src/scenes/battle/BattleSceneTypes.js';
import { Container, Texture, TextureSource } from 'pixi.js';
import type { EnemyData } from '../../src/types/index.js';
import { ColossusArt, type ColossusIo } from '../../src/rendering/ColossusArt.js';
import { readColossusIndex, type ColossusIndex } from '../../src/scenes/battle/colossus/colossusIndex.js';
import { createMockInput, testClass, testEnemy } from './testUtils.js';

export const FIXTURE_DIR = 'tests/fixtures/colossus/';
export const HORIZON = 'fixture_horizon';
export const ORRERY = 'fixture_orrery';
export const WIDE = 'fixture_wide';
/** The rev-4 json contract shared with the Python build (18.5): one form, no tiles on disk. */
export const CONTRACT = 'contract_form';

export function contractRaw(): unknown {
  return JSON.parse(readFileSync(`${FIXTURE_DIR}contract.json`, 'utf8'));
}

export function fixtureRaw(): unknown {
  return JSON.parse(readFileSync(`${FIXTURE_DIR}colossus.json`, 'utf8'));
}

export function fixtureIndex(): ColossusIndex {
  return readColossusIndex(fixtureRaw());
}

const blank = (w: number, h: number): Texture => new Texture({ source: new TextureSource({ width: w, height: h }) });

/** An io whose textures are blank sources of the requested size; it records every texture it made. */
export function fixtureIo(raw: unknown = fixtureRaw()): ColossusIo & { made: Texture[] } {
  const made: Texture[] = [];
  return {
    made,
    fetchIndex: () => Promise.resolve(raw),
    load: (_file, w, h) => { const t = blank(w, h); made.push(t); return Promise.resolve(t); },
    unload: (_file, t) => { t.destroy(true); },
  };
}

/** A fresh art source on the fixture, every form loaded. */
export async function fixtureArt(forms: string[] = [HORIZON, ORRERY, WIDE]): Promise<ColossusArt> {
  const art = new ColossusArt(fixtureIo());
  await art.ensure(forms);
  return art;
}

/** An enemy record that draws a colossus form (TS-B's `colossus:` field, plan 3.6). */
export function colossusEnemy(form = HORIZON, overrides: Partial<EnemyData> = {}): EnemyData & { colossus: string } {
  return { ...testEnemy({ id: `chaos_${form}`, name: 'Chaos', size: 'boss', sprite: '', stats: { hp: 6000 }, ...overrides }), colossus: form };
}

/** Install the fixture on the shared art source (the battle's default); returns the uninstall for afterEach. */
export async function installFixtureArt(forms: string[] = [HORIZON, ORRERY]): Promise<() => void> {
  const { colossusArt } = await import('../../src/rendering/ColossusArt.js');
  const restore = colossusArt.setIo(fixtureIo());
  await colossusArt.ensure(forms);
  return () => { colossusArt.release(); restore(); };
}

/** A real battle (state machine, display, animation controller) against `enemies`, with the fixture art installed by
 *  the caller (installFixtureArt) and atlas art mocked away. */
export function colossusBattle(enemies: EnemyData[] = [colossusEnemy()], partySize = 2) {
  vi.spyOn(battleArt, 'isLoaded', 'get').mockReturnValue(true);
  vi.spyOn(characterAtlas, 'hasBattleArt', 'get').mockReturnValue(true);
  vi.spyOn(battleArt, 'getMonsterFrames').mockReturnValue(null);
  const party = Array.from({ length: partySize }, (_, i) => new Character({ name: `H${i}`, classData: testClass() }));
  const battle = new BattleStateMachine({ party, enemies, spells: [] }, () => 0.5);
  const main = new Container();
  const win = new Window({ x: ENEMY_WINDOW.x, y: STRIP_Y, width: ENEMY_WINDOW.width, height: STRIP_HEIGHT });
  const display = new BattleDisplayManager(main, battle, { party, enemies }, win);
  display.createEnemySprites();
  display.createPartySprites();
  display.updatePartyDisplay();
  const input = createMockInput();
  const ctrl = new BattleAnimationController(main, battle, display, input as unknown as InputManager, win, new Container(), () => {}, vi.fn());
  return { battle, display, ctrl, main, layers: display.layers, input, party };
}
