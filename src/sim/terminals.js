import { KIND } from '../shared/config.js';
import { esc } from '../shared/util.js';

const NOTICES = [
  { t: 'NANOTRASEN STANDARD OPERATING PROCEDURE: HULL BREACH', b: 'In the event of a hull breach:\n\n  1. Do not panic.\n  2. Get to the nearest airtight door and close it behind you.\n  3. Put on a breath mask and connect an air tank.\n  4. Inform Engineering. A sheet of metal and a welding tool will patch most holes.\n\nNanotrasen accepts no liability for losses due to decompression.' },
  { t: 'NANOTRASEN STANDARD OPERATING PROCEDURE: POWER FAILURE', b: 'If the main grid fails, the APC emergency cells will keep essential systems running for a few minutes.\n\nEngineering restarts the engine from any Power Monitor:\n  1. Purge the coolant loop\n  2. Reset the containment field\n  3. Engage the emitters\n\nDoing these out of order will scram the engine and lock the console for several seconds.' },
  { t: 'NOTICE TO ALL STAFF: SPACE CARP', b: 'Space carp are a known hazard in this sector.\n\nSpace carp cannot open doors.\n\nDo not feed the space carp.' },
  { t: 'A REMINDER FROM HUMAN RESOURCES', b: 'Assaulting your coworkers is a violation of Space Law and of your employment contract.\n\nThe bar is open to staff who feel the need to unwind.' },
];

/** Console programs. State lives on the server; the client just renders {title, html, buttons} and sends back button presses. */
export class Terminals {
  constructor(sim) { this.sim = sim; }

  open(c, type, ctx = {}) {
    const m = c.mob;
    if (!m) return;
    c.term = { type, ctx, grid: ctx.grid || m.grid, page: 0, msg: '', x: m.x, z: m.z, fns: [], last: -9, mapAt: -9 };
    this.sim.soundTo(c, 'terminal_on', 0.8);
    this.render(c, true);
  }

  close(c) {
    if (!c.term) return;
    c.term = null;
    c.outbox.push({ e: 'term', close: 1 });
  }

  handle(c, msg) {
    const t = c.term;
    if (!t) return;
    if (msg.op === 'close') return this.close(c);
    if (msg.op === 'page') { t.page += msg.d | 0; this.render(c, true); return; }
    if (msg.op === 'act') {
      const fn = t.fns[msg.idx];
      if (fn && !fn.disabled) { this.sim.soundTo(c, 'terminal_key', 0.7); fn.fn(); }
      this.render(c, true);
    }
  }

  update(dt) {
    const sim = this.sim;
    for (const c of sim.clients.values()) {
      const t = c.term;
      if (!t) continue;
      const m = c.mob;
      if (!m || m.dead || m.grid !== t.grid || Math.hypot(m.x - t.x, m.z - t.z) > 4.5) { this.close(c); continue; }
      if (t.pending && sim.time >= t.pending.at) { const p = t.pending; t.pending = null; p.fn(); this.render(c, true); continue; }
      if (sim.time - t.last > 1) this.render(c, false);
    }
  }

  setMsg(c, text) { if (c.term) c.term.msg = text; }

  render(c, full) {
    const t = c.term;
    if (!t) return;
    const sim = this.sim;
    const prog = this.program(c, t);
    t.last = sim.time;
    t.fns = prog.buttons.map((b) => ({ fn: b.fn, disabled: !!b.disabled }));
    const ev = { e: 'term', title: prog.title, sub: prog.sub || this.clock(), html: prog.html + (t.msg ? `\n<span class="w">&gt; ${esc(t.msg)}</span>` : ''), buttons: prog.buttons.map((b) => ({ l: b.label, d: !!b.disabled })), pages: prog.pages || 0, live: !!prog.live };
    if (prog.map && (full || sim.time - t.mapAt > 3)) { ev.map = prog.map(); t.mapAt = sim.time; }
    c.outbox.push(ev);
  }

