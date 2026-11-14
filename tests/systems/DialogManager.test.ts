import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DialogManager } from '../../src/systems/DialogManager.js';
import type { DialogBox } from '../../src/ui/DialogBox.js';

function createMockDialogBox() {
  return {
    show: vi.fn(),
    setMore: vi.fn(),
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
    expect(dialogBox.show).toHaveBeenCalledWith('Hello', true);
  });

  it('advances through dialog lines', () => {
    manager.start(['Line 1', 'Line 2']);
    manager.advance();
    expect(dialogBox.show).toHaveBeenCalledWith('Line 2', false);
    expect(manager.isActive).toBe(true);
  });

  it('becomes inactive after last line', () => {
    manager.start(['Only line']);
    manager.advance();
    expect(manager.isActive).toBe(false);
  });

  it('runs the completion callback once, after the last line', () => {
    const done = vi.fn();
    manager.start(['a', 'b'], done);
    manager.advance();
    expect(done).not.toHaveBeenCalled();
    manager.advance();
    expect(done).toHaveBeenCalledTimes(1);
    manager.advance();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('enqueue waits for the current dialog instead of replacing it (several level-ups)', () => {
    const first = vi.fn();
    const second = vi.fn();
    manager.enqueue(['WAR reached Level 2!'], first);
    manager.enqueue(['B.MAG reached Level 2!'], second);
    expect(dialogBox.show).toHaveBeenLastCalledWith('WAR reached Level 2!', false);
    manager.advance();
    expect(first).toHaveBeenCalled();
    expect(dialogBox.show).toHaveBeenLastCalledWith('B.MAG reached Level 2!', false);
    expect(manager.isActive).toBe(true);
    manager.advance();
    expect(second).toHaveBeenCalled();
    expect(manager.isActive).toBe(false);
  });

  it('clear closes the dialog and drops queued lines without running callbacks', () => {
    const done = vi.fn();
    manager.start(['a'], done);
    manager.enqueue(['b'], done);
    manager.clear();
    expect(manager.isActive).toBe(false);
    manager.advance();
    expect(done).not.toHaveBeenCalled();
  });

  it('I2: tells the box when another line follows (the ▼ marker)', () => {
    manager.start(['a', 'b']);
    expect(dialogBox.show).toHaveBeenLastCalledWith('a', true);
    manager.advance();
    expect(dialogBox.show).toHaveBeenLastCalledWith('b', false);
  });

  it('I2: a queued dialog counts as more text after the last line', () => {
    manager.start(['a']);
    manager.enqueue(['b']);
    manager.enqueue(['c']);
    expect(dialogBox.setMore).toHaveBeenCalledWith(true);     // 'a' now has text after it
    manager.advance();
    expect(dialogBox.show).toHaveBeenLastCalledWith('b', true);
    manager.advance();
    expect(dialogBox.show).toHaveBeenLastCalledWith('c', false);
  });
});
