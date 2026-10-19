const store = {
  get(k) { try { return localStorage.getItem('yad3d.' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('yad3d.' + k, v); } catch { /* private mode */ } },
};
export { store };

const OFF_LIST = new Set(['prisoner']);

/** The pre-round lobby: pick a job, ready up, or (once the round is running) join the crew late or observe. */
export class Lobby {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.className = 'screen';
    root.id = 'lobby';
    root.innerHTML = `
      <div class="lobby-main term">
        <div class="logo">YAD3D</div>
        <div class="sub">Space Station 13 - BoxStation</div>
        <div class="hd"><span id="lb-status">Connecting...</span><span id="lb-server"></span></div>
        <div class="lb-cols">
          <div class="lb-jobs">
            <div class="lb-row"><label for="lb-name">Name</label><input id="lb-name" maxlength="24" autocomplete="off" spellcheck="false"></div>
            <div class="lb-sub">Job preference</div>
            <div id="joblist"></div>
            <div id="jobinfo"></div>
          </div>
          <div class="lb-side">
            <div class="lb-sub">Players</div>
            <div id="players"></div>
            <div class="lb-btns">
              <button id="btn-ready">Ready</button>
              <button id="btn-start">Start now</button>
              <button id="btn-join">Join game</button>
              <button id="btn-observe">Observe</button>
            </div>
          </div>
        </div>
        <div class="ft"><span class="keys">Click a job, then Ready. Chat is out-of-character in the lobby. <b>F1</b> for controls.</span></div>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.$ = (id) => root.querySelector('#' + id);
    this.selected = store.get('job') || 'assistant';
    this.nameInput = this.$('lb-name');
    this.nameInput.value = game.opts.name || '';
    this.nameInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.nameInput.blur(); });
    this.nameInput.addEventListener('change', () => this.rename());
    this.$('joblist').addEventListener('click', (e) => {
      const row = e.target.closest('.job');
      if (row) this.pick(row.dataset.id);
    });
    this.$('joblist').addEventListener('mouseover', (e) => {
      const row = e.target.closest('.job');
      if (row) this.info(row.dataset.id);
    });
    this.$('btn-ready').onclick = () => game.send({ t: 'lobby', op: 'ready', v: !this.me()?.ready });
    this.$('btn-start').onclick = () => game.send({ t: 'lobby', op: 'start' });
    this.$('btn-join').onclick = () => game.send({ t: 'lobby', op: 'latejoin', id: this.selected });
    this.$('btn-observe').onclick = () => game.send({ t: 'lobby', op: 'observe' });
    this.tickAcc = 0;
    this.built = false;
  }

  me() { const r = this.game.rep?.round; return r?.players.find((p) => p.id === this.game.rep.me); }

  rename() {
    const n = this.nameInput.value.trim();
    if (!n) return;
    store.set('name', n);
    this.game.send({ t: 'hello', name: n });
  }

  pick(id) {
    this.selected = id;
    store.set('job', id);
    this.game.send({ t: 'lobby', op: 'job', id });
    this.info(id);
    this.renderJobs();
  }

  info(id) {
    const j = this.game.rep?.jobMap[id];
    this.$('jobinfo').textContent = j ? `${j.title}. Answers directly to ${j.supervisors}.` : '';
  }

  /** Free positions: roundstart limits before the round, the job's total once it is under way. */
  free(j) {
    const r = this.game.rep.round;
    const late = r.state !== 'lobby';
    const cap = late ? j.total : j.slots;
    return cap - (r.taken[j.id] || 0);
  }

  renderJobs() {
    const g = this.game, box = this.$('joblist');
    if (!g.rep) return;
    const r = g.rep.round;
    const list = g.rep.jobs.filter((j) => !OFF_LIST.has(j.id));
    if (!this.built) {
      box.textContent = '';
      for (const j of list) {
        const row = document.createElement('div');
        row.className = 'job';
        row.dataset.id = j.id;
        row.innerHTML = '<span class="jt"></span><span class="js"></span>';
        row.querySelector('.jt').textContent = j.title;
        row.querySelector('.jt').style.color = j.color;
        box.appendChild(row);
      }
      this.built = true;
    }
    for (const row of box.children) {
      const j = g.rep.jobMap[row.dataset.id];
      const free = this.free(j);
      const full = free <= 0;
      row.classList.toggle('sel', row.dataset.id === this.selected);
      row.classList.toggle('full', full);
      row.querySelector('.js').textContent = j.id === 'assistant' ? 'any' : full ? 'full' : free + (free === 1 ? ' slot' : ' slots');
    }
    void r;
  }

  renderPlayers() {
    const r = this.game.rep.round;
    const box = this.$('players');
    box.textContent = '';
    for (const p of r.players) {
      const row = document.createElement('div');
      row.className = 'pl' + (p.id === this.game.rep.me ? ' me' : '');
      const tag = p.st === 'playing' ? 'in round' : p.st === 'ghost' ? 'observing' : r.state === 'lobby' ? (p.ready ? 'ready' : 'not ready') : 'in lobby';
      row.innerHTML = '<span></span><em></em>';
      row.firstChild.textContent = p.name;
      row.lastChild.textContent = tag;
      row.lastChild.className = p.ready && r.state === 'lobby' ? 'ok' : '';
      box.appendChild(row);
    }
  }

  statusText() {
    const rep = this.game.rep;
    const r = rep.round;
    if (r.state === 'lobby') {
      if (r.countdown !== null) {
        const left = Math.max(0, r.countdown - (performance.now() - rep.roundAt) / 1000);
        return `The round starts in ${Math.ceil(left)} seconds.`;
      }
      return 'Waiting for the round to start. Pick a job and press Ready.';
    }
    if (r.state === 'playing') return 'The round is in progress. You can join the crew now.';
    return 'The round is ending. A new round will start soon.';
  }

  update() {
    const g = this.game;
    const show = g.phase === 'lobby' && g.rep && !g.screens.reportOpen;
    this.root.classList.toggle('on', !!show);
    document.body.classList.toggle('lobbyview', !!show);
    g.chat.setPersistent(!!show, 'ooc');
    if (!show) return;
    if (document.activeElement !== this.nameInput) this.nameInput.value = this.nameInput.value || g.rep.name || '';
    const r = g.rep.round;
    this.$('lb-status').textContent = this.statusText();
    this.$('lb-server').textContent = g.conn.kind === 'ws' ? 'Server: ' + g.opts.serverName : 'Local round';
    this.renderJobs();
    this.renderPlayers();
    const me = this.me();
    const btn = (id, on, label) => { const b = this.$(id); b.style.display = on ? '' : 'none'; if (label) b.textContent = label; };
    btn('btn-ready', r.state === 'lobby', me?.ready ? 'Unready' : 'Ready');
    btn('btn-start', r.state === 'lobby');
    btn('btn-join', r.state === 'playing');
    btn('btn-observe', r.state !== 'ending');
    this.info(this.selected);
  }

  tick(dt) {
    if (this.game.phase !== 'lobby') return;
    this.tickAcc += dt;
    if (this.tickAcc < 0.25) return;
    this.tickAcc = 0;
    if (this.root.classList.contains('on')) this.$('lb-status').textContent = this.statusText();
  }
}
