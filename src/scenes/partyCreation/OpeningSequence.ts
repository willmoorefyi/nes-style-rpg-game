import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import type { InputManager } from '../../core/InputManager.js';
import type { GameFlags } from '../../core/GameFlags.js';
import type { Character } from '../../entities/Character.js';
import { CutsceneManager, type CutsceneScript } from '../../systems/CutsceneManager.js';
import { CutsceneRegistry } from '../../systems/CutsceneRegistry.js';
import { FadeOverlay } from '../../rendering/FadeOverlay.js';
import { DialogBox } from '../../ui/DialogBox.js';
import { DialogManager } from '../../systems/DialogManager.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../../core/LayoutConstants.js';
import { backdropCover } from '../../rendering/BattleBackground.js';

/** The cutscene played after the party is made (N2; its text lives in `cutscenes.yaml`). */
export const OPENING_CUTSCENE = 'opening';

export interface OpeningDeps {
  showDialog: (text: string) => Promise<void>;
  fadeOut: (ms: number) => Promise<void>;
  fadeIn: (ms: number) => Promise<void>;
  /** Show `assets/backgrounds/<image>.webp` full screen behind the dialog, or clear it for null. */
  backdrop: (image: string | null) => Promise<void>;
  flags: GameFlags;
  party: Character[];
}

/**
 * Run `script` (default: the registry's `opening`) once through CutsceneManager; its `backdrop` steps go to
 * `deps.backdrop`. A missing script logs an error and returns at once (the game goes straight to the field).
 */
export async function playOpening(deps: OpeningDeps, script: CutsceneScript | undefined = CutsceneRegistry.get(OPENING_CUTSCENE)): Promise<void> {
  if (!script) {
    console.error(`No "${OPENING_CUTSCENE}" cutscene in cutscenes.yaml; starting in the field`);
    return;
  }
  const { showDialog, fadeOut, fadeIn, backdrop, flags, party } = deps;
  await new CutsceneManager({ showDialog, fadeOut, fadeIn, backdrop, flags, party }).play(script);
}

/** A staged background as the opening shows it: no message window above, so its padded top band is cut off. */
export function backdropSprite(tex: Texture): Sprite {
  const sprite = new Sprite(tex);
  const { x, y, scale } = backdropCover(tex.width, tex.height, GAME_WIDTH, GAME_HEIGHT);
  sprite.scale.set(scale);
  sprite.position.set(x, y);
  return sprite;
}

/** The opening's layers (backdrop, fade, dialog) and the plumbing between the dialog box and the cutscene. */
export class OpeningSequence {
  readonly layer = new Container();
  private readonly backdropLayer = new Container();
  private readonly fade = new FadeOverlay();
  private readonly dialogBox: DialogBox;
  private readonly dialogManager: DialogManager;
  private dialogResolve: (() => void) | null = null;

  constructor() {
    this.dialogBox = new DialogBox({ onComplete: () => this.dialogManager.advance() });
    this.dialogBox.visible = false;
    this.dialogManager = new DialogManager(this.dialogBox);
    // dialog above the fade, so it stays readable over a black screen
    this.layer.addChild(this.backdropLayer, this.fade.overlay, this.dialogBox);
  }

  /** Clear everything (a later New Game must start visible). */
  reset(): void {
    this.fade.overlay.alpha = 0;
    this.dialogManager.clear();
    this.dialogResolve = null;
    this.backdropLayer.removeChildren();
  }

  /** Advance the dialog on input while the opening plays. */
  update(dt: number, input: InputManager): void {
    if (!this.dialogManager.isActive) return;
    this.dialogManager.update(dt, input);
    if (!this.dialogManager.isActive && this.dialogResolve) {
      const resolve = this.dialogResolve;
      this.dialogResolve = null;
      resolve();
    }
  }

  /** Play the opening; it ends on a black screen for the field to fade in from. */
  async play(flags: GameFlags, party: Character[]): Promise<void> {
    await playOpening({
      showDialog: (text) => new Promise<void>((resolve) => {
        this.dialogManager.start([text]);
        this.dialogResolve = resolve;
      }),
      fadeOut: (ms) => this.fade.fadeOut(ms),
      fadeIn: (ms) => this.fade.fadeIn(ms),
      backdrop: (image) => this.showBackdrop(image),
      flags,
      party,
    });
    this.backdropLayer.removeChildren();
    this.fade.overlay.alpha = 1;
  }

  private async showBackdrop(image: string | null): Promise<void> {
    this.backdropLayer.removeChildren();
    if (image === null) return;
    const path = `assets/backgrounds/${image}.webp`;
    try {
      this.backdropLayer.addChild(backdropSprite(await Assets.load<Texture>(path)));
    } catch (e) {
      console.error(`Opening backdrop ${path} failed to load`, e);
    }
  }
}
