/** F0 (docs/FEEDBACK_PLAN_2026-11-14.md §2 item 9): one multiplying tint per actor, one colour per named source. */
import { describe, it, expect } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { combinedTint, multiplyTint, setTint, tintOf } from '../../../src/scenes/battle/actorTint.js';
import { ActiveHeroMarker } from '../../../src/scenes/battle/ActiveHeroMarker.js';
import { statusTint } from '../../../src/scenes/battle/fx/statusRules.js';
import { loadStatusVisuals } from '../../helpers/statusVisuals.js';

describe('actorTint', () => {
  it('the tint is the channel-wise product of every source; white with none', () => {
    const s = new Container();
    expect(combinedTint(s)).toBe(0xffffff);
    setTint(s, 'status', 0xc8ffc8);
    setTint(s, 'hero', 0xffffa0);
    expect(s.tint).toBe(multiplyTint(0xc8ffc8, 0xffffa0));
    expect(s.tint).toBe(0xc8ff7d);       // b: 0xc8 * 0xa0 / 0xff
    expect(multiplyTint(0x808080, 0x808080)).toBe(0x404040);
    expect(multiplyTint(0xffffff, 0x123456)).toBe(0x123456);
  });

  it('clearing one source keeps the others', () => {
    const s = new Container();
    setTint(s, 'dead', 0x666666);
    setTint(s, 'pulse', 0xffb0b0);
    setTint(s, 'pulse', null);
    expect(s.tint).toBe(0x666666);
    expect(tintOf(s, 'pulse')).toBeNull();
    expect(tintOf(s, 'dead')).toBe(0x666666);
    setTint(s, 'dead', null);
    expect(s.tint).toBe(0xffffff);
  });

  it('the active-hero pulse goes through it: hiding the marker clears only the hero source (old: reset to white)', () => {
    const parent = new Container();
    const sprite = new Graphics().rect(0, 0, 10, 10).fill(0xffffff);
    parent.addChild(sprite);
    setTint(sprite, 'status', 0xd8e4ff);
    const marker = new ActiveHeroMarker(parent);
    marker.show(sprite);
    for (let i = 0; i < 10; i++) marker.update(1);
    expect(tintOf(sprite, 'hero')).not.toBeNull();
    expect(sprite.tint).toBe(multiplyTint(0xd8e4ff, tintOf(sprite, 'hero')!));
    marker.hide();
    expect(sprite.tint).toBe(0xd8e4ff);
  });

  it('Fe: the status tints (statusRules.statusTint) multiply with the hero pulse; clearing poison leaves the hero pulse', () => {
    const visuals = loadStatusVisuals();
    const s = new Container();
    setTint(s, 'hero', 0xffffa0);
    setTint(s, 'status', statusTint(['poison', 'fear'], visuals, 0));
    expect(s.tint).toBe(multiplyTint(multiplyTint(0xffffa0, 0xc8ffc8), 0xd8e4ff));
    setTint(s, 'status', statusTint(['poison'], visuals, 30));     // the poison pulse is off at frame 30
    expect(s.tint).toBe(0xffffa0);
    setTint(s, 'status', statusTint([], visuals, 0));
    expect(s.tint).toBe(0xffffa0);
    expect(tintOf(s, 'hero')).toBe(0xffffa0);
  });
});
