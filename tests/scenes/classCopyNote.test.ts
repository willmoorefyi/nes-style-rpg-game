/**
 * Plan 17 (docs/CLASS_BARBARIAN_PLAN.md): the class pick screen names the classic class a copy class plays as
 * ("Plays as: Thief" on the preview's second line, blank for an original), read from classes.yaml's `copyOf`; the
 * note moves no line and not the pose.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BitmapText, Container, Sprite } from 'pixi.js';
import { buildClassPreview } from '../../src/scenes/partyCreation/PartyCreationViews.js';
import { PartyCreationScene } from '../../src/scenes/PartyCreationScene.js';
import { ClassRegistry } from '../../src/data/ClassRegistry.js';
import { GameFlags } from '../../src/core/GameFlags.js';
import { PartyManager } from '../../src/entities/PartyManager.js';
import type { Game } from '../../src/core/Game.js';
import { loadRealRegistries, tapInput } from '../helpers/realData.js';

const texts = (c: Container): BitmapText[] => c.children.flatMap((ch) => [
  ...('text' in ch ? [ch as BitmapText] : []), ...texts(ch as Container)]);
const lines = (c: Container) => texts(c).map((t) => [t.text, t.y] as const);

describe('plan 17: the copy note on the class pick screen', () => {
  beforeAll(loadRealRegistries);
  afterEach(() => { vi.unstubAllGlobals(); });

  it('a copy says "Plays as: <original>" on the blank second line; an original keeps it blank; nothing else moves', () => {
    const hunter = ClassRegistry.getClass('hunter')!, thief = ClassRegistry.getClass('thief')!;
    expect(hunter.copyOf).toBe('thief');
    expect(thief.copyOf).toBeUndefined();
    const copy = lines(buildClassPreview(hunter, null, null, thief.name));
    const orig = lines(buildClassPreview(thief));
    expect(copy[1]).toEqual(['Plays as: Thief', orig[1][1]]);
    expect(orig[1][0]).toBe('');
    expect(copy.map(([, y]) => y)).toEqual(orig.map(([, y]) => y));
    expect(copy.slice(2)).toEqual(orig.slice(2));
  });

  it('the pose stands where it stands for an original', () => {
    const hunter = ClassRegistry.getClass('hunter')!, thief = ClassRegistry.getClass('thief')!;
    const pose = (c: Container) => c.children.find((ch) => ch.label === 'classPose') as Sprite | undefined;
    const tex = { width: 160, height: 160 } as unknown as import('pixi.js').Texture;
    const a = pose(buildClassPreview(hunter, tex, null, 'Thief')), b = pose(buildClassPreview(thief, tex));
    expect([a?.x, a?.y]).toEqual([b?.x, b?.y]);
  });

  it('the scene shows the note for every copy base class and for no original, by copyOf', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const input = tapInput();
    const game = { input, events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() }, scenes: { switchTo: vi.fn() },
      resetState: vi.fn(), gameFlags: new GameFlags(), party: new PartyManager() };
    const scene = new PartyCreationScene(game as unknown as Game);
    scene.enter();
    const base = ClassRegistry.getAll().filter((c) => !c.upgradeFrom);
    for (const cls of base) {
      expect(scene.classIndex).toBe(base.indexOf(cls));
      const note = texts(scene.container).map((t) => t.text).filter((t) => t.startsWith('Plays as:'));
      expect(note, cls.id).toEqual(cls.copyOf ? [`Plays as: ${ClassRegistry.getClass(cls.copyOf)!.name}`] : []);
      input.tap('down', () => scene.update(1));
    }
  });
});
