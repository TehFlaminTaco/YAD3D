const HELP = [
  ['W A S D', 'Move'], ['Shift', 'Run'], ['Mouse', 'Look around'],
  ['Space', 'Hands: free the mouse to point, click and drag things. Space again to look around'],
  ['Left click', 'Use what is in your active hand on whatever you point at; with an empty hand, pick it up or open it'],
  ['Drag', '(hands) Carry things between the floor, tables, your hands, your bags and your body. Drag far away to throw'],
  ['Right click', 'Examine'], ['1 2 3 4', 'Intent: help, disarm, grab, harm (watch your empty hand)'],
  ['X', 'Swap hands'], ['E', 'Wear or stow what you hold (empty hand: draw from your belt)'], ['Z', 'Use the item in your hand'],
  ['Q', 'Drop'], ['R', 'Throw mode: your next click throws what you hold'],
  ['I', 'Look yourself over: clothes, pockets, injuries'], ['Tab', 'Your PDA: time, location, air, map'],
  ['V', 'Internals (mask and air tank)'], ['F', 'Flashlight'],
  ['T', 'Say  (; common radio, :h department, :e :m :s :n :u :v :c other channels)'], ['Y', 'Whisper'], ['M', 'Emote'], ['O', 'OOC'],
  ['B', 'Stop what you are doing'], ['F2', 'Mute'], ['Esc', 'Close the top window'],
];

/** Full-screen overlays: round-end report, help, disconnect notice. */
export class Screens {
  constructor(game) {
    this.game = game;
    const mk = (id, html) => { const d = document.createElement('div'); d.className = 'screen'; d.id = id; d.innerHTML = html; document.body.appendChild(d); return d; };
    this.report = mk('report-screen', '<div class="term"><div class="hd"><span id="rep-title"></span><span>Round report</span></div><div class="body" id="rep-body"></div><div class="ft"><button id="rep-close">Keep watching</button><button id="rep-new">New round</button></div></div>');
    this.help = mk('help-screen', '<div class="term"><div class="hd"><span>Controls</span><span>F1 to close</span></div><div class="body" id="help-body"></div></div>');
    this.reset = mk('reset-screen', '<div class="term"><div class="hd"><span>Round over</span><span></span></div><div class="body" id="reset-body"></div><div class="ft"><button id="reset-go">Reconnect</button></div></div>');
    const hb = this.help.querySelector('#help-body');
    for (const [k, v] of HELP) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<b></b><span></span>';
      row.firstChild.textContent = k;
      row.lastChild.textContent = v;
      hb.appendChild(row);
    }
    this.report.querySelector('#rep-close').onclick = () => this.closeReport();
    this.report.querySelector('#rep-new').onclick = () => location.reload();
    this.reset.querySelector('#reset-go').onclick = () => location.reload();
    this.reportOpen = false;
    this.helpOpen = false;
  }

  toggleHelp() {
    this.helpOpen = !this.helpOpen;
    this.help.classList.toggle('on', this.helpOpen);
    if (this.helpOpen) { this.game.input.releaseAll(); this.game.enterHands(true); } else this.game.panelsChanged();
  }

  showReport(ev) {
    this.reportOpen = true;
    this.report.querySelector('#rep-title').textContent = ev.title;
    this.report.querySelector('#rep-body').textContent = ev.lines.join('\n');
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
    this.reset.querySelector('#reset-body').textContent = m.text || 'The server is starting a new round.';
    this.reset.classList.add('on');
    this.game.input.unlock();
    if (m.auto !== false) setTimeout(() => location.reload(), 2500);
  }

  update(dt) { this.game.lobby.tick(dt); }
}
