const store = {
  get(k) { try { return localStorage.getItem('yad3d.' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('yad3d.' + k, v); } catch { /* private mode */ } },
};
export { store };

const OFF_LIST = new Set(['prisoner']);

// The job board, SS13 style: by department, heads first. Two columns that come out about the same height;
// anything the data has that is not listed here goes under Other.
const DEPTS = [
  ['Civilian', ['assistant']],
  ['Command', ['captain', 'head_of_personnel']],
  ['Engineering', ['chief_engineer', 'station_engineer', 'atmospheric_technician']],
  ['Medical', ['chief_medical_officer', 'medical_doctor', 'paramedic', 'chemist', 'virologist']],
  ['Science', ['research_director', 'scientist', 'roboticist', 'geneticist']],
  ['Security', ['head_of_security', 'warden', 'detective', 'security_officer']],
  ['Supply', ['quartermaster', 'cargo_technician', 'shaft_miner']],
  ['Service', ['bartender', 'botanist', 'chaplain', 'clown', 'cook', 'curator', 'janitor', 'lawyer', 'mime', 'psychologist']],
];
const COL_BREAK = 'Security';

/** The pre-round lobby: pick a job, ready up, or (once the round is running) join the crew late or observe. */
export class Lobby {
  constructor(game) {
    this.game = game;
    const root = document.createElement('div');
    root.className = 'screen';
    root.id = 'lobby';
    root.innerHTML = `
      <div class="lobby-main panel-frame">
        <div class="lb-banner crt">
          <div class="logo">YAD3D</div>
          <div class="lb-title">
            <div class="sub"><span>Space Station 13 &middot; BoxStation</span><span id="lb-server"></span></div>
            <div id="lb-status">Connecting...</div>
          </div>
        </div>
        <div class="lb-cols">
          <div class="lb-jobs">
            <div class="lb-sub"><span>Occupation</span><small id="lb-hint"></small></div>
            <div class="lb-screen crt">
              <div id="joblist" class="scroll"></div>
              <div id="jobinfo"></div>
            </div>
          </div>
          <div class="lb-side">
            <div class="lb-sub"><label for="lb-name">Name</label></div>
            <input id="lb-name" maxlength="24" autocomplete="off" spellcheck="false">
            <div class="lb-sub"><span>Crew</span><small id="lb-count"></small></div>
            <div class="lb-screen crt"><div id="players" class="scroll"></div></div>
            <div class="lb-btns">
              <button id="btn-ready" class="lamp">Ready</button>
              <button id="btn-start">Start now</button>
              <button id="btn-join" class="lamp lit">Join game</button>
              <button id="btn-observe">Observe</button>
            </div>
          </div>
        </div>
        <div class="lb-foot"><span>Chat here is out of character. <b>F1</b> for controls.</span><span class="plate">NT-CAT MK II &middot; CREW ASSIGNMENT</span></div>
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
    if (!j) { this.$('jobinfo').textContent = ''; return; }
    const free = j.id === 'assistant' ? 0 : this.free(j);
    const open = j.id === 'assistant' ? '' : free <= 0 ? ' No positions open.' : ` ${free} open.`;
    this.$('jobinfo').textContent = `${j.title}. Answers to ${j.supervisors}.${open}`;
  }

  /** Free positions: roundstart limits before the round, the job's total once it is under way. */
  free(j) {
    const r = this.game.rep.round;
    const late = r.state !== 'lobby';
    const cap = late ? j.total : j.slots;
    return cap - (r.taken[j.id] || 0);
  }

  /** Build the board once: two columns of departments, each job row tinted with its department colour from the data. */
  buildJobs() {
    const g = this.game, box = this.$('joblist');
    const list = g.rep.jobs.filter((j) => !OFF_LIST.has(j.id));
    const known = new Set(DEPTS.flatMap(([, ids]) => ids));
    const groups = DEPTS.map(([name, ids]) => [name, ids.map((id) => g.rep.jobMap[id]).filter((j) => j && !OFF_LIST.has(j.id))]);
    const other = list.filter((j) => !known.has(j.id));
    if (other.length) groups.push(['Other', other]);
    box.textContent = '';
    const cols = [document.createElement('div'), document.createElement('div')];
    for (const c of cols) { c.className = 'jcol'; box.appendChild(c); }
    let col = 0;
    for (const [name, jobs] of groups) {
      if (!jobs.length) continue;
      if (name === COL_BREAK) col = 1;
      const dept = document.createElement('div');
      dept.className = 'dept';
      dept.style.setProperty('--dc', jobs[0].color);
      const h = document.createElement('div');
      h.className = 'dept-h';
      h.append(document.createElement('i'), name);
      dept.appendChild(h);
      for (const j of jobs) {
        const row = document.createElement('div');
        row.className = 'job';
        row.dataset.id = j.id;
        row.style.setProperty('--jc', j.color);
        row.innerHTML = '<span class="jt"></span><span class="js"></span>';
        row.querySelector('.jt').textContent = j.title;
        dept.appendChild(row);
      }
      cols[col].appendChild(dept);
    }
    this.built = true;
  }

  renderJobs() {
    const g = this.game, box = this.$('joblist');
    if (!g.rep) return;
    if (!this.built) this.buildJobs();
    for (const row of box.querySelectorAll('.job')) {
      const j = g.rep.jobMap[row.dataset.id];
      const free = this.free(j);
      const full = free <= 0;
      row.classList.toggle('sel', row.dataset.id === this.selected);
      row.classList.toggle('full', full);
      row.querySelector('.js').textContent = j.id === 'assistant' ? 'any' : full ? 'full' : String(free);
    }
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
    const ready = r.players.filter((p) => p.ready).length;
    this.$('lb-count').textContent = r.state === 'lobby' ? `${ready}/${r.players.length} ready` : `${r.players.length} connected`;
  }

  statusText() {
    const rep = this.game.rep;
    const r = rep.round;
    if (r.state === 'lobby') {
      if (r.countdown !== null) {
        const left = Math.max(0, r.countdown - (performance.now() - rep.roundAt) / 1000);
        return `The round starts in ${Math.ceil(left)} seconds.`;
      }
      return 'Waiting for the round to start.';
    }
    if (r.state === 'playing') return 'Round in progress. You can join the crew now.';
    return 'The round is ending. A new one starts soon.';
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
    this.$('btn-ready').classList.toggle('lit', !!me?.ready);
    this.$('lb-status').classList.toggle('count', r.state === 'lobby' && r.countdown !== null);
    this.$('lb-hint').textContent = r.state === 'lobby' ? 'pick one, then Ready' : r.state === 'playing' ? 'pick one, then Join' : '';
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
