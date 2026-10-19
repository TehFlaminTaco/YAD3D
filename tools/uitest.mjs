// Single-player UI test: node tools/uitest.mjs   (needs tools/serve.py running on :8123)
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8123';
const SHOTS = process.env.SHOTS || '/tmp/uitest';
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) pass++; else { fail++; console.log('  FAIL:', name, extra); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|404/.test(m.text())) logs.push('[console] ' + m.text()); });
await page.goto(`${BASE}/index.html?nolock&auto&job=station_engineer&bots=0&autostart=1`);
await page.waitForFunction(() => window.yad && window.yad.phase === 'playing' && yad.rep.self, null, { timeout: 90000 });
const ev = (f, a) => page.evaluate(f, a);
const until = async (name, fn, arg, timeout = 6000) => { const r = await page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false); ok(r, name); return r; };
const click = (b = 'left') => page.mouse.click(480, 270, { button: b });
const hands = () => ev(() => yad.rep.self.inv.hands.map((h) => h && h.n));
await ev(() => {
  window.aim = (x, y, z) => {
    const dx = x - yad.pred.x, dz = z - yad.pred.z, dy = y - 1.45;
    yad.yaw = Math.atan2(-dx, -dz);
    yad.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  };
  // stand somewhere open next to (x, z): returns false if nowhere free
  window.standBeside = (x, z) => {
    const sim = yad.conn.sim, m = sim.clients.values().next().value.mob, w = sim.world;
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.8, 0.8], [-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8]]) {
      if (!w.collides(x + ox, z + oz, 0.34) && w.raycast(x + ox, z + oz, -ox, -oz, 1.2, 'shot') >= 1.1) { m.x = x + ox; m.z = z + oz; return true; }
    }
    return false;
  };
});

console.log('HUD basics');
ok(await ev(() => !document.getElementById('hud').classList.contains('hidden')), 'HUD is visible in play');
ok(await ev(() => yad.rep.self.inv.hands.length === 2), 'two hands');
await page.keyboard.press('Digit4');
await until('key 4 sets harm intent', () => yad.rep.self.inv.intent === 'harm');
await page.keyboard.press('Digit1');
await until('key 1 sets help intent', () => yad.rep.self.inv.intent === 'help');
await page.keyboard.press('KeyR');
await until('R toggles throw mode on', () => yad.rep.self.inv.throwMode);
await page.keyboard.press('KeyR');
await until('R toggles it off', () => !yad.rep.self.inv.throwMode);
await page.keyboard.press('KeyX');
await until('X swaps hands', () => yad.rep.self.inv.active === 1);
await page.keyboard.press('KeyX');
await until('X swaps back', () => yad.rep.self.inv.active === 0);

console.log('floor items');
const pick = await ev(() => {
  const sim = yad.conn.sim;
  const you = sim.clients.values().next().value.mob;
  for (const rec of sim.floor.values()) {
    if (rec.item.w > 3 || rec.y > 0.1) continue;
    if (sim.world.areas[sim.world.areaIdx[rec.r * sim.world.W + rec.c]].c !== 'hallway') continue;
    if (standBeside(rec.x, rec.z)) return { id: rec.item.id, name: rec.item.name, x: rec.x, y: rec.y, z: rec.z, me: [you.x, you.z] };
  }
  return null;
});
ok(pick, 'found a floor item to pick up');
await until('client catches up with the teleport', (p) => Math.hypot(yad.pred.x - p.me[0], yad.pred.z - p.me[1]) < 0.3, pick);
await ev((p) => aim(p.x, p.y + 0.2, p.z), pick);
await until('crosshair finds the item', () => yad.target && yad.target.k === 'item');
await page.screenshot({ path: SHOTS + '_hover.png' });
await click('right');
await until('right-click examines', () => document.getElementById('chatlog').textContent.includes('This is '));
await click();
await until('left click picks the item up', (n) => yad.rep.self.inv.hands.some((h) => h && h.n === n), pick.name);
await page.keyboard.press('KeyQ');
await until('Q drops it', () => !yad.rep.self.inv.hands.some(Boolean));
await until('dropped item is on the floor again', (id) => yad.rep.items.has(id), pick.id);

