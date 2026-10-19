const SWALLOW = new Set(['Tab', 'Space', 'F1', 'F2', 'KeyT', 'KeyY', 'KeyM', 'KeyO', 'Enter', 'Slash', 'Backquote', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

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

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (SWALLOW.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
      if (!e.repeat) this.pressedSet.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.buttons.clear(); });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.buttons.add(e.button);
      this.clicks.push(e.button);
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
