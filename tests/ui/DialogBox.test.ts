import { describe, it, expect, vi } from 'vitest';
import { DialogBox } from '../../src/ui/DialogBox.js';
import { InputManager } from '../../src/core/InputManager.js';

function mockInput(actions: Record<string, boolean>): InputManager {
  return {
    isJustPressed: (action: string) => actions[action] ?? false,
  } as InputManager;
}

describe('DialogBox', () => {
  it('paginates long text', () => {
    const dialog = new DialogBox({ linesPerPage: 2, width: 80 });
    dialog.show('Line one. Line two. Line three. Line four. Line five.');
    expect(dialog.totalPages).toBeGreaterThan(1);
  });

  it('advances on confirm', () => {
    const dialog = new DialogBox({ linesPerPage: 1, revealSpeed: 0 });
    dialog.show('Page1\nPage2');
    expect(dialog.currentPage).toBe(0);
    dialog.update(1, mockInput({ confirm: true }));
    expect(dialog.currentPage).toBe(1);
  });

  it('calls onComplete when finished', () => {
    const onComplete = vi.fn();
    const dialog = new DialogBox({ linesPerPage: 4, revealSpeed: 0, onComplete });
    dialog.show('Short text');
    dialog.update(1, mockInput({ confirm: true }));
    expect(onComplete).toHaveBeenCalled();
    expect(dialog.isVisible).toBe(false);
  });

  it('completes text reveal on confirm before advancing', () => {
    const dialog = new DialogBox({ linesPerPage: 4, revealSpeed: 0.1 });
    dialog.show('Test text');
    // First confirm completes reveal
    dialog.update(1, mockInput({ confirm: true }));
    expect(dialog.isVisible).toBe(true);
    // Second confirm closes
    dialog.update(1, mockInput({ confirm: true }));
    expect(dialog.isVisible).toBe(false);
  });
});
