import type { DialogBox } from '../ui/DialogBox.js';
import type { InputManager } from '../core/InputManager.js';

export class DialogManager {
  private dialogBox: DialogBox;
  private currentDialog: string[] = [];
  private dialogIndex = 0;
  private _isActive = false;
  private onComplete: (() => void) | null = null;
  /** Dialogs requested while another one is showing (e.g. several level-up messages). */
  private queue: Array<{ lines: string[]; onComplete?: () => void }> = [];

  constructor(dialogBox: DialogBox) {
    this.dialogBox = dialogBox;
  }

  /** Show `lines`; `onComplete` runs once, after the last line is dismissed. */
  start(lines: string[], onComplete?: () => void): void {
    this.onComplete = onComplete ?? null;
    this.currentDialog = lines;
    this.dialogIndex = 0;
    this._isActive = true;
    this.dialogBox.show(lines[0]);
  }

  advance(): void {
    this.dialogIndex++;
    if (this.dialogIndex < this.currentDialog.length) {
      this.dialogBox.show(this.currentDialog[this.dialogIndex]);
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
    }
  }

  /** Like `start`, but waits for the current dialog to finish instead of replacing it. */
  enqueue(lines: string[], onComplete?: () => void): void {
    if (this._isActive) this.queue.push({ lines, onComplete });
    else this.start(lines, onComplete);
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
    this.dialogBox.update(dt, input);
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