  clock() {
    const t = Math.floor(this.sim.round.time);
    return 'Round time ' + [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((v) => String(v).padStart(2, '0')).join(':');
  }

  program(c, t) {
    const sim = this.sim;
    const m = c.mob, g = t.grid, w = g.world;
    const area = w.areas[t.ctx.area ?? w.areaIdx[w.idx(m.tile[0], m.tile[1])]];
    const bar = (frac, n = 24) => '█'.repeat(Math.round(frac * n)) + '░'.repeat(n - Math.round(frac * n));
    switch (t.type) {
      case 'apc': return this.apc(g, area, bar);
      case 'airalarm': return this.airalarm(c, g, area, bar);
      case 'crew': return this.crew();
      case 'atmos': return this.atmosMap(g);
      case 'alerts': return this.alerts(g);
      case 'comms': return this.comms(c);
      case 'power': return this.powerMon(c, g, bar);
      case 'shuttle': return this.shuttle();
      case 'pod': return this.pod(c);
      case 'records': return this.records();
      case 'cargo': return { title: 'Cargo Ordering', html: '<span class="h">SUPPLY REQUISITION</span>\n\nBudget: <span class="b">0 cr</span>\n\nInsufficient funds. Please contact the Quartermaster.', buttons: [] };
      case 'rc': return { title: 'Requests Console', html: `<span class="h">${esc(area.n)}</span>\n\nNo new messages.`, buttons: [] };
      case 'news': return { title: 'Newscaster', html: `<span class="h">STATION NEWS NETWORK</span>\n\n${sim.director.newsItems().map((n) => '- ' + esc(n)).join('\n\n')}`, buttons: [] };
      case 'status': return this.status(g);
      case 'arcade': return { title: 'Arcade', html: '<span class="h">THE ORION TRAIL</span>\n\nYou have died of dysentery.\n\n<span class="d">INSERT COIN</span><span class="cursor"></span>', buttons: [] };
      default: return this.generic(t);
    }
  }

  // ---------------------------------------------------------------- programs
  generic(t) {
    const pages = NOTICES;
    const p = pages[((t.page % pages.length) + pages.length) % pages.length];
    return {
      title: (t.ctx.name || 'Station Terminal'), pages: pages.length,
      html: `<span class="h">${esc(p.t)}</span>   <span class="d">[${((t.page % pages.length) + pages.length) % pages.length + 1}/${pages.length}]</span>\n\n${esc(p.b)}`,
      buttons: [{ label: 'Next', fn: () => { t.page++; } }, { label: 'Previous', fn: () => { t.page--; } }],
    };
  }

  apc(g, area, bar) {
    const sim = this.sim, P = g.power;
    const i = g.world.areas.indexOf(area);
    const on = P.areaOn[i], lights = P.areaLights[i];
    return {
      title: 'Area Power Controller', live: true,
      html: `<span class="h">${esc(area.n)}</span>\n\nMain grid        ${P.state === 'normal' ? '<span class="c">Nominal</span>' : P.state === 'battery' ? '<span class="w">Emergency cells</span>' : '<span class="b">Offline</span>'}\nArea breaker     ${on ? '<span class="c">On</span>' : '<span class="b">Off</span>'}\nLighting         ${lights ? '<span class="c">On</span>' : '<span class="b">Off</span>'}\nEmergency cells  ${bar(P.battery)} ${Math.round(P.battery * 100)}%`,
      buttons: [
        { label: on ? 'Breaker off' : 'Breaker on', fn: () => sim.setAreaPower(g, i, !on, undefined) },
        { label: lights ? 'Lights off' : 'Lights on', fn: () => sim.setAreaPower(g, i, undefined, !lights) },
      ],
    };
  }

  airalarm(c, g, area, bar) {
    const a = g.atmos, m = c.mob;
    const [tc, tr] = m.tile;
    const p = a.pressureAt(tc, tr), o2 = a.o2At(tc, tr), n2 = a.n2[g.world.idx(tc, tr)], tox = a.toxAt(tc, tr);
    const aidx = g.world.areas.indexOf(area);
    const avg = a.areaStats.get(aidx);
    return {
      title: 'Air Alarm', live: true,
      html: `<span class="h">${esc(area.n)}</span>\n\nStatus        ${p < 30 ? '<span class="b">DANGER: low pressure</span>' : p < 80 ? '<span class="w">Warning: thin atmosphere</span>' : '<span class="c">Optimal</span>'}\nPressure      ${p.toFixed(1)} kPa   ${bar(Math.min(1, p / 101.3))}\nOxygen        ${o2.toFixed(1)} kPa\nNitrogen      ${n2.toFixed(1)} kPa\nToxins        ${tox.toFixed(2)} kPa ${tox > 0.5 ? '<span class="b">HAZARD</span>' : ''}\nArea average  ${avg !== undefined ? avg.toFixed(1) + ' kPa' : 'n/a'}\nVents         ${a.ventsOn ? '<span class="c">On</span>' : '<span class="b">Off</span>'} ${g.power.areaPowered(aidx) ? '' : '<span class="b">(no power)</span>'}`,
      buttons: [{ label: a.ventsOn ? 'Vents off' : 'Vents on', fn: () => { a.ventsOn = !a.ventsOn; } }],
    };
  }

  crew() {
    const sim = this.sim;
    const crew = [...sim.mobs.values()].filter((m) => m.kind === 'human' && !m.evacuated);
    const rows = crew.map((m) => {
      const area = m.grid?.world.areaAt(...m.tile);
      const st = m.dead ? '<span class="b">Deceased</span>' : m.body.crit ? '<span class="b">Critical</span>' : m.body.health < 60 ? '<span class="w">Injured</span>' : '<span class="c">Stable</span>';
      return `<div class="row"><span>${esc(m.name)} <span class="d">${esc(sim.jobs.get(m.job)?.title || '')}</span></span><span>${st} ${esc(area ? area.n : '?')}</span></div>`;
    });
    return {
      title: 'Crew Monitoring', live: true,
      html: `<span class="h">SUIT SENSORS</span>   <span class="d">${crew.length} signals, ${crew.filter((m) => m.dead).length} flatlined</span>\n\n${rows.join('')}`,
      buttons: [],
    };
  }

  alerts(g) {
    const w = g.world;
    const L = [];
    for (const i of w.ventTiles()) L.push(`<span class="b">Atmosphere alarm</span>  hull breach, ${esc(w.areaAt(i % w.W, Math.floor(i / w.W))?.n || 'unknown')}`);
    if (g.power.state !== 'normal') L.push(`<span class="w">Power alarm</span>  main grid ${g.power.state === 'out' ? 'offline' : 'on emergency cells'}`);
    for (const f of g.firedoors.list) if (f.closed) L.push(`<span class="w">Fire alarm</span>  firelock sealed, ${esc(w.areaAt(f.c, f.r)?.n || '')}`);
    return { title: 'Station Alerts', live: true, html: `<span class="h">ACTIVE ALARMS</span>\n\n${L.length ? L.slice(0, 24).join('\n') : '<span class="c">All systems nominal.</span>'}`, buttons: [] };
  }

  powerMon(c, g, bar) {
    const sim = this.sim, P = g.power;
    const t = c.term;
    const labels = ['Purge coolant loop', 'Reset containment field', 'Engage emitters'];
    const step = P.restartStep;
    const locked = sim.time < P.lockoutUntil;
    const s = P.state;
    const lines = labels.map((l, k) => `  ${step > k ? '<span class="c">[done]</span>' : step === k ? '<span class="w">[next]</span>' : '[    ]'}  ${k + 1}. ${l}`).join('\n');
    const html = `<span class="h">POWER MONITORING</span>\n\nMain grid     ${s === 'normal' ? '<span class="c">Online</span>' : s === 'battery' ? '<span class="w">Degraded, emergency cells only</span>' : '<span class="b">Offline</span>'}\nCell reserve  ${bar(P.battery)} ${Math.round(P.battery * 100)}%\n${s === 'battery' ? `Estimate      ~${Math.round(P.battery / P.drain)} s until blackout\n` : ''}\n<span class="h">ENGINE CONTROL</span>${s === 'normal' ? '  <span class="d">(engine running)</span>' : ''}\n${s === 'normal' ? '' : lines + '\n' + (locked ? '\n<span class="b">SCRAM: console locked out for ' + Math.ceil(P.lockoutUntil - sim.time) + ' s</span>' : '')}`;
    const mk = (k) => ({
      label: labels[k], disabled: s === 'normal' || locked || !!t.pending,
      fn: () => {
        if (step === k) {
          this.setMsg(c, `${labels[k]}...`);
          sim.soundTo(c, 'terminal_ok', 0.7);
          t.pending = { at: sim.time + 2.4, fn: () => {
            P.restartStep = k + 1;
            if (P.restartStep >= 3) { P.restartStep = 0; P.battery = 1; P.setState('normal'); sim.director.onPowerRestored(); sim.director.setLevel('blue'); this.setMsg(c, 'Engine online. Grid restored.'); }
            else this.setMsg(c, `${labels[k]} complete.`);
          } };
        } else {
          this.setMsg(c, 'Sequence fault. Engine scram.');
          sim.soundTo(c, 'terminal_no', 0.8);
          P.restartStep = 0;
          P.lockoutUntil = sim.time + 8;
        }
      },
    });
    return { title: 'Power Monitor', live: true, html, buttons: [mk(0), mk(1), mk(2)] };
  }

  comms(c) {
    const sim = this.sim, d = sim.director;
    const can = d.canCallShuttle();
    return {
      title: 'Communications Console', live: true,
      html: `<span class="h">CENTRAL COMMAND COMMUNICATIONS</span>\n\nEmergency shuttle   ${d.evacState === 'idle' ? '<span class="d">not called</span>' : d.evacState === 'called' ? `<span class="w">en route, ETA ${Math.max(0, Math.ceil(d.evacTimer))} s</span>` : d.evacState === 'docked' ? `<span class="c">docked, departs in ${Math.max(0, Math.ceil(d.evacTimer))} s</span>` : '<span class="d">departed</span>'}\n\n${can.ok ? '<span class="c">Evacuation authorized.</span>' : `<span class="d">${esc(can.why)}</span>`}`,
      buttons: [
        { label: 'Call emergency shuttle', disabled: !can.ok || d.evacState !== 'idle', fn: () => this.setMsg(c, d.callShuttle('crew', c)) },
      ],
    };
  }

  shuttle() {
    const d = this.sim.director;
    return {
      title: 'Emergency Shuttle Console', live: true,
      html: `<span class="h">SHUTTLE STATUS</span>\n\n${d.evacState === 'idle' ? 'The emergency shuttle has not been called.' : d.evacState === 'called' ? `Shuttle inbound. ETA <span class="w">${Math.ceil(d.evacTimer)} s</span>` : d.evacState === 'docked' ? `Shuttle docked. Departure in <span class="c">${Math.ceil(d.evacTimer)} s</span>.` : 'The shuttle has departed.'}`,
      buttons: [],
    };
  }

  pod(c) {
    const d = this.sim.director;
    const ok = d.evacState !== 'idle';
    return {
      title: 'Escape Pod', live: true,
      html: `<span class="h">POD LAUNCH CONTROL</span>\n\n${ok ? '<span class="c">Evacuation order active. Launch authorized.</span>' : '<span class="b">LAUNCH LOCKED</span>\nPods are released only during an evacuation.'}`,
      buttons: [{ label: 'Launch pod', disabled: !ok, fn: () => { const r = d.launchPod(c); if (r !== 'launched') this.setMsg(c, r); else this.close(c); } }],
    };
  }

  records() {
    const sim = this.sim;
    const rows = [...sim.mobs.values()].filter((m) => m.kind === 'human').slice(0, 24).map((m) => `<div class="row"><span>${esc(m.name)}</span><span>${esc(sim.jobs.get(m.job)?.title || '')}</span></div>`);
    return { title: 'Records', html: `<span class="h">CREW MANIFEST</span>\n\n${rows.join('')}`, buttons: [] };
  }

  status(g) {
    const sim = this.sim, d = sim.director;
    return { title: 'Status Display', live: true, html: `<span class="h">STATION STATUS</span>\n\nShuttle   ${d.evacState === 'idle' ? 'no active order' : d.evacState === 'called' ? 'ETA ' + Math.ceil(d.evacTimer) + ' s' : d.evacState === 'docked' ? 'docked ' + Math.ceil(d.evacTimer) + ' s' : 'departed'}\nGrid      ${g.power.state}\nBreaches  ${g.world.ventTiles().length}\nAlert     ${d.level}`, buttons: [] };
  }

  atmosMap(g) {
    const w = g.world, a = g.atmos;
    const x0 = 24, x1 = 232, y0 = 56, y1 = 192;
    return {
      title: 'Atmospherics Monitor', live: false,
      html: '<span class="h">STATION PRESSURE MAP</span>   <span class="d">green: breathable   amber: thin   red/black: vacuum   white: you</span>\n<canvas id="map-cv" width="640" height="420"></canvas>',
      buttons: [],
      map: () => {
        let s = '';
        for (let r = y0; r < y1; r++) for (let c = x0; c < x1; c++) {
          const i = w.idx(c, r);
          if (w.breached.has(i)) { s += 'B'; continue; }
          if (w.kind[i] === KIND.WALL) { s += w.glass[i] ? 'G' : 'W'; continue; }
          if (!a.isCell[i]) { s += ' '; continue; }
          if (w.areas[w.areaIdx[i]].c === 'space') { s += ' '; continue; }
          if (a.tox[i] > 1) { s += 'T'; continue; }
          const p = a.o2[i] + a.n2[i] + a.tox[i];
          s += p > 85 ? '4' : p > 60 ? '3' : p > 30 ? '2' : p > 8 ? '1' : '0';
        }
        return { x0, y0, w: x1 - x0, h: y1 - y0, data: s };
      },
    };
  }
}