console.log('inventory panel');
await page.keyboard.press('KeyI');
await until('I opens the inventory', () => yad.inv.open && document.getElementById('invpanel').classList.contains('on'));
ok(await ev(() => !!document.querySelector('#invpanel [data-slot=uniform][data-item]:not([data-item=""])')), 'uniform slot is filled');
await ev(() => document.querySelector('#invpanel [data-slot=belt]').click());
await until('clicking the belt opens it', () => document.querySelectorAll('#boxes .box').length === 1);
const beltItem = await ev(() => { const c = document.querySelector('#boxes .slot.full'); return c ? +c.dataset.item : 0; });
await ev((id) => document.querySelector(`#boxes [data-item="${id}"]`).click(), beltItem);
await until('clicking a stored item takes it in hand', () => yad.rep.self.inv.hands.some(Boolean));
await page.screenshot({ path: SHOTS + '_inv.png' });
await page.keyboard.press('KeyI');
await until('I closes the inventory', () => !yad.inv.open);
await page.keyboard.press('KeyE'); await sleep(300);

console.log('terminals');
const term = await ev(() => {
  const sim = yad.conn.sim;
  const m = sim.clients.values().next().value.mob;
  const comps = sim.props.interact.filter((p) => /computer/.test(p.path || ''));
  comps.sort((a, b) => (/crew|atmos|station_alert|communications|monitor/.test(b.path) ? 1 : 0) - (/crew|atmos|station_alert|communications|monitor/.test(a.path) ? 1 : 0));
  for (const it of comps) {
    for (const [ox, oz] of [[0, 1.2], [0, -1.2], [1.2, 0], [-1.2, 0], [0, 1.6], [0, -1.6], [1.6, 0], [-1.6, 0]]) {
      if (!sim.world.collides(it.x + ox, it.z + oz, 0.34)) { m.x = it.x + ox; m.z = it.z + oz; return { idx: it.idx, name: it.name, path: it.path, x: it.x, z: it.z, me: [m.x, m.z] }; }
    }
  }
  return null;
});
ok(term, 'found a computer');
await until('client catches up with the teleport', (p) => Math.hypot(yad.pred.x - p.me[0], yad.pred.z - p.me[1]) < 0.3, term);
await ev((p) => aim(p.x, 1.0, p.z), term);
await until('a console is targeted', () => yad.target && yad.target.k === 'prop');
await ev((idx) => yad.send({ t: 'click', target: { k: 'prop', idx }, yaw: yad.yaw, pitch: yad.pitch }), term.idx);
console.log('  target:', JSON.stringify(await ev(() => yad.target && { k: yad.target.k, name: yad.target.name, idx: yad.target.idx })), 'wanted', JSON.stringify(term));
await until('clicking a computer opens its console', () => yad.term.open);
await sleep(400);
await page.screenshot({ path: SHOTS + '_term.png' });
const title = await ev(() => document.getElementById('term-title').textContent);
ok(title.length > 2, 'console has a title', title);
await page.keyboard.press('Escape');
await until('Esc closes the console', () => !yad.term.open);

console.log('map and help');
await page.keyboard.press('Tab');
await until('Tab opens the station map', () => yad.screens.mapOpen);
await sleep(300);
await page.screenshot({ path: SHOTS + '_map.png' });
await page.keyboard.press('Tab');
await until('Tab closes it', () => !yad.screens.mapOpen);
await page.keyboard.press('F1');
await until('F1 opens help', () => yad.screens.helpOpen);
await page.screenshot({ path: SHOTS + '_help.png' });
await page.keyboard.press('F1');
await until('F1 closes help', () => !yad.screens.helpOpen);

console.log('chat');
await page.keyboard.press('KeyT');
await until('T opens the chat line', () => yad.chat.isOpen && document.activeElement.id === 'chatinput');
await page.keyboard.type('testing one two'); await page.keyboard.press('Enter');
await until('typed text is spoken', () => document.getElementById('chatlog').textContent.includes('testing one two'));
ok(!(await ev(() => yad.chat.isOpen)), 'chat closes after sending');
await page.keyboard.press('KeyM');
await until('M opens the emote line', () => yad.chat.isOpen && document.activeElement.id === 'chatinput');
await page.keyboard.type('waves.'); await page.keyboard.press('Enter');
await until('M sends an emote', () => /waves\./.test(document.getElementById('chatlog').textContent));

console.log('combat messages and death');
await ev(() => { const sim = yad.conn.sim; const m = sim.clients.values().next().value.mob; m.body.damage('brute', 70, 'test'); });
await until('damage shows in the vitals', () => yad.rep.self.hp[0] < 60);
await page.screenshot({ path: SHOTS + '_hurt.png' });
await ev(() => { const sim = yad.conn.sim; const m = sim.clients.values().next().value.mob; m.body.damage('brute', 300, 'test'); });
await until('dying turns you into a ghost', () => yad.phase === 'ghost');
await sleep(500);
await page.screenshot({ path: SHOTS + '_ghost.png' });

console.log(logs.slice(0, 20).join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
