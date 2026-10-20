// YAD3D game server: serves the client and hosts rounds over WebSocket.
//   node server/index.js [--port 8080] [--bots 14] [--autostart 45] [--name "YAD3D BoxStation"] [--debug]
//   --debug turns on the in-game debug menu for everyone connected (spawn items, teleport, god mode...): for development only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadSimData } from '../src/sim/load.js';
import { Sim } from '../src/sim/sim.js';
import { SIM_DT } from '../src/shared/config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const PORT = +arg('port', process.env.PORT || 8080);
const BOTS = +arg('bots', 14);
const AUTOSTART = +arg('autostart', 45);
const NAME = arg('name', 'YAD3D BoxStation');
const END_DELAY = +arg('endDelay', 40);           // seconds the round-end report stays up before the next round
const MAX_PLAYERS = +arg('max', 40);
const DEBUG = argv.includes('--debug');           // the debug menu and its {t:'dbg'} commands: spawn anything, heal, teleport, cause trouble (never on a public server)

const DATA = loadSimData(root);
let sim = newSim();
let roundNo = 1;

function newSim() { return new Sim(DATA, { bots: BOTS, autostart: AUTOSTART, debug: DEBUG }); }
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------- static files
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
const PUBLIC = ['index.html', 'css/', 'src/', 'vendor/', 'assets/', 'data/'];
const gz = new Map();

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const rel = path.posix.normalize(p).replace(/^\/+/, '');
  if (rel.includes('..') || !PUBLIC.some((x) => rel === x || rel.startsWith(x))) { res.writeHead(404); res.end('not found'); return; }
  const file = path.join(root, rel);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
    const text = /html|javascript|css|json/.test(type);
    if (text && /gzip/.test(req.headers['accept-encoding'] || '')) {
      const key = file + ':' + st.mtimeMs;
      let buf = gz.get(key);
      if (!buf) { buf = zlib.gzipSync(fs.readFileSync(file), { level: 6 }); gz.set(key, buf); }
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': buf.length });
      res.end(buf);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      fs.createReadStream(file).pipe(res);
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/server.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ yad3d: 1, name: NAME, players: sim.clients.size, round: roundNo, state: sim.round.state }));
    return;
  }
  serveStatic(req, res);
});

// ---------------------------------------------------------------- game connections
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const sockets = new Set();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  let client = null;
  let count = 0, windowStart = Date.now();
  sockets.add(ws);
  const hello = setTimeout(() => { if (!client) ws.close(); }, 8000);

  ws.on('message', (data) => {
    // crude flood guard: input batches arrive ~20 times a second, everything else is rarer
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; count = 0; }
    if (++count > 120) { ws.close(1008, 'too many messages'); return; }
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'ping') { ws.send(JSON.stringify({ t: 'pong', at: msg.at })); return; }
    if (!client) {
      if (msg.t !== 'hello') return;
      clearTimeout(hello);
      if (sim.clients.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: 'kick', text: 'The server is full.' })); ws.close(); return; }
      const name = String(msg.name || '').replace(/[^\w .'-]/g, '').trim().slice(0, 24) || 'Guest';
      client = sim.addClient(name, (m) => {
        if (ws.readyState !== 1) return;
        if (ws.bufferedAmount > 2e6) { ws.terminate(); return; }
        ws.send(JSON.stringify(m));
      });
      if (msg.look) sim.handle(client, { t: 'hello', look: msg.look });          // the character they designed
      log(`${name} joined from ${ip} (${sim.clients.size} online)`);
      return;
    }
    try { sim.handle(client, msg); } catch (e) { console.error('handler error', msg.t, e); }
  });

  ws.on('close', () => {
    clearTimeout(hello);
    sockets.delete(ws);
    if (client && sim.clients.has(client.id)) { sim.removeClient(client); log(`${client.name} left (${sim.clients.size} online)`); }
  });
  ws.on('error', () => {});
});

// ---------------------------------------------------------------- the clock
let last = process.hrtime.bigint();
let acc = 0;
let emptyFor = 0;
setInterval(() => {
  const now = process.hrtime.bigint();
  const dt = Number(now - last) / 1e9;
  last = now;
  const idle = sim.clients.size === 0;
  // nobody here: let a lobby sleep, and send an abandoned round back to the lobby after a couple of minutes
  if (idle && sim.round.state === 'lobby') { acc = 0; return; }
  emptyFor = idle ? emptyFor + dt : 0;
  if (idle && emptyFor > 120) { resetRound('abandoned'); return; }
  acc = Math.min(acc + dt, 0.5);
  while (acc >= SIM_DT) {
    try { sim.step(SIM_DT); } catch (e) { console.error('sim error', e); }
    acc -= SIM_DT;
  }
  if (sim.round.state === 'ending' && sim.round.endTimer > END_DELAY) resetRound('over');
}, 10);

function resetRound(why) {
  log(`round ${roundNo} ${why}; starting round ${roundNo + 1}`);
  const old = [...sockets];
  for (const ws of old) { try { ws.send(JSON.stringify({ t: 'reset', text: 'The round is over. Reconnecting for the next one...' })); } catch { /* gone */ } }
  sim = newSim();
  roundNo++;
  emptyFor = 0; acc = 0;
  setTimeout(() => { for (const ws of old) { try { ws.close(); } catch { /* gone */ } } }, 300);
}

server.listen(PORT, () => {
  log(`${NAME} listening on http://localhost:${PORT}  (bots ${BOTS}, autostart ${AUTOSTART}s)`);
  if (DEBUG) log('DEBUG MENU ENABLED: every player can spawn items, teleport and cheat. Do not run a public server like this.');
});
