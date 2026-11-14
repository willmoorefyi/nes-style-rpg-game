import type { DialogBox } from '../ui/DialogBox.js';
import type { InputManager } from '../core/InputManager.js';

/** Frames after the field's last dialog line closes during which confirm can't start a new talk (400 ms; U12). */
export const DIALOG_CLOSE_HOLDOFF_FRAMES = 24;

export interface DialogManagerOptions {
  /** Hold confirm off for this many frames once the last dialog closes (nothing queued); 0 or unset: no hold-off. */
  closeHoldOffFrames?: number;
}

export class DialogManager {
  private dialogBox: DialogBox;
  private currentDialog: string[] = [];
  private dialogIndex = 0;
  private _isActive = false;
  private onComplete: (() => void) | null = null;
  /** Dialogs requested while another one is showing (e.g. several level-up messages). */
  private queue: Array<{ lines: string[]; onComplete?: () => void }> = [];

  private closeHoldOffFrames: number;
  /** The input of the last update(); the hold-off goes to it (a mock without holdOff is skipped). */
  private input: Partial<Pick<InputManager, 'holdOff'>> | null = null;

  constructor(dialogBox: DialogBox, opts: DialogManagerOptions = {}) {
    this.dialogBox = dialogBox;
    this.closeHoldOffFrames = opts.closeHoldOffFrames ?? 0;
  }

  /** Show `lines`; `onComplete` runs once, after the last line is dismissed. */
  start(lines: string[], onComplete?: () => void): void {
    this.onComplete = onComplete ?? null;
    this.currentDialog = lines;
    this.dialogIndex = 0;
    this._isActive = true;
    this.dialogBox.show(lines[0], this.moreFollows());
  }

  advance(): void {
    this.dialogIndex++;
    if (this.dialogIndex < this.currentDialog.length) {
      this.dialogBox.show(this.currentDialog[this.dialogIndex], this.moreFollows());
    } else {
      this._isActive = false;
      this.dialogBox.visible = false;
      const done = this.onComplete;
      this.onComplete = null;
      done?.();
      // the callback may itself have started a dialog; the queue then waits for that one
      if (!this._isActive) {
        const next = this.queue.shift();
        if (next) this.start(next.lines, next.onComplete);
      }
      // the last box closed: the press that closed it, or a mash right after, must not talk again (U12)
      if (!this._isActive && this.closeHoldOffFrames > 0) this.input?.holdOff?.(this.closeHoldOffFrames, ['confirm']);
    }
  }

  /** Another line of this dialog, or a queued dialog, comes after the one showing (the box's ▼ marker, I2). */
  private moreFollows(): boolean {
    return this.dialogIndex < this.currentDialog.length - 1 || this.queue.length > 0;
  }

  /** Like `start`, but waits for the current dialog to finish instead of replacing it. */
  enqueue(lines: string[], onComplete?: () => void): void {
    if (this._isActive) {
      this.queue.push({ lines, onComplete });
      this.dialogBox.setMore(true);
    } else {
      this.start(lines, onComplete);
    }
  }

  /** Close any dialog without running its completion callback (scene re-entry). */
  clear(): void {
    this._isActive = false;
    this.onComplete = null;
    this.queue = [];
    this.currentDialog = [];
    this.dialogBox.visible = false;
  }

  update(dt: number, input: InputManager): void {
    this.input = input;
    this.dialogBox.update(dt, input);
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
