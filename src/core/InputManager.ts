export type InputAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'start' | 'select';

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
    this.currentKeys.clear();
    this.previousKeys.clear();
    this.pressedThisFrame.clear();
  }

  update(): void {
    this.previousKeys = new Set(this.currentKeys);
    this.pressedThisFrame.clear();
  }

  isPressed(action: InputAction): boolean {
    return this.getKeysForAction(action).some(
      k => this.currentKeys.has(k) || this.pressedThisFrame.has(k)
    );
  }

  isJustPressed(action: InputAction): boolean {
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