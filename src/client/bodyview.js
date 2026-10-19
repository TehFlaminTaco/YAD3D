const CELL = 32;
const TOP = 13;                       // rows of the front sprite kept: from the chest down, which is what you see of yourself

/**
 * Your own body, seen when you look down: your character's chest, belt, legs and shoes, with the clothes you are really
 * wearing, rising from the bottom of the view between your hands. It fades in as you tilt your head down, rocks as you
 * walk and is drawn from the same layered art as everyone else, so it is you.
 */
export class BodyView {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'bodyview';
    const cv = document.createElement('canvas');
    cv.width = CELL;
    cv.height = CELL - TOP;
    root.appendChild(cv);
    document.body.appendChild(root);
    this.root = root;
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.key = '';
    this.t = 0;
  }

  update(dt, { pitch, moving, show }) {
    const ap = show ? this.game.myAppearance() : null;
    const down = Math.min(1, Math.max(0, (-pitch - 0.45) / 0.5));       // 0 level .. 1 looking right down
    if (!ap || down <= 0) { this.root.style.opacity = '0'; return; }
    const key = JSON.stringify(ap);
    if (key !== this.key) {
      this.key = key;
      const front = this.game.assets.charart.portrait(ap, 0);
      this.ctx.clearRect(0, 0, CELL, CELL - TOP);
      this.ctx.drawImage(front, 0, TOP, CELL, CELL - TOP, 0, 0, CELL, CELL - TOP);
    }
    this.t += dt * (moving ? 9 : 1.2);
    const sway = Math.sin(this.t) * (moving ? 5 : 0.8);
    this.root.style.opacity = down.toFixed(2);
    this.root.style.transform = `translate(calc(-50% + ${sway.toFixed(1)}px), ${((1 - down) * 36).toFixed(1)}%)`;
  }
}
