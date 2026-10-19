import { SIM_DT } from '../shared/config.js';

/**
 * Both transports speak the same messages (see src/sim/sim.js): the browser can host a round by itself
 * (LocalConnection runs the authoritative Sim in-page) or join a server over a WebSocket. Everything above
 * this file is oblivious to which one it is talking to.
 */

/** Runs the real Sim in this page. `lag` (ms) delays every message in both directions, for testing prediction. */
export class LocalConnection {
  constructor(assets, opts = {}) {
    this.assets = assets;
    this.opts = opts;
    this.inbox = [];
    this.lag = (opts.lag || 0) / 1000;
    this.now = 0;
    this.acc = 0;
    this.delayedIn = [];
    this.delayedOut = [];
    this.kind = 'local';
    this.ping = Math.round(this.lag * 2000);
  }

  async start(name, look) {
    const { Sim } = await import('../sim/sim.js');
    const a = this.assets;
    this.sim = new Sim({ level: a.level, rects: a.rects, jobsJson: a.jobsJson, contents: a.contents, closets: a.closets, chars: a.chars }, {
      bots: this.opts.bots ?? 14, autostart: this.opts.autostart ?? 0, god: !!this.opts.god,
    });
    this.client = this.sim.addClient(name, (m) => this.deliver(m));
    this.sim.handle(this.client, { t: 'hello', look });
  }

  deliver(m) {
    if (this.lag > 0) this.delayedIn.push({ at: this.now + this.lag, m });
    else this.inbox.push(m);
  }

  send(msg) {
    if (this.lag > 0) this.delayedOut.push({ at: this.now + this.lag, msg });
    else this.sim.handle(this.client, msg);
  }

  update(dt) {
    this.now += dt;
    while (this.delayedOut.length && this.delayedOut[0].at <= this.now) this.sim.handle(this.client, this.delayedOut.shift().msg);
    this.acc = Math.min(this.acc + dt, SIM_DT * 6);
    while (this.acc >= SIM_DT) { this.sim.step(SIM_DT); this.acc -= SIM_DT; }
    while (this.delayedIn.length && this.delayedIn[0].at <= this.now) this.inbox.push(this.delayedIn.shift().m);
  }

  poll() { const m = this.inbox; this.inbox = []; return m; }
  get closed() { return false; }
}

/** Joins a server over a WebSocket. */
export class WsConnection {
  constructor(url, opts = {}) {
    this.url = url;
    this.inbox = [];
    this.kind = 'ws';
    this.closed = false;
    this.ping = 0;
    this.lag = opts.lag || 0;           // ms of artificial delay each way, for testing prediction
  }

  start(name, look) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', name, look })); resolve(); };
      ws.onerror = () => reject(new Error('could not reach ' + this.url));
      ws.onclose = () => { this.closed = true; };
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === 'pong') { this.ping = Math.round(performance.now() - m.at); return; }
        if (this.lag) setTimeout(() => this.inbox.push(m), this.lag); else this.inbox.push(m);
      };
      this.pinger = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping', at: performance.now() })); }, 2000);
    });
  }

  send(msg) {
    const go = () => { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); };
    if (this.lag) setTimeout(go, this.lag); else go();
  }
  update() {}
  poll() { const m = this.inbox; this.inbox = []; return m; }
}
