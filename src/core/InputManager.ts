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
  KeyX: 'cancel',
  Enter: 'start',
  ShiftLeft: 'select',
  ShiftRight: 'select',
};

export class InputManager {
  private mappings: InputMapping;
  private currentKeys = new Set<string>();
  private previousKeys = new Set<string>();
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor(mappings: InputMapping = DEFAULT_MAPPINGS) {
    this.mappings = { ...mappings };
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  attach(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.currentKeys.clear();
    this.previousKeys.clear();
  }

  update(): void {
    this.previousKeys = new Set(this.currentKeys);
  }

  isPressed(action: InputAction): boolean {
    return this.getKeysForAction(action).some(k => this.currentKeys.has(k));
  }

  isJustPressed(action: InputAction): boolean {
    return this.getKeysForAction(action).some(
      k => this.currentKeys.has(k) && !this.previousKeys.has(k)
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
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code in this.mappings) {
      this.currentKeys.delete(e.code);
    }
  }
}