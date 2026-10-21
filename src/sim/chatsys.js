import { parseSpeech, headsetChannels, departmentChannel, RADIO, HEARING_RANGE, WHISPER_RANGE } from '../shared/chat.js';

const verbFor = (t) => (/!\s*$/.test(t) ? 'exclaims' : /\?\s*$/.test(t) ? 'asks' : 'says');

/** Speech: say / whisper / emote / radio / OOC / dead chat, routed the SS13 way. */
export class ChatSys {
  constructor(sim) { this.sim = sim; }

  /** Channels a mob's headset (ears slot) can speak on. */
  channelsOf(m) {
    const ears = m.worn?.ears;
    if (!ears || !ears.def.headset) return [];
    return headsetChannels(ears.path);
  }

  fromClient(c, msg) {
    const sim = this.sim;
    const text = String(msg.text || '').slice(0, 280);
    const p = parseSpeech(text, msg.mode || 'say');
    if (!p || !p.text) return;
    if (p.mode === 'ooc') return this.ooc(c, p.text);
    const m = c.mob;
    if (!m || m.dead || c.state === 'ghost') return this.dead(c, p.text);
    if (m.stunned > 0 && p.mode !== 'emote') { /* SS13 lets you talk while stunned */ }
    this.speak(m, p);
  }

  speak(m, p) {
    if (p.mode === 'emote') return this.emote(m, p.text);
    if (p.mode === 'radio') return this.radio(m, p.channel, p.text);
    if (p.mode === 'whisper') return this.hear(m, { k: 'whisper', name: m.name, text: p.text, verb: 'whispers' }, WHISPER_RANGE);
    return this.hear(m, { k: 'say', name: m.name, text: p.text, verb: verbFor(p.text) }, HEARING_RANGE);
  }

  /** Plain speech by an NPC. */
  npcSay(m, text) { this.speak(m, { mode: 'say', text }); }
  npcRadio(m, text, channel = 'common') { this.speak(m, { mode: 'radio', channel, text }); }

  /** Is `lm` within `range` metres of `m` and (beyond arm's length) in sight of them? Sight only reaches across one grid. */
  canHear(m, lm, range) {
    const d = this.sim.dist(lm, m);
    if (d > range) return false;
    return d <= 2 || (lm.grid === m.grid && !!m.grid && m.grid.world.los(m.x, m.z, lm.x, lm.z));
  }

  hear(m, ev, range) {
    const sim = this.sim;
    ev.mob = m.id;
    for (const c of sim.clients.values()) {
      const lm = c.mob;
      if (c.state === 'ghost' || (lm && lm.dead && c.state === 'ghost')) { c.outbox.push({ e: 'msg', ...ev, ghost: 1 }); continue; }
      if (!lm || lm.dead) continue;
      if (lm === m) { c.outbox.push({ e: 'msg', ...ev }); continue; }
      if (!this.canHear(m, lm, range)) continue;
      c.outbox.push({ e: 'msg', ...ev });
    }
    // speech floats over the head of the speaker for nearby sprite views
    sim.emit({ e: 'bubble', id: m.id, text: ev.text.slice(0, 60) }, { near: { at: m, r: range } });
  }

  radio(m, channel, text) {
    const sim = this.sim;
    const chans = this.channelsOf(m);
    if (!chans.length) { sim.tell(m, 'warning', 'You have no radio to speak into.'); return; }
    let ch = channel;
    if (ch === 'dept') ch = departmentChannel(chans);
    if (!chans.includes(ch)) { sim.tell(m, 'warning', `Your headset cannot transmit on that channel.`); return; }
    const ev = { k: 'radio', ch, name: m.name, job: sim.jobs.get(m.job)?.title, text, verb: verbFor(text), color: RADIO[ch].color, chname: RADIO[ch].name };
    for (const c of sim.clients.values()) {
      const lm = c.mob;
      if (c.state === 'ghost') { c.outbox.push({ e: 'msg', ...ev, ghost: 1 }); continue; }
      if (!lm || lm.dead || sim.mapOf(lm) !== sim.mapOf(m)) continue;
      if (this.channelsOf(lm).includes(ch)) c.outbox.push({ e: 'msg', ...ev });
    }
    sim.sound('radio_static', m, 0.15);
  }

  emote(m, text) {
    this.hear(m, { k: 'emote', name: m.name, text }, HEARING_RANGE);
  }

  ooc(c, text) {
    for (const o of this.sim.clients.values()) o.outbox.push({ e: 'msg', k: 'ooc', name: c.name, text });
  }

  dead(c, text) {
    for (const o of this.sim.clients.values()) if (o.state === 'ghost' || o.state === 'lobby') o.outbox.push({ e: 'msg', k: 'deadsay', name: c.name, text });
  }

  /** What a mob can see someone do (combat messages etc.). */
  visible(origin, text, kind = 'notice', range = 14, except = null) {
    const sim = this.sim;
    for (const c of sim.clients.values()) {
      const lm = c.mob;
      if (c.state === 'ghost') { c.outbox.push({ e: 'msg', k: kind, text }); continue; }
      if (!lm || lm.dead || (Array.isArray(except) ? except.includes(lm) : lm === except)) continue;
      if (lm !== origin && !this.canHear(origin, lm, range)) continue;
      c.outbox.push({ e: 'msg', k: kind, text });
    }
  }

  /** What you hear without seeing it ("You hear welding."): everyone in earshot except `except`, line of sight or not. */
  heard(origin, text, kind = 'notice', range = 10, except = null) {
    for (const c of this.sim.clients.values()) {
      const lm = c.mob;
      if (!lm || lm.dead || (Array.isArray(except) ? except.includes(lm) : lm === except) || c.state === 'ghost') continue;
      if (this.sim.dist(lm, origin) > range) continue;
      c.outbox.push({ e: 'msg', k: kind, text });
    }
  }

  systemAll(kind, text) { this.sim.emit({ e: 'msg', k: kind, text }); }

  announce(title, text) {
    this.sim.emit({ e: 'msg', k: 'announce', title, text });
    this.sim.emit({ e: 'snd', n: 'announce', v: 0.6 });
  }
}
