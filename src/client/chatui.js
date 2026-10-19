const MODES = {
  say: { label: 'Say', hint: '; = common radio, :h = department, :e :m :s :n :u :v :c = other channels' },
  whisper: { label: 'Whisper', hint: 'only people next to you will hear this' },
  me: { label: 'Me', hint: 'describe what you do' },
  ooc: { label: 'OOC', hint: 'out-of-character chat, everyone sees it' },
};
const MAX_LINES = 160;
const FADE_AFTER = 22;               // seconds

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/** Chat log + input line. Everything is built with textContent, so nothing a player types can inject markup. */
export class ChatUI {
  constructor(game) {
    this.game = game;
    const root = el('div');
    root.id = 'chat';
    root.innerHTML = '<div id="chatlog"></div><div id="chatbar"><span id="chatmode"></span><input id="chatinput" maxlength="280" autocomplete="off" spellcheck="false"><small id="chathint"></small></div>';
    document.body.appendChild(root);
    this.root = root;
    this.log = root.querySelector('#chatlog');
    this.bar = root.querySelector('#chatbar');
    this.input = root.querySelector('#chatinput');
    this.modeEl = root.querySelector('#chatmode');
    this.hintEl = root.querySelector('#chathint');
    this.mode = 'say';
    this.isOpen = false;
    this.persistent = false;           // lobby: the input line is always there
    this.lines = [];
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.submit(); e.preventDefault(); }
      else if (e.key === 'Escape') { this.close(); e.preventDefault(); }
      else if (e.key === 'Tab') { this.cycle(); e.preventDefault(); }
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
  }

  setPersistent(v, mode = 'ooc') {
    this.persistent = v;
    this.root.classList.toggle('persistent', v);
    if (v) { this.setMode(mode); this.bar.style.display = 'flex'; } else if (!this.isOpen) this.bar.style.display = 'none';
  }

  setMode(m) {
    this.mode = m;
    this.modeEl.textContent = MODES[m].label;
    this.hintEl.textContent = MODES[m].hint;
    this.root.dataset.mode = m;
  }

  cycle() {
    const keys = Object.keys(MODES);
    this.setMode(keys[(keys.indexOf(this.mode) + 1) % keys.length]);
  }

  open(mode = 'say', prefill = '') {
    if (this.isOpen) return;
    const g = this.game;
    if (g.phase === 'ghost' && mode !== 'ooc') mode = 'say';
    this.isOpen = true;
    g.input.releaseAll();
    this.root.classList.add('open');
    this.bar.style.display = 'flex';
    this.setMode(mode);
    this.input.value = prefill;
    setTimeout(() => { this.input.focus(); this.input.setSelectionRange(prefill.length, prefill.length); }, 0);
    this.log.scrollTop = this.log.scrollHeight;
  }

  close() {
    if (!this.isOpen && !this.persistent) return;
    this.isOpen = false;
    this.input.blur();
    this.input.value = '';
    this.root.classList.remove('open');
    if (!this.persistent) this.bar.style.display = 'none';
    this.log.scrollTop = this.log.scrollHeight;
  }

  focusInput() { this.input.focus(); }

  clear() { this.log.textContent = ''; this.lines = []; }

  /** Drop the lobby chatter when you spawn, but keep what arrived with you (the job greeting). */
  clearOlderThan(t) {
    this.lines = this.lines.filter((L) => { if (+L.dataset.t < t) { L.remove(); return false; } return true; });
  }

  submit() {
    const text = this.input.value.trim();
    this.input.value = '';
    if (text) this.game.send({ t: 'say', text, mode: this.mode });
    if (this.persistent) { this.input.focus(); return; }
    this.close();
  }

  // ---------------------------------------------------------------- lines
  add(ev) {
    const line = this.format(ev);
    if (!line) return;
    line.dataset.t = this.game.time;
    this.log.appendChild(line);
    this.lines.push(line);
    while (this.lines.length > MAX_LINES) this.lines.shift().remove();
    this.log.scrollTop = this.log.scrollHeight;
  }

  format(ev) {
    const k = ev.k;
    const line = el('div', 'c-' + k);
    const name = (n) => el('b', 'cn', n);
    switch (k) {
      case 'say':
        line.append(name(ev.name), ` ${ev.verb || 'says'}, "${ev.text}"`);
        break;
      case 'whisper':
        line.append(name(ev.name), ` whispers, "${ev.text}"`);
        break;
      case 'emote':
        line.append(name(ev.name), ' ' + ev.text);
        break;
      case 'radio': {
        line.style.color = ev.color;
        const tag = el('span', 'rtag', `[${ev.chname}] `);
        line.append(tag, name(ev.name));
        if (ev.job) line.append(el('span', 'rjob', ` (${ev.job})`));
        line.append(` ${ev.verb || 'says'}, "${ev.text}"`);
        break;
      }
      case 'ooc':
        line.append(el('span', 'oocl', 'OOC: '), name(ev.name), ': ' + ev.text);
        break;
      case 'deadsay':
        if (ev.name) line.append(el('span', 'deadl', 'DEAD: '), name(ev.name), ` says, "${ev.text}"`);
        else line.textContent = ev.text;
        break;
      case 'announce': {
        line.className = 'c-announce';
        line.append(el('div', 'at', ev.title || 'Announcement'), el('div', 'ab', ev.text));
        break;
      }
      default:
        line.textContent = ev.text;
        break;
    }
    return line;
  }

  update() {
    const now = this.game.time;
    const open = this.isOpen || this.persistent;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const L = this.lines[i];
      const old = !open && now - +L.dataset.t > FADE_AFTER;
      if (L._old !== old) { L._old = old; L.classList.toggle('old', old); }
      if (!old && !open && i < this.lines.length - 40) break;
    }
  }
}
