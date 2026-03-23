import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DialogManager } from '../../src/systems/DialogManager.js';
import type { DialogBox } from '../../src/ui/DialogBox.js';

function createMockDialogBox() {
  return {
    show: vi.fn(),
    update: vi.fn(),
    visible: false,
  } as unknown as DialogBox;
}

describe('DialogManager', () => {
  let dialogBox: DialogBox;
  let manager: DialogManager;

  beforeEach(() => {
    dialogBox = createMockDialogBox();
    manager = new DialogManager(dialogBox);
  });

  it('starts inactive', () => {
    expect(manager.isActive).toBe(false);
  });

  it('becomes active when dialog starts', () => {
    manager.start(['Hello', 'World']);
    expect(manager.isActive).toBe(true);
    expect(dialogBox.show).toHaveBeenCalledWith('Hello');
  });

  it('advances through dialog lines', () => {
    manager.start(['Line 1', 'Line 2']);
    manager.advance();
    expect(dialogBox.show).toHaveBeenCalledWith('Line 2');
    expect(manager.isActive).toBe(true);
  });

  it('becomes inactive after last line', () => {
    manager.start(['Only line']);
    manager.advance();
    expect(manager.isActive).toBe(false);
  });
});
