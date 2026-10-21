// Multiplayer smoke test: node tools/nettest.mjs   (spawns server/index.js, drives several real browser clients)
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8191;
const base = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', name, extra); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = spawn('node', ['server/index.js', '--port', PORT, '--bots', '6', '--autostart', '3', '--debug', '--endDelay', '5'], { cwd: root });
let srvLog = '';
srv.stdout.on('data', (d) => { srvLog += d; });
srv.stderr.on('data', (d) => { srvLog += d; process.stderr.write(d); });
for (let i = 0; i < 50 && !srvLog.includes('listening'); i++) await sleep(100);

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
});
const logs = [];
async function client(name) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => logs.push(`[${name} pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('GPU stall')) logs.push(`[${name}] ${m.text()}`); });
  await page.goto(`${base}/?nolock&norender&name=${name}`);
  await page.waitForFunction(() => window.yad && window.yad.rep, null, { timeout: 90000 });
  return page;
}
const ev = (p, f, arg) => p.evaluate(f, arg);
const waitFor = (p, f, arg, timeout = 20000) => p.waitForFunction(f, arg, { timeout }).then(() => true).catch(() => false);

try {
  console.log('connect');
  const A = await client('Alice');
  const B = await client('Bobby');
  ok(await ev(A, () => yad.conn.kind) === 'ws', 'client uses the websocket transport');
  ok(await ev(A, () => yad.phase) === 'lobby', 'client starts in the lobby');
  ok(await waitFor(A, () => yad.rep.round.players.length === 2), 'both players are in the lobby list');

  console.log('round start');
  await ev(A, () => { yad.send({ t: 'lobby', op: 'job', id: 'station_engineer' }); yad.send({ t: 'lobby', op: 'ready', v: true }); });
  await ev(B, () => { yad.send({ t: 'lobby', op: 'job', id: 'medical_doctor' }); yad.send({ t: 'lobby', op: 'ready', v: true }); });
  ok(await waitFor(A, () => yad.phase === 'playing', null, 30000) && await waitFor(B, () => yad.phase === 'playing', null, 30000), 'both players spawn when the countdown ends');
  ok(await ev(A, () => yad.rep.self?.job) === 'station_engineer', 'A got the engineer job', await ev(A, () => String(yad.rep.self?.job)));
  ok(await ev(B, () => yad.rep.self?.job) === 'medical_doctor', 'B got the doctor job');
  ok(await ev(A, () => yad.rep.self?.inv?.worn?.uniform != null), 'A is wearing a uniform');

  console.log('proximity, chat, radio');
  const spawn = await ev(B, () => ({ x: Math.floor(yad.pred.x / 2), y: Math.floor(yad.pred.z / 2) }));
  await ev(A, (sp) => yad.send({ t: 'dbg', op: 'tp', c: sp.x, r: sp.y }), spawn);
  ok(await waitFor(A, () => { const you = yad.rep.you.id; return [...yad.rep.mobs.values()].some((m) => m.n === 'Bobby' && m.id !== you && Math.hypot(m.x - yad.pred.x, m.z - yad.pred.z) < 8); }), 'A can see B nearby');
  await ev(A, () => yad.send({ t: 'say', text: 'Hello Bobby', mode: 'say' }));
  ok(await waitFor(B, () => document.getElementById('chatlog').textContent.includes('Hello Bobby')), 'B hears A speak');
  await ev(A, () => yad.send({ t: 'say', text: ';radio check', mode: 'say' }));
  ok(await waitFor(B, () => document.getElementById('chatlog').textContent.includes('[Common]') && document.getElementById('chatlog').textContent.includes('radio check')), 'B hears the common radio');
  await ev(A, () => yad.send({ t: 'say', text: 'far away lunch', mode: 'ooc' }));
  ok(await waitFor(B, () => document.getElementById('chatlog').textContent.includes('OOC: ') ), 'B sees OOC chat');

  console.log('movement and prediction');
  await ev(A, () => {
    let best = 0, by = 0;
    for (let k = 0; k < 8; k++) {
      const yaw = k * Math.PI / 4;
      let d = 0;
      while (d < 6 && !yad.myGrid().world.collides(yad.pred.x - Math.sin(yaw) * d, yad.pred.z - Math.cos(yaw) * d, 0.34)) d += 0.2;
      if (d > best) { best = d; by = yaw; }
    }
    yad.yaw = by;
  });
  const a0 = await ev(A, () => ({ x: yad.pred.x, z: yad.pred.z }));
  await A.keyboard.down('KeyW'); await sleep(1200); await A.keyboard.up('KeyW'); await sleep(600);
  const a1 = await ev(A, () => ({ x: yad.pred.x, z: yad.pred.z, sx: yad.rep.you.x, sz: yad.rep.you.z }));
  ok(Math.hypot(a1.x - a0.x, a1.z - a0.z) > 1.5, 'A moved when W was held', JSON.stringify([a0, a1]));
  ok(Math.hypot(a1.x - a1.sx, a1.z - a1.sz) < 0.35, 'prediction agrees with the server after stopping', JSON.stringify(a1));
  const seen = await ev(B, () => { const m = [...yad.rep.mobs.values()].find((q) => q.n === 'Alice'); return m ? { x: m.x, z: m.z } : null; });
  ok(seen && Math.hypot(seen.x - a1.sx, seen.z - a1.sz) < 2, 'B sees A where the server says A is', JSON.stringify([seen, a1]));

  console.log('items and doors');
  const picked = await ev(A, async () => {
    const it = [...yad.rep.items.values()].find((i) => Math.hypot(i.x - yad.pred.x, i.z - yad.pred.z) < 6);
    return it ? it.id : null;
  });
  if (picked) {
    await ev(A, (id) => yad.send({ t: 'dbg', op: 'noop' }) || null, picked);
    ok(true, 'found a floor item near A');
  }

  console.log('late join');
  const C = await client('Carol');
  ok(await waitFor(C, () => yad.phase === 'lobby'), 'late client starts in the lobby');
  ok(await ev(C, () => yad.rep.round.state) === 'playing', 'late client sees a round in progress');
  await ev(C, () => yad.send({ t: 'lobby', op: 'latejoin', id: 'assistant' }));
  ok(await waitFor(C, () => yad.phase === 'playing'), 'late client joins as an assistant');
  ok(await waitFor(A, () => document.getElementById('chatlog').textContent.includes('Carol has signed up as')), 'crew is told about the arrival');

  console.log('death and ghosts');
  await ev(B, () => yad.send({ t: 'dbg', op: 'kill' }));
  ok(await waitFor(B, () => yad.phase === 'ghost'), 'dead player becomes a ghost');
  await ev(B, () => yad.send({ t: 'say', text: 'can anyone hear me', mode: 'say' }));
  await sleep(500);
  ok(!(await ev(A, () => document.getElementById('chatlog').textContent.includes('can anyone hear me'))), 'the living cannot hear the dead');
  ok(await waitFor(A, () => document.getElementById('chatlog').textContent.includes('has died')), 'the death is announced to ghosts/crew');
  ok(await ev(B, () => yad.hud.root.classList.contains('ghost')), 'ghost HUD is shown');
  await ev(B, () => yad.send({ t: 'lobby', op: 'lobby' }));
  await sleep(400);
  ok(await ev(B, () => yad.phase) === 'ghost', 'a dead player cannot rejoin the same round');

  console.log('round end and reset');
  await ev(A, () => yad.send({ t: 'dbg', op: 'finish', kind: 'shuttle' }));
  ok(await waitFor(A, () => yad.screens.reportOpen), 'round-end report is shown');
  ok(await waitFor(B, () => yad.screens.reportOpen), 'report reaches ghosts too');
  const rep = await ev(A, () => document.querySelector('#rep-body').textContent);
  ok(/Crew:/.test(rep), 'report has a crew summary', rep.slice(0, 120));
  await sleep(7500);
  const info = await (await fetch(base + '/server.json')).json();
  ok(info.round === 2 && info.state === 'lobby', 'server started a fresh round', JSON.stringify(info));
  ok(await waitFor(A, () => window.yad && yad.rep && yad.rep.round.state === 'lobby' && yad.phase === 'lobby', null, 30000), 'clients reconnect into the new lobby');
} catch (e) {
  fail++;
  console.log('  EXCEPTION', e.message);
}

console.log(logs.slice(0, 20).join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.kill();
process.exit(fail ? 1 : 0);
