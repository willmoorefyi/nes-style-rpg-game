import type { DialogBox } from '../ui/DialogBox.js';
import type { InputManager } from '../core/InputManager.js';

export class DialogManager {
  private dialogBox: DialogBox;
  private currentDialog: string[] = [];
  private dialogIndex = 0;
  private _isActive = false;

  constructor(dialogBox: DialogBox) {
    this.dialogBox = dialogBox;
  }

  start(lines: string[]): void {
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
    }
  }

  update(dt: number, input: InputManager): void {
    this.dialogBox.update(dt, input);
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
