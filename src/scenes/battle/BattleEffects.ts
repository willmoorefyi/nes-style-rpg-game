import { Container, Graphics, Sprite } from 'pixi.js';
import { createFloatingNumber, FLOAT_FRAMES, type FloatKind } from './floatingNumbers.js';

export const ELEMENT_COLORS: Record<string, number> = {
  fire: 0xff4400, ice: 0x4488ff, lightning: 0xffff00, holy: 0xffffff, dark: 0x660066,
  water: 0x0066ff, earth: 0x886622, wind: 0x88ff88, heal: 0x44ff44,
};

/** Frames a dying enemy takes to fade out. */
export const DYING_FRAMES = 30;

/**
 * Short-lived battle effects: floating numbers, spell and slash flashes, and the dying-enemy fade. Split out of
 * BattleAnimationController, which decides when they start.
 */
export class BattleEffects {
  readonly floatingTexts: { text: Container; age: number; maxAge: number }[] = [];
  readonly dyingEnemies: Map<number, number> = new Map();
  readonly spellFlashes: { overlay: Container; age: number; maxAge: number; follow?: Container }[] = [];

  constructor(private readonly mainContainer: Container, private readonly enemySprites: () => Container[]) {}

  addFloating(label: string, kind: FloatKind, sprite: Container): void {
    const text = createFloatingNumber(label, kind, sprite);
    this.mainContainer.addChild(text);
    this.floatingTexts.push({ text, age: 0, maxAge: FLOAT_FRAMES });
  }

  addFlash(overlay: Container, maxAge: number, follow?: Container): void {
    this.mainContainer.addChild(overlay);
    this.spellFlashes.push({ overlay, age: 0, maxAge, follow });
  }

  /** A coloured glow over `sprite` (its silhouette when it is art, else a box) for a spell's element. */
  elementFlash(sprite: Container, element: string): void {
    const color = ELEMENT_COLORS[element] ?? 0xffffff;
    let overlay: Container;
    if (sprite instanceof Sprite) {
      const glow = new Sprite(sprite.texture);
      glow.tint = color;
      glow.scale.copyFrom(sprite.scale);
      overlay = glow;
    } else {
      const box = new Graphics();
      box.rect(0, 0, sprite.width, sprite.height).fill(color);
      overlay = box;
    }
    overlay.position.set(sprite.x, sprite.y);
    overlay.alpha = 0.6;
    this.addFlash(overlay, 18, sprite);
  }

  updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      ft.text.y -= 1 * dt;
      ft.text.alpha = 1 - ft.age / ft.maxAge;
      if (ft.age >= ft.maxAge) {
        this.mainContainer.removeChild(ft.text);
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  updateDyingEnemies(dt: number): void {
    const sprites = this.enemySprites();
    for (const [idx, remaining] of this.dyingEnemies) {
      const next = remaining - dt;
      if (next <= 0) {
        sprites[idx].alpha = 0;
        sprites[idx].visible = false;
        this.dyingEnemies.delete(idx);
      } else {
        sprites[idx].alpha = next / DYING_FRAMES;
        this.dyingEnemies.set(idx, next);
      }
    }
  }

  updateSpellFlashes(dt: number): void {
    for (let i = this.spellFlashes.length - 1; i >= 0; i--) {
      const sf = this.spellFlashes[i];
      sf.age += dt;
      sf.overlay.alpha = 0.6 * (1 - sf.age / sf.maxAge);
      // follow the sprite (lunge, shake) and its current pose frame
      if (sf.follow) {
        sf.overlay.position.set(sf.follow.x, sf.follow.y);
        if (sf.overlay instanceof Sprite && sf.follow instanceof Sprite) sf.overlay.texture = sf.follow.texture;
      }
      if (sf.age >= sf.maxAge) {
        this.mainContainer.removeChild(sf.overlay);
        this.spellFlashes.splice(i, 1);
      }
    }
  }
}
