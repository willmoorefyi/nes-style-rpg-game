import { Container, Graphics, Sprite } from 'pixi.js';
import { createFloatingNumber, floatPlacement, FLOAT_FRAMES, type FloatKind } from './floatingNumbers.js';
import { BattleLayers } from './BattleLayers.js';
import { stepAlpha } from './fx/emitterCore.js';
import { stoneTextures } from './fx/stoneTextures.js';

export const ELEMENT_COLORS: Record<string, number> = {
  fire: 0xff4400, ice: 0x4488ff, lightning: 0xffff00, holy: 0xffffff, dark: 0x660066,
  water: 0x0066ff, earth: 0x886622, wind: 0x88ff88, heal: 0x44ff44,
};

/** The impact glow's starting alpha (an element-coloured copy of the target's silhouette). */
const FLASH_ALPHA = 0.75;

/** Frames a dying enemy takes to fade out. */
export const DYING_FRAMES = 30;

/**
 * Short-lived battle effects: floating numbers, spell and slash flashes, and the dying-enemy fade. Split out of
 * BattleAnimationController, which decides when they start. The element glow is the spell effects' impact flash
 * (fx/ActionFx.ts plays the build-up; the controller presents the number and this glow at the effect's impact).
 */
export class BattleEffects {
  readonly floatingTexts: { text: Container; age: number; maxAge: number; minY: number | null }[] = [];
  readonly dyingEnemies: Map<number, number> = new Map();
  readonly spellFlashes: { overlay: Container; age: number; maxAge: number; follow?: Container }[] = [];

  private readonly layers: BattleLayers;

  /** `mainContainer`: the battle's layer root (a plain Container gets the layers built inside it). Floating numbers go
   *  in `fx.numbers`, flashes in `fx.flash`. */
  constructor(mainContainer: Container, private readonly enemySprites: () => Container[]) {
    this.layers = BattleLayers.of(mainContainer);
  }

  /** `iconRowBottom`: the bottom of the target's status icon row in the sprite's space (null: no icon, F6). */
  addFloating(label: string, kind: FloatKind, sprite: Container, iconRowBottom: number | null = null): void {
    const { y, minY } = floatPlacement(sprite.y, iconRowBottom);
    const text = createFloatingNumber(label, kind, sprite, y);
    this.layers.fx.numbers.addChild(text);
    this.floatingTexts.push({ text, age: 0, maxAge: FLOAT_FRAMES, minY });
  }

  addFlash(overlay: Container, maxAge: number, follow?: Container): void {
    this.layers.fx.flash.addChild(overlay);
    this.spellFlashes.push({ overlay, age: 0, maxAge, follow });
  }

  /** A coloured glow over `sprite` (its silhouette when it is art, else a box) for a spell's element. */
  elementFlash(sprite: Container, element: string): void {
    const color = ELEMENT_COLORS[element] ?? 0xffffff;
    let overlay: Container;
    if (sprite instanceof Sprite) {
      // the coloured frame, not a stoned actor's grey copy, so a hit on stone still reads
      const glow = new Sprite(stoneTextures.coloured(sprite.texture));
      glow.tint = color;
      glow.scale.copyFrom(sprite.scale);
      overlay = glow;
    } else {
      const box = new Graphics();
      box.rect(0, 0, sprite.width, sprite.height).fill(color);
      overlay = box;
    }
    overlay.position.set(sprite.x, sprite.y);
    overlay.alpha = FLASH_ALPHA;
    this.addFlash(overlay, 18, sprite);
  }

  updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      ft.text.y -= 1 * dt;
      if (ft.minY !== null && ft.text.y < ft.minY) ft.text.y = ft.minY;
      ft.text.alpha = 1 - ft.age / ft.maxAge;
      if (ft.age >= ft.maxAge) {
        ft.text.parent?.removeChild(ft.text);
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
      // the effects' pixel rule: stepped fades (0.75, 0.5, 0.25), never a smooth ramp
      sf.overlay.alpha = stepAlpha(FLASH_ALPHA * (1 - sf.age / sf.maxAge));
      // follow the sprite (lunge, shake) and its current pose frame
      if (sf.follow) {
        sf.overlay.position.set(sf.follow.x, sf.follow.y);
        if (sf.overlay instanceof Sprite && sf.follow instanceof Sprite) sf.overlay.texture = stoneTextures.coloured(sf.follow.texture);
      }
      if (sf.age >= sf.maxAge) {
        sf.overlay.parent?.removeChild(sf.overlay);
        this.spellFlashes.splice(i, 1);
      }
    }
  }
}
