import { KIND } from '../shared/config.js';
import { esc } from '../shared/util.js';
import { GAS_IDS, GAS_NAME } from '../shared/gases.js';
import { displayPower, displayEnergy, CHANNELS } from './power/machines.js';

const NOTICES = [
  { t: 'NANOTRASEN STANDARD OPERATING PROCEDURE: HULL BREACH', b: 'In the event of a hull breach:\n\n  1. Do not panic.\n  2. Get to the nearest airtight door and close it behind you.\n  3. Put on a breath mask and connect an air tank.\n  4. Inform Engineering. A sheet of metal and a welding tool will patch most holes.\n\nNanotrasen accepts no liability for losses due to decompression.' },
  { t: 'NANOTRASEN STANDARD OPERATING PROCEDURE: POWER FAILURE', b: 'If the main grid fails, the APC emergency cells will keep essential systems running for a few minutes.\n\nTo restart the engine:\n  1. Fetch a plasma tank for every radiation collector from a tank dispenser\n  2. Put one in each collector and switch it on\n  3. Switch on the emitters (they need power from the grid: a PACMAN or the SMES will do)\n\nThe crystal will do the rest. Do not touch it.' },
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
      case 'apc': return this.apc(c, t, g, area, bar);
      case 'smes': return this.smes(c, t, bar);
      case 'solar': return this.solar(c, t);
      case 'pacman': return this.pacman(c, t);
      case 'dispenser': return this.sim.dispensers.console(c, t);
      case 'airalarm': case 'portable': return t.ctx.machine.console(c, t);          // an air alarm, a canister, a pump or a scrubber: atmosdev.js
      case 'crew': return this.crew();
      case 'atmos': return this.atmosMap(g);
      case 'atmoscontrol': return this.sim.atmoscontrol.console(c, t);                // the atmospherics monitoring computers and their gas sensors (atmoscontrol.js)
      case 'engineering': return this.engineering(c, t, g, bar);
      case 'alerts': return this.alerts(g);
      case 'comms': return this.comms(c);
      case 'power': return this.powerMon(c, t, g, bar);
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

  /** Can this person work the controls (apc.dm: the interface is locked until an ID with engine access unlocks it)? */
  engineAccess(m) { return [10, 11, 56].some((n) => m.access.has(n)); }

  apc(c, t, g, area, bar) {
    const sim = this.sim, i = g.world.areas.indexOf(area);
    const a = t.ctx.machine || g.powersim.apcOf(i);
    if (!a) return { title: 'Area Power Controller', html: `<span class="h">${esc(area.n)}</span>\n\n<span class="b">This area has no power controller.</span>`, buttons: [] };
    const m = c.mob, canUse = !a.locked || this.engineAccess(m);
    const mode = ['Off', 'Off (auto)', 'On', 'On (auto)'];
    const lab = (v) => (v >= 2 ? '<span class="c">' : '<span class="w">') + mode[v] + '</span>';
    const main = a.main === 2 ? '<span class="c">Good</span>' : a.main === 1 ? '<span class="w">Low</span>' : '<span class="b">None</span>';
    const cell = a.cell ? `${a.percent.toFixed(0)}%  ${bar(a.percent / 100, 20)}  ${a.charging === 2 ? '<span class="c">Fully charged</span>' : a.charging === 1 ? '<span class="c">Charging</span>' : '<span class="w">Not charging</span>'}` : '<span class="b">No cell</span>';
    const chan = [0, 1, 2].map((k) => `${CHANNELS[k].padEnd(12)} ${lab(a.chan[k])}   <span class="d">${displayPower(a.lastused[k])}</span>`).join('\n');
    const next = (k) => { const v = a.chan[k]; return v === 2 ? a.setsubsystem(1) : v === 0 ? a.setsubsystem(3) : a.setsubsystem(2); };
    const buttons = [
      { label: a.operating ? 'Breaker off' : 'Breaker on', disabled: !canUse, fn: () => { a.operating = !a.operating; a.publish(true); g.powersim.flush(); } },
      ...[0, 1, 2].map((k) => ({ label: `${CHANNELS[k]}: next`, disabled: !canUse, fn: () => { a.chan[k] = next(k); a.publish(true); g.powersim.flush(); } })),
      { label: a.chargemode ? 'Charging: auto' : 'Charging: off', disabled: !canUse, fn: () => { a.chargemode = !a.chargemode; } },
      { label: a.locked ? 'Unlock interface' : 'Lock interface', disabled: !this.engineAccess(m), fn: () => { a.locked = !a.locked; this.setMsg(c, a.locked ? 'You lock the APC interface.' : 'You unlock the APC interface.'); } },
      { label: a.coverlocked ? 'Cover lock: engaged' : 'Cover lock: disengaged', disabled: !canUse, fn: () => { a.coverlocked = !a.coverlocked; } },       // (apc.dm ui_act cover)
    ];
    return {
      title: 'Area Power Controller', live: true,
      html: `<span class="h">${esc(a.name || area.n)}</span>   <span class="d">${a.locked ? 'locked' : 'unlocked'}</span>\n\nMain breaker     ${a.operating ? '<span class="c">On</span>' : '<span class="b">Off</span>'}\nExternal power   ${main}\nPower cell       ${cell}\nTotal load       ${displayPower(a.lastused[0] + a.lastused[1] + a.lastused[2])}\nCover lock       ${a.coverlocked ? 'Engaged' : '<span class="w">Disengaged</span>'}\n\n${chan}${a.failureTimer ? '\n\n<span class="b">Power failure: ' + a.failureTimer * 2 + ' s</span>' : ''}${canUse ? '' : '\n\n<span class="w">The interface is locked.</span>'}`,
      buttons,
    };
  }

  smes(c, t, bar) {
    const s = t.ctx.machine, g = t.grid;
    const m = c.mob, canUse = this.engineAccess(m);
    const step = (k, d) => () => { s[k] = Math.max(0, Math.min(s[k + 'Max'], s[k] + d)); };
    return {
      title: s.name || 'Power Storage Unit', live: true,
      html: `<span class="h">${esc(s.name || 'power storage unit')}</span>${s.broken ? '   <span class="b">no power terminal</span>' : ''}\n\nStored energy    ${s.percent.toFixed(1)}%  ${bar(s.percent / 100, 20)}\n                 <span class="d">${displayEnergy(s.charge)} of ${displayEnergy(s.capacity)}</span>\n\nInput            ${s.inputAttempt ? '<span class="c">Auto</span>' : '<span class="b">Off</span>'}   ${s.inputting ? '<span class="c">charging</span>' : '<span class="w">not charging</span>'}\nInput level      ${displayPower(s.inputLevel)}  <span class="d">(max ${displayPower(s.inputLevelMax)})</span>\n\nOutput           ${s.outputAttempt ? '<span class="c">Online</span>' : '<span class="b">Offline</span>'}   ${s.outputting ? '<span class="c">' + displayPower(s.outputUsed) + '</span>' : '<span class="w">not outputting</span>'}\nOutput level     ${displayPower(s.outputLevel)}  <span class="d">(max ${displayPower(s.outputLevelMax)})</span>`,
      buttons: [
        { label: s.inputAttempt ? 'Input: off' : 'Input: auto', disabled: !canUse, fn: () => { s.inputAttempt = !s.inputAttempt; } },
        { label: 'Input -10 kW', disabled: !canUse, fn: step('inputLevel', -10000) },
        { label: 'Input +10 kW', disabled: !canUse, fn: step('inputLevel', 10000) },
        { label: s.outputAttempt ? 'Output: offline' : 'Output: online', disabled: !canUse, fn: () => { s.outputAttempt = !s.outputAttempt; } },
        { label: 'Output -10 kW', disabled: !canUse, fn: step('outputLevel', -10000) },
        { label: 'Output +10 kW', disabled: !canUse, fn: step('outputLevel', 10000) },
      ],
    };
  }

  solar(c, t) {
    const s = t.ctx.machine, sim = this.sim;
    const modes = ['Off', 'Timed', 'Auto'];
    return {
      title: s.name || 'Solar Panel Control', live: true,
      html: `<span class="h">${esc(s.name || 'solar panel control')}</span>\n\nGenerated power  ${displayPower(s.lastGen)}\nStar azimuth     ${sim.sun.azimuth.toFixed(1)} deg\nPanels           ${s.panels.length} connected, tracker ${s.tracker ? '<span class="c">yes</span>' : '<span class="w">none</span>'}\n\nTracking         ${modes[s.track]}\nPanel azimuth    ${s.azimuth.toFixed(1)} deg\nTracking rate    ${s.rate} deg/h`,
      buttons: [
        { label: `Tracking: ${modes[(s.track + 1) % 3]}`, fn: () => { s.track = (s.track + 1) % 3; if (s.track === 2 && !s.tracker) this.setMsg(c, 'No tracker is connected.'); } },
        { label: 'Azimuth +15', disabled: s.track !== 0, fn: () => { s.azimuth = (s.azimuth + 15) % 360; } },
        { label: 'Azimuth -15', disabled: s.track !== 0, fn: () => { s.azimuth = (s.azimuth + 345) % 360; } },
        { label: 'Rate +10', disabled: s.track !== 1, fn: () => { s.rate = Math.min(360, s.rate + 10); } },
        { label: 'Rate -10', disabled: s.track !== 1, fn: () => { s.rate = Math.max(-360, s.rate - 10); } },
      ],
    };
  }

  pacman(c, t) {
    const s = t.ctx.machine;
    return {
      title: 'Portable Generator', live: true,
      html: `<span class="h">${esc(s.name)}</span>\n\nStatus           ${s.active ? '<span class="c">On</span>' : '<span class="w">Off</span>'}\nPlasma           ${s.sheets} sheets, ${Math.round(s.sheetLeft * 1000) / 10}% of the next\nOutput           ${displayPower(s.powerGen * s.powerOutput)}  <span class="d">(level ${s.powerOutput}, power ${displayPower(s.powerGen)} a level)</span>\nConnected        ${s.net ? '<span class="c">yes</span>' : '<span class="b">no</span>'}   ${s.net ? displayPower(s.net.avail) + ' on the line' : ''}`,
      buttons: [
        { label: s.active ? 'Stop' : 'Start', disabled: !s.active && !s.hasFuel(), fn: () => { if (!s.toggle()) this.setMsg(c, 'It has no fuel.'); } },
        { label: 'Output lower', fn: () => { if (s.powerOutput > 1) s.powerOutput--; } },
        { label: 'Output higher', fn: () => { if (s.powerOutput < 4) s.powerOutput++; } },
        { label: 'Eject fuel', disabled: s.active || s.sheets < 1, fn: () => { s.eject(c.mob); } },
      ],
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
    for (const a of g.powersim.machines.apc) if (a.frame && a.alarm) L.push(`<span class="w">Power alarm</span>  ${esc(w.areas[a.areaIdx]?.n || a.name)}${a.cell ? ', ' + a.percent.toFixed(0) + '% charge' : ', no cell'}`);
    for (const f of g.firedoors.list) if (f.closed) L.push(`<span class="w">Fire alarm</span>  firelock sealed, ${esc(w.areaAt(f.c, f.r)?.n || '')}`);
    return { title: 'Station Alerts', live: true, html: `<span class="h">ACTIVE ALARMS</span>\n\n${L.length ? L.slice(0, 24).join('\n') : '<span class="c">All systems nominal.</span>'}`, buttons: [] };
  }

  /** The power monitoring console (powermonitor.dm): supply, demand, and every APC on the network. */
  powerMon(c, t, g, bar) {
    const ps = g.powersim, m = c.mob;
    // the network it is on: the one under it, else the one with the most APCs
    const w = g.world, here = ps.cables.net(w.idx(Math.floor(t.x / 2), Math.floor(t.z / 2)));
    const count = new Map();
    for (const a of ps.machines.apc) { const n = a.net; if (n) count.set(n, (count.get(n) || 0) + 1); }
    const net = here || [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!net) return { title: 'Power Monitor', html: '<span class="h">POWER MONITORING</span>\n\n<span class="b">No connection to a power network.</span>', buttons: [] };
    const apcs = ps.machines.apc.filter((a) => a.net === net).sort((x, y) => (w.areas[x.areaIdx]?.n || '').localeCompare(w.areas[y.areaIdx]?.n || ''));
    const PER = 12, pages = Math.max(1, Math.ceil(apcs.length / PER));
    const page = ((t.page % pages) + pages) % pages;
    const hist = net.history.slice(-24);
    const top = Math.max(1, ...hist.map((h) => Math.max(h[0], h[1])), net.viewavail, net.viewload);
    const spark = (k) => hist.map((h) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor(h[k] / top * 7.99))]).join('');
    const ch = (v) => ['off', 'off*', 'on', 'on*'][v];
    const rows = apcs.slice(page * PER, page * PER + PER).map((a) => {
      const area = w.areas[a.areaIdx];
      const ok = a.chan.every((v) => v >= 2) && a.operating;
      return `<div class="row"><span>${esc(area?.n || a.name)}</span><span>${a.cell ? a.percent.toFixed(0).padStart(3) + '%' + (a.charging === 1 ? '+' : a.charging === 2 ? '=' : '-') : ' --'} ${displayPower(a.lastused[0] + a.lastused[1] + a.lastused[2]).padStart(8)}  <span class="${ok ? 'c' : 'w'}">${ch(a.chan[0])} ${ch(a.chan[1])} ${ch(a.chan[2])}</span></span></div>`;
    });
    return {
      title: 'Power Monitor', live: true, pages,
      html: `<span class="h">POWER MONITORING</span>   <span class="d">[${page + 1}/${pages}]</span>\n\nSupply   ${displayPower(net.viewavail).padStart(9)}  <span class="c">${spark(0)}</span>\nDemand   ${displayPower(net.viewload).padStart(9)}  <span class="w">${spark(1)}</span>\n\n<span class="d">${apcs.length} power controllers   (cell, load, equipment lighting environment)</span>\n${rows.join('')}`,
      buttons: [{ label: 'Next', fn: () => { t.page++; } }, { label: 'Previous', fn: () => { t.page--; } }],
    };
  }

  /** The engineering computer (a modular console with the engineering programs): a menu of the power monitor, the alarm monitor and the supermatter monitor. */
  engineering(c, t, g, bar) {
    t.view ??= 0;
    const menu = { label: 'Main menu', fn: () => { t.view = 0; t.page = 0; } };
    if (t.view === 0) {
      return {
        title: 'Engineering Console', live: false,
        html: '<span class="h">NTOS ENGINEERING</span>\n\nChoose a program:\n\n  Power Monitoring\n  Alarm Monitoring\n  Supermatter Monitoring',
        buttons: [
          { label: 'Power Monitoring', fn: () => { t.view = 1; t.page = 0; } },
          { label: 'Alarm Monitoring', fn: () => { t.view = 2; } },
          { label: 'Supermatter Monitoring', fn: () => { t.view = 3; } },
        ],
      };
    }
    const inner = t.view === 1 ? this.powerMon(c, t, g, bar) : t.view === 2 ? this.alerts(g) : this.smMonitor(g);
    return { ...inner, buttons: [...(inner.buttons || []), menu] };
  }

  /** Supermatter monitoring (sm_monitor.dm), with what this game's crystal has: its power, the air of its chamber, the emitters and the collectors. (No integrity or temperature yet.) */
  smMonitor(g) {
    const sm = g.powersim.machines.supermatter[0];
    if (!sm) return { title: 'Supermatter Monitoring', html: '<span class="h">SUPERMATTER MONITORING</span>\n\n<span class="b">No supermatter crystals detected.</span>', buttons: [] };
    const gas = g.atmos.gasesAt(sm.tile % g.world.W, Math.floor(sm.tile / g.world.W), sm.rec.l | 0);
    const tot = GAS_IDS.reduce((s, id) => s + (gas[id] || 0), 0);
    const rows = GAS_IDS.filter((id) => (gas[id] || 0) > 0.0005 * tot).map((id) => `  ${esc(GAS_NAME[id]).padEnd(16)} ${((gas[id] || 0) / tot * 100).toFixed(1).padStart(6)} %`).join('\n');
    const emitters = g.powersim.machines.emitter, collectors = g.powersim.machines.collector;
    return {
      title: 'Supermatter Monitoring', live: true,
      html: `<span class="h">SUPERMATTER MONITORING</span>\n\nCrystal            <span class="c">stable</span>\nRelative EER       ${displayPower(sm.power).padStart(10)}\nChamber pressure   ${gas.pressure.toFixed(1).padStart(8)} kPa\n${rows || '  (vacuum)'}\n\nEmitters           ${emitters.filter((e) => e.active).length}/${emitters.length} firing\nCollectors         ${collectors.filter((k) => k.active).length}/${collectors.length} on`,
      buttons: [],
    };
  }

  comms(c) {
    const sim = this.sim, d = sim.director;
    const can = d.canCallShuttle();
    return {
      title: 'Communications Console', live: true,
      html: `<span class="h">CENTRAL COMMAND COMMUNICATIONS</span>\n\nEmergency shuttle   ${d.evacState === 'idle' ? '<span class="d">not called</span>' : d.evacState === 'called' ? `<span class="w">en route, ETA ${Math.max(0, Math.ceil(d.evacTimer))} s</span>` : d.evacState === 'docked' ? `<span class="c">docked, departs in ${Math.max(0, Math.ceil(d.evacTimer))} s</span>` : d.evacState === 'centcom' ? `<span class="c">docked at Central Command</span>` : '<span class="d">departed</span>'}\n\n${can.ok ? '<span class="c">Evacuation authorized.</span>' : `<span class="d">${esc(can.why)}</span>`}`,
      buttons: [
        { label: 'Call emergency shuttle', disabled: !can.ok || d.evacState !== 'idle', fn: () => this.setMsg(c, d.callShuttle('crew', c)) },
      ],
    };
  }

  shuttle() {
    const d = this.sim.director;
    return {
      title: 'Emergency Shuttle Console', live: true,
      html: `<span class="h">SHUTTLE STATUS</span>\n\n${d.evacState === 'idle' ? 'The emergency shuttle has not been called.' : d.evacState === 'called' ? `Shuttle inbound. ETA <span class="w">${Math.ceil(d.evacTimer)} s</span>` : d.evacState === 'docked' ? `Shuttle docked. Departure in <span class="c">${Math.ceil(d.evacTimer)} s</span>.` : d.evacState === 'centcom' ? 'The shuttle has docked at Central Command.' : 'The shuttle has departed.'}`,
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
    return { title: 'Status Display', live: true, html: `<span class="h">STATION STATUS</span>\n\nShuttle   ${d.evacState === 'idle' ? 'no active order' : d.evacState === 'called' ? 'ETA ' + Math.ceil(d.evacTimer) + ' s' : d.evacState === 'docked' ? 'docked ' + Math.ceil(d.evacTimer) + ' s' : 'departed'}\nGrid      ${g.powersim.status()}\nBreaches  ${g.world.ventTiles().length}\nAlert     ${d.level}`, buttons: [] };
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
          if (a.tox[i] > 1 || a.co2[i] > 10 || a.n2o[i] > 1) { s += 'T'; continue; }
          const p = a.total(i);
          s += p > 85 ? '4' : p > 60 ? '3' : p > 30 ? '2' : p > 8 ? '1' : '0';
        }
        return { x0, y0, w: x1 - x0, h: y1 - y0, data: s };
      },
    };
  }
}
