import { loadAssets } from './assets.js';
import { LocalConnection, WsConnection } from './net.js';
import { Game } from './game.js';
import { UiArt } from './art.js';
import { store } from './lobby.js';
import { Looks } from '../shared/looks.js';

const q = new URLSearchParams(location.search);
const status = (t) => { const e = document.getElementById('boot-status'); if (e) e.textContent = t; };

const FIRST = ['Alex', 'Ben', 'Cass', 'Dana', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivan', 'Jo', 'Kit', 'Lena', 'Marco', 'Nina', 'Owen', 'Pia', 'Quinn', 'Ravi', 'Sam', 'Tess', 'Uma', 'Vic', 'Wes', 'Yuri', 'Zoe'];
const LAST = ['Okafor', 'Reyes', 'Voss', 'Tanaka', 'Mercer', 'Novak', 'Haddad', 'Brandt', 'Kowal', 'Lindqvist', 'Moreau', 'Ng', 'Petrov', 'Quast', 'Rossi', 'Sato', 'Tran', 'Ueda', 'Varga', 'Walsh'];
const randomName = () => `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${LAST[Math.floor(Math.random() * LAST.length)]}`;

/** If this page is served by the game server it says so; otherwise we host the round in the browser. */
async function detectServer() {
  if (q.has('local')) return null;
  try {
    const r = await fetch('server.json', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.yad3d ? j : null;
  } catch { return null; }
}

async function main() {
  const srv = await detectServer();
  const [assets, art] = await Promise.all([loadAssets(status, { withSim: !srv }), UiArt.load(), document.fonts?.load ? Promise.all(['16px Pixellari', '16px Grand9K', '16px VCR'].map((f) => document.fonts.load(f).catch(() => null))) : null]);
  const name = q.get('name') || store.get('name') || randomName();
  store.set('name', name);
  // the character you designed last time (or a random one the first time); the server checks it before using it
  const looks = assets.looks = new Looks(assets.chars);
  let saved = null;
  try { saved = JSON.parse(store.get('look')); } catch { /* none yet */ }
  const look = saved ? looks.sanitize(saved) : looks.random(Math.random);
  store.set('look', JSON.stringify(look));
  const opts = { look, nolock: q.has('nolock'), fullbright: q.has('fullbright'), norender: q.has('norender'), name, serverName: srv?.name || '' };
  let conn;
  if (srv) {
    const url = srv.ws || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
    conn = new WsConnection(url, { lag: q.has('lag') ? +q.get('lag') : 0 });
  } else {
    conn = new LocalConnection(assets, {
      bots: q.has('bots') ? +q.get('bots') : 14, autostart: q.has('autostart') ? +q.get('autostart') : 6,
      lag: q.has('lag') ? +q.get('lag') : 0, god: q.has('god'),
    });
  }
  const game = new Game(document.getElementById('view'), assets, conn, opts, art);
  window.yad = game;
  status(srv ? 'joining ' + (srv.name || 'server') : 'starting the round');
  await conn.start(name, look);
  game.start();
  // handy for testing and for people who just want to play: ?job=station_engineer&auto skips the lobby
  if (q.has('auto')) {
    const t = setInterval(() => {
      if (!game.rep) return;
      clearInterval(t);
      game.send({ t: 'lobby', op: 'job', id: q.get('job') || 'assistant' });
      game.send({ t: 'lobby', op: 'ready', v: true });
      game.send({ t: 'lobby', op: 'start' });
    }, 100);
  }
}

main().catch((e) => {
  console.error(e);
  status('failed to start: ' + e.message);
});
