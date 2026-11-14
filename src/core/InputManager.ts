export type InputAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'start' | 'select';

const ALL_ACTIONS: readonly InputAction[] = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'start', 'select'];

export interface InputMapping {
  [key: string]: InputAction;
}

const DEFAULT_MAPPINGS: InputMapping = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyZ: 'confirm',
  Enter: 'confirm',
  Space: 'confirm',
  KeyX: 'cancel',
  Escape: 'cancel',
  ShiftLeft: 'select',
  ShiftRight: 'select',
};

export class InputManager {
  private mappings: InputMapping;
  private currentKeys = new Set<string>();
  private previousKeys = new Set<string>();
  /** Keys whose (non-repeat) keydown arrived since the last update(); a tap that is released before the tick still counts. */
  private pressedThisFrame = new Set<string>();
  /** Per action: update() calls left during which isJustPressed is false for it (holdOff). */
  private holdFrames = new Map<InputAction, number>();
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  /** Focus left the page: a key held then never sends its keyup, so every key is released (I1). */
  private boundBlur = (): void => this.releaseAll();
  private boundVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };

  constructor(mappings: InputMapping = DEFAULT_MAPPINGS) {
    this.mappings = { ...mappings };
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  attach(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
    document.addEventListener('visibilitychange', this.boundVisibility);
  }

  detach(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.releaseAll();
  }

  private releaseAll(): void {
    this.holdFrames.clear();
    this.currentKeys.clear();
    this.previousKeys.clear();
    this.pressedThisFrame.clear();
  }

  update(): void {
    this.previousKeys = new Set(this.currentKeys);
    this.pressedThisFrame.clear();
    for (const [action, left] of this.holdFrames) {
      if (left <= 1) this.holdFrames.delete(action);
      else this.holdFrames.set(action, left - 1);
    }
  }

  /**
   * Mark a boundary (scene entry, dialog close, U2/U12): presses so far are spent, and for the next `frames`
   * update() calls isJustPressed is false for `actions` (all when omitted). isPressed is unaffected.
   * The count is kept per action: a second call keeps, for each action it names, the larger remaining count.
   */
  holdOff(frames: number, actions: readonly InputAction[] = ALL_ACTIONS): void {
    this.previousKeys = new Set(this.currentKeys);
    this.pressedThisFrame.clear();
    for (const a of actions) this.holdFrames.set(a, Math.max(this.holdFrames.get(a) ?? 0, frames));
  }

  isPressed(action: InputAction): boolean {
    return this.getKeysForAction(action).some(
      k => this.currentKeys.has(k) || this.pressedThisFrame.has(k)
    );
  }

  isJustPressed(action: InputAction): boolean {
    if ((this.holdFrames.get(action) ?? 0) > 0) return false;
    return this.getKeysForAction(action).some(
      k => this.pressedThisFrame.has(k) || (this.currentKeys.has(k) && !this.previousKeys.has(k))
    );
  }

  isJustReleased(action: InputAction): boolean {
    return this.getKeysForAction(action).some(
      k => !this.currentKeys.has(k) && this.previousKeys.has(k)
    );
  }

  setMapping(key: string, action: InputAction): void {
    this.mappings[key] = action;
  }

  private getKeysForAction(action: InputAction): string[] {
    return Object.entries(this.mappings)
      .filter(([, a]) => a === action)
      .map(([k]) => k);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code in this.mappings) {
      e.preventDefault();
      this.currentKeys.add(e.code);
      if (!e.repeat) this.pressedThisFrame.add(e.code);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code in this.mappings) {
      this.currentKeys.delete(e.code);
    }
  }
}