import { HAIR_COLORS, EYE_COLORS } from '../shared/looks.js';

// The sheet's directions are S, N, E, W (0..3); the turn buttons go round the way a compass does: N, E, S, W.
const COMPASS = [1, 3, 0, 2];

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/**
 * The character screen: a mannequin you turn with the arrows (it does not turn by itself) and the dials to change it (body, skin, hair, facial hair, eyes,
 * underwear). In the lobby it shows the job's clothes and edits everything; at a mirror it shows what you are wearing and
 * edits only hair and facial hair (SS13's mirror does exactly that).
 */
export class CharEditor {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.className = 'screen';
    root.id = 'char-screen';
    root.innerHTML = `
      <div class="term panel-frame ce">
        <div class="hd"><span id="ce-title">Character</span><span>Esc to close</span></div>
        <div class="ce-main">
          <div class="ce-prev crt"><canvas id="ce-cv" width="32" height="32"></canvas>
            <div class="ce-rot"><button data-r="-1" title="Turn left">&lt;</button><button data-r="1" title="Turn right">&gt;</button></div>
            <label class="ce-clothes"><input type="checkbox" id="ce-wear" checked> <span>job clothes</span></label>
          </div>
          <div class="ce-form crt scroll" id="ce-form"></div>
        </div>
        <div class="ft"><button id="ce-rand">Randomise</button><button id="ce-done" class="lamp lit" data-close>Done</button></div>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.$ = (id) => root.querySelector('#' + id);
    this.open_ = false;
    this.pos = 2;                       // where in COMPASS we are: facing you (south)
    this.$('ce-done').onclick = () => this.close();
    this.$('ce-rand').onclick = () => {
      const r = this.looks.random(Math.random);
      // at a mirror only hair and facial hair are yours to change
      this.set(this.mode === 'mirror' ? { ...this.look, h: r.h, hc: r.hc, f: r.f, fc: r.fc } : r);
      this.build();
    };
    this.$('ce-wear').onchange = () => this.draw();
    root.querySelectorAll('.ce-rot button').forEach((b) => { b.onclick = () => { this.pos = (this.pos + (+b.dataset.r) + 4) % 4; this.draw(); }; });
    addEventListener('keydown', (e) => { if (this.open_ && e.key === 'Escape') { e.stopPropagation(); this.close(); } }, true);
  }

  get open() { return this.open_; }
  get looks() { return this.game.assets.looks; }
  get art() { return this.game.assets.charart; }

  /**
   * mode 'lobby': every dial, wears the clothes `outfit()` returns (or none), `onChange(look)` after each change.
   * mode 'mirror': hair and facial hair only, wears what you wear, `onChange` when you press Done.
   */
  show({ mode, look, outfit, onChange }) {
    this.mode = mode;
    this.look = { ...look };
    this.outfit = outfit;
    this.onChange = onChange;
    this.$('ce-title').textContent = mode === 'mirror' ? 'Mirror' : 'Character';
    this.$('ce-wear').parentElement.style.display = mode === 'mirror' ? 'none' : '';
    this.root.classList.add('on');
    this.open_ = true;
    this.pos = 2;                       // start facing you
    this.build();
    this.game.input?.releaseAll?.();
    if (this.game.inWorld()) this.game.enterHands(true);
  }

  close() {
    if (!this.open_) return;
    this.open_ = false;
    this.root.classList.remove('on');
    if (this.mode === 'mirror') this.onChange?.(this.look);
    if (this.game.inWorld()) this.game.panelsChanged();
  }

  /** Swap in a whole new look and tell whoever is listening. */
  set(look) {
    this.look = { ...look };
    this.changed();
  }

  changed() {
    this.draw();
    if (this.mode === 'lobby') this.onChange?.(this.look);
  }

  draw() {
    const wear = this.mode === 'mirror' || this.$('ce-wear').checked;
    const o = wear ? this.outfit?.() || { o: {}, h: 0 } : { o: {}, h: 0 };
    const cv = this.art.portrait({ l: this.look, o: o.o || {}, h: o.h || 0 }, COMPASS[this.pos]);
    const dst = this.$('ce-cv'), c = dst.getContext('2d');
    c.clearRect(0, 0, 32, 32);
    c.drawImage(cv, 0, 0);
  }

  // ------------------------------------------------------------------ the dials
  build() {
    const form = this.$('ce-form');
    form.textContent = '';
    const l = this.look;
    const mirror = this.mode === 'mirror';
    const row = (label, ...kids) => {
      const r = el('div', 'ce-row');
      r.appendChild(el('span', 'ce-lab', label));
      const box = el('div', 'ce-ctl');
      box.append(...kids);
      r.appendChild(box);
      form.appendChild(r);
    };
    const btn = (text, fn, on) => { const b = el('button', on ? 'on' : '', text); b.onclick = fn; return b; };
    const pick = (key, v) => { this.look = { ...this.look, [key]: v }; this.changed(); this.build(); };
    const stepper = (key, cat, gender) => {
      const names = this.looks.names(cat, gender);
      let i = Math.max(0, names.indexOf(this.look[key]));
      const go = (d) => pick(key, names[(i + d + names.length) % names.length]);
      const name = el('span', 'ce-name', this.look[key]);
      return [btn('<', () => go(-1)), name, btn('>', () => go(1))];
    };
    const swatches = (key, colors) => {
      const wrap = el('div', 'ce-sw');
      for (const c of colors) {
        const s = el('i', this.look[key] === c ? 'on' : '');
        s.style.background = c;
        s.onclick = () => pick(key, c);
        wrap.appendChild(s);
      }
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.value = this.look[key];
      inp.oninput = () => { this.look = { ...this.look, [key]: inp.value }; this.changed(); };
      inp.onchange = () => this.build();
      wrap.appendChild(inp);
      return wrap;
    };
    if (!mirror) {
      row('Body', btn('Male', () => pick('g', 'm'), l.g === 'm'), btn('Female', () => pick('g', 'f'), l.g === 'f'));
      const skin = el('div', 'ce-sw');
      for (const s of this.game.assets.chars.skin) {
        const i = el('i', l.sk === s.n ? 'on' : '');
        i.style.background = s.hex; i.title = s.n; i.onclick = () => pick('sk', s.n);
        skin.appendChild(i);
      }
      row('Skin', skin);
    }
    row('Hair', ...stepper('h', 'h'));
    row('Hair colour', swatches('hc', HAIR_COLORS));
    row('Facial hair', ...stepper('f', 'f'));
    row('Facial colour', swatches('fc', HAIR_COLORS));
    if (!mirror) {
      row('Eyes', swatches('e', EYE_COLORS));
      row('Underwear', ...stepper('u', 'u', l.g));
      row('Undershirt', ...stepper('t', 't'));
      row('Socks', ...stepper('s', 's'));
    }
    this.draw();
  }
}
