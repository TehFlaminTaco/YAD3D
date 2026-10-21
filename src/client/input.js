const SWALLOW = new Set(['Tab', 'Space', 'F1', 'F2', 'F3', 'F4', 'KeyT', 'KeyY', 'KeyM', 'KeyO', 'Enter', 'Slash', 'Backquote', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// While you play, Ctrl (or Cmd) is held for dragging and a W, S or D under it is a browser shortcut: Ctrl+W closes the tab, Ctrl+S saves the
// page, Ctrl+D bookmarks, Ctrl+P prints. The page swallows every such chord it is allowed to (the browser reserves Ctrl+W, Ctrl+T and Ctrl+N
// for itself, which Game covers with a leave-the-page prompt and, in fullscreen, a keyboard lock).
const MODIFIERS = new Set(['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight']);
const EDITING = new Set(['KeyA', 'KeyC', 'KeyV', 'KeyX', 'KeyZ', 'KeyY']);            // still wanted in a text field
const DEVTOOLS = new Set(['KeyI', 'KeyJ', 'KeyC', 'KeyK', 'KeyR']);                    // Ctrl+Shift+ these: developer tools, hard reload

/** Keyboard + mouse (pointer lock) input with edge-triggered "pressed" events. */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedSet = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.buttons = new Set();
    this.clicks = [];
    this.locked = false;
    this.forced = false;                // headless runs have no pointer lock
    this.onLockChange = () => {};
    this.sensitivity = 0.0022;
    this.guard = () => false;           // set by the game: true while a round is on and browser shortcuts should be swallowed

    addEventListener('keydown', (e) => {
      const field = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (this.guard() && !MODIFIERS.has(e.code)) {
        if ((e.ctrlKey || e.metaKey) && !(e.shiftKey && DEVTOOLS.has(e.code)) && !(field && EDITING.has(e.code))) e.preventDefault();
        else if (e.altKey && e.code.startsWith('Arrow')) e.preventDefault();       // Alt+Left is "back"
      }
      if (field) return;
      if (SWALLOW.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
      if (!e.repeat) this.pressedSet.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('wheel', (e) => { if ((e.ctrlKey || e.metaKey) && this.guard()) e.preventDefault(); }, { passive: false });      // Ctrl+wheel zooms the page
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.buttons.clear(); });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.buttons.add(e.button);
      this.clicks.push((e.ctrlKey ? 20 : e.altKey ? 10 : 0) + e.button);       // +10 is Alt-click, +20 Ctrl-click
      e.preventDefault();
    });
    addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    addEventListener('mousemove', (e) => {
      if (!this.locked || this.forced) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    addEventListener('contextmenu', (e) => { if (this.locked || e.target === canvas) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      if (this.forced) return;
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange(this.locked);
    });
  }

  force() { this.forced = true; this.locked = true; }
  lock() { if (this.forced) return; try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* headless */ } }
  unlock() { if (this.forced) return; if (document.pointerLockElement) document.exitPointerLock(); }
  isDown(code) { return this.down.has(code); }
  pressed(code) { return this.pressedSet.has(code); }
  releaseAll() { this.down.clear(); this.buttons.clear(); this.clicks = []; }
  takeClicks() { const c = this.clicks; this.clicks = []; return c; }
  takeMouse() { const d = [this.mouseDX, this.mouseDY]; this.mouseDX = this.mouseDY = 0; return d; }
  endFrame() { this.pressedSet.clear(); }
}
