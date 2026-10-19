const HELP = [
  ['Moving', [
    ['W A S D', 'Move'], ['Shift', 'Run'], ['Mouse', 'Look around'],
    ['Space', 'Hands: free the mouse to point, click and drag things. Space again to look around'],
  ]],
  ['Hands', [
    ['Left click', 'Use what is in your active hand on whatever you point at; with an empty hand, pick it up or open it'],
    ['Drag', '(hands) Carry things between the floor, tables, your hands, your bags and your body. Drag far away to throw'],
    ['Ctrl+click', 'Drag something along behind you: a person, a loose item, a locker or tank (not what is bolted down). Again to let go'],
    ['Alt+click', 'Lock or unlock a locker; on a person, go through their things (or drag them onto your hands)'],
    ['Right click', 'Examine'], ['1 2 3 4', 'Intent: help, disarm, grab, harm (watch your empty hand)'],
    ['X', 'Swap hands'], ['E', 'Wear or stow what you hold (empty hand: draw from your belt)'], ['Z', 'Use the item in your hand'],
    ['Q', 'Drop'], ['R', 'Throw mode: your next click throws what you hold'],
  ]],
  ['Yourself', [
    ['I', 'Look yourself over: clothes, pockets, injuries'], ['Tab', 'Your PDA: time, location, air, map'],
    ['V', 'Internals (mask and air tank)'], ['F', 'Flashlight'], ['B', 'Stop what you are doing; resist (a grab, handcuffs, a locker)'],
    ['P', 'Let go of whoever you are holding'],
  ]],
  ['Talking', [
    ['T', 'Say  (; common radio, :h department, :e :m :s :n :u :v :c other channels)'], ['Y', 'Whisper'], ['M', 'Emote'], ['O', 'OOC'],
  ]],
  ['Other', [['F1', 'This list'], ['F2', 'Mute'], ['F4', 'Fullscreen (and Ctrl+W, Ctrl+T cannot close the page by accident)'], ['Esc', 'Close the top window']]],
];
// Two columns that come out about the same height.
const HELP_COLS = [['Moving', 'Hands'], ['Yourself', 'Talking', 'Other']];

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/** Full-screen overlays: round-end report, help, disconnect notice. All of them are monitors: steel bezel, green glass. */
export class Screens {
  constructor(game) {
    this.game = game;
    const mk = (id, html) => { const d = document.createElement('div'); d.className = 'screen'; d.id = id; d.innerHTML = html; document.body.appendChild(d); return d; };
    this.report = mk('report-screen', `<div class="term panel-frame">
      <div class="hd"><span id="rep-title"></span><span>Round report</span></div>
      <div class="term-crt crt"><div class="body scroll" id="rep-body"></div></div>
      <div class="ft"><button id="rep-close">Keep watching</button><button id="rep-new" class="lamp lit">New round</button></div></div>`);
    this.help = mk('help-screen', `<div class="term panel-frame">
      <div class="hd"><span>Controls</span><span>F1 to close</span></div>
      <div class="term-crt crt"><div class="body scroll" id="help-body"></div></div></div>`);
    this.reset = mk('reset-screen', `<div class="term panel-frame">
      <div class="hd"><span id="reset-title">Station uplink</span><span id="reset-sub"></span></div>
      <div class="term-crt crt"><div><div class="body" id="reset-body"></div><div class="reset-bar"><i></i></div></div></div>
      <div class="ft"><button id="reset-go" class="lamp lit">Reconnect</button></div></div>`);
    this.buildHelp();
    this.report.querySelector('#rep-close').onclick = () => this.closeReport();
    this.report.querySelector('#rep-new').onclick = () => location.reload();
    this.reset.querySelector('#reset-go').onclick = () => location.reload();
    this.reportOpen = false;
    this.helpOpen = false;
  }

  buildHelp() {
    const hb = this.help.querySelector('#help-body');
    const groups = new Map(HELP);
    for (const names of HELP_COLS) {
      const col = el('div', 'hcol');
      for (const name of names) {
        const sec = el('div', 'hsec');
        const h = el('i');
        h.appendChild(el('span', '', name));
        sec.appendChild(h);
        for (const [k, v] of groups.get(name)) {
          const row = el('div', 'row');
          const b = el('b');
          // "W A S D" and "1 2 3 4" are four keys; "Left click" is one.
          const parts = k.split(' ');
          for (const p of parts.every((s) => s.length <= 2) ? parts : [k]) b.appendChild(el('kbd', '', p));
          row.append(b, el('span', '', v));
          sec.appendChild(row);
        }
        col.appendChild(sec);
      }
      hb.appendChild(col);
    }
  }

  toggleHelp() {
    this.helpOpen = !this.helpOpen;
    this.help.classList.toggle('on', this.helpOpen);
    if (this.helpOpen) { this.game.input.releaseAll(); this.game.enterHands(true); } else this.game.panelsChanged();
  }

  /** The report arrives as plain lines; lay it out as a printout: headline, sections, one row per crew member. */
  renderReport(lines) {
    const body = this.report.querySelector('#rep-body');
    body.textContent = '';
    let afterBlank = false;
    lines.forEach((line, i) => {
      if (!line.trim()) { body.appendChild(el('div', 'gap')); afterBlank = true; return; }
      const indented = /^\s/.test(line);
      if (i === 0) body.appendChild(el('div', 'lead', line));
      else if (!indented && afterBlank) {
        const sec = el('div', 'sec');
        const m = line.match(/^([^:]+):(.*)$/);
        if (m) { sec.append(el('span', '', m[1] + ':'), el('em', '', m[2])); } else sec.appendChild(el('span', '', line));
        body.appendChild(sec);
      } else {
        const m = indented && line.match(/^\s+(.*?)( \[player\])? - (escaped|left behind|died)$/);
        if (m) {
          const row = el('div', 'mob');
          const who = el('span', '', m[1]);
          if (m[2]) who.appendChild(el('span', 'tag', m[2]));
          row.append(who, el('span', m[3] === 'left behind' ? 'left' : m[3], m[3]));
          body.appendChild(row);
        } else body.appendChild(el('div', indented ? 'line ind' : 'line', line));
      }
      afterBlank = false;
    });
  }

  showReport(ev) {
    this.reportOpen = true;
    this.report.querySelector('#rep-title').textContent = ev.title;
    this.report.classList.toggle('wipe', ev.kind === 'wipe');
    this.renderReport(ev.lines);
    this.report.classList.add('on');
    this.game.input.releaseAll();
    this.game.enterHands(true);
    this.game.audio.play(ev.kind === 'wipe' ? 'alarm' : 'chime', { vol: 0.6 });
    this.game.lobby.update();
  }

  closeReport() {
    this.reportOpen = false;
    this.report.classList.remove('on');
    this.game.lobby.update();
    this.game.panelsChanged();
  }

  showReset(m) {
    const auto = m.auto !== false;
    this.reset.querySelector('#reset-body').textContent = m.text || 'The server is starting a new round.';
    this.reset.querySelector('#reset-sub').textContent = auto ? 'Reconnecting' : 'No carrier';
    this.reset.classList.toggle('auto', auto);
    this.reset.classList.add('on');
    this.game.input.unlock();
    if (auto) setTimeout(() => location.reload(), 2500);
  }

  update(dt) { this.game.lobby.tick(dt); }
}
