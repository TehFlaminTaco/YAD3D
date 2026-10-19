// Single-player browser test of the UI (look / hands modes, drag & drop, hands, bags, body panel, PDA, effects).
//   node tools/uitest.mjs            (needs tools/serve.py serving the project, by default on :8123)
//   BASE=http://host:port  SHOTS=/path/prefix  node tools/uitest.mjs
// The round runs in the page (LocalConnection), so the test can set the scene up through yad.conn.sim (teleport,
// spawn items, hurt you) and then drive everything under test with the real keyboard and mouse. Frames are slow
// under swiftshader (and the in-page sim only advances with frames), so every check polls for its condition.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8123';
const SHOTS = process.env.SHOTS || '/tmp/uitest';
const W = 1280, H = 720;
let pass = 0, fail = 0;
const failed = [];
const ok = (c, name, extra = '') => {
  if (c) { pass++; console.log('  ok   ' + name); } else { fail++; failed.push(name); console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
  return !!c;
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|404|GroupMarker/.test(m.text())) logs.push('[console] ' + m.text()); });

const ev = (f, a) => page.evaluate(f, a);
/** Poll for a condition in the page; on failure print what `diag` says about the state. */
const until = async (name, fn, arg, timeout = 15000, diag) => {
  const r = await page.waitForFunction(fn, arg, { timeout, polling: 60 }).then(() => true).catch(() => false);
  let extra = '';
  if (!r && diag) extra = JSON.stringify(await ev(diag, arg).catch((e) => 'diag failed: ' + e.message));
  return ok(r, name, extra);
};
const wait = (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 60 }).then(() => true).catch(() => false);
const frames = (n = 2) => ev((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = (name) => page.screenshot({ path: `${SHOTS}_${name}.png` }).then(() => console.log(`  shot ${SHOTS}_${name}.png`));
const key = (k) => page.keyboard.press(k);
const section = async (name, fn) => {
  console.log('\n' + name);
  try { await fn(); } catch (e) { ok(false, `${name}: no exception`, e.message.split('\n')[0]); }
};
const self = () => ev(() => yad.self && { inv: yad.self.inv, hp: yad.self.hp, crit: yad.self.crit, dead: yad.self.dead });
const diagInv = () => ({ mode: yad.mode, hands: yad.self?.inv?.hands.map((h) => h && [h.id, h.n]), active: yad.self?.inv?.active, open: yad.self?.inv?.open, cursor: yad.cursorTarget && [yad.cursorTarget.k, yad.cursorTarget.id ?? yad.cursorTarget.idx], target: yad.target && [yad.target.k, yad.target.id ?? yad.target.idx], log: [...document.querySelectorAll('#chatlog > div')].slice(-3).map((d) => d.textContent) });

// ------------------------------------------------------------------ mouse helpers
async function moveTo(xy, steps = 4) { await page.mouse.move(xy[0], xy[1], { steps }); }
/** Press at `from`, carry the mouse to `to` in steps, release. */
async function drag(from, to, opt = {}) {
  await moveTo(from, 2);
  if (opt.ready) await opt.ready();
  await page.mouse.down();
  await page.mouse.move(from[0] + (to[0] - from[0]) * 0.5, from[1] + (to[1] - from[1]) * 0.5, { steps: 6 });
  if (opt.mid) await opt.mid();
  await page.mouse.move(to[0], to[1], { steps: 6 });
  await frames(2);
  await page.mouse.up();
}
/** Hands mode: put the pointer on the floor item `id` and wait until the game agrees it is under the cursor. */
async function hoverItem(id) {
  const xy = await ev((id) => { const it = yad.rep.items.get(id); return it && T.proj(it.x, it.y + 0.1, it.z); }, id);
  if (!xy) return null;
  await moveTo(xy, 3);
  await wait((id) => yad.cursorTarget && yad.cursorTarget.k === 'item' && yad.cursorTarget.id === id, id, 8000);
  return xy;
}
const handXY = (i) => ev((i) => T.handXY(i), i);
const centerOf = (sel) => ev((sel) => T.center(sel), sel);
async function setMode(m) {
  if (await ev(() => yad.mode) !== m) await key('Space');
  await wait((m) => yad.mode === m, m, 8000);
  if (m === 'hands') { await moveTo([W / 2 + 3, H / 2 + 3], 2); await moveTo([W / 2, H / 2], 2); }
}
/** Teleport (through the in-page sim) and wait until our predicted position caught up. */
async function teleport(x, z, yaw, pitch = 0) {
  await ev((p) => { T.tp(p.x, p.z); if (p.yaw !== undefined) { yad.yaw = p.yaw; yad.pitch = p.pitch; } }, { x, z, yaw, pitch });
  await wait((p) => Math.hypot(yad.pred.x - p.x, yad.pred.z - p.z) < 0.15 && Math.hypot(yad.pred.vx, yad.pred.vz) < 0.05, { x, z }, 15000);
  await frames(3);
}

// ------------------------------------------------------------------ boot
const t0 = Date.now();
await page.goto(`${BASE}/index.html?nolock&auto&job=station_engineer&bots=0&autostart=1`);
const booted = await wait(() => window.yad && yad.phase === 'playing' && yad.self?.inv && yad.rep?.you, null, 120000);
ok(booted, 'the round starts and you spawn as a station engineer');
if (!booted) { console.log(logs.join('\n')); await browser.close(); process.exit(1); }
console.log(`  (booted in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

// test fixtures, run inside the page: they only set the scene up; everything under test goes through input
await ev(async () => {
  const inv = await import('/src/sim/inventory.js');
  const sim = yad.conn.sim, w = sim.world;
  const T = window.T = {
    sim, inv,
    get client() { return [...sim.clients.values()][0]; },
    get mob() { return T.client.mob; },
    tp(x, z) { const m = T.mob; m.x = x; m.z = z; m.vx = m.vz = 0; },
    /** Clear distance from (x, z) along yaw, for a body of radius 0.36. */
    lane(x, z, yaw, max = 14) {
      const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
      let d = 0;
      while (d < max && !w.collides(x + dx * d, z + dz * d, 0.36)) d += 0.25;
      return Math.min(d, w.raycast(x, z, dx, dz, max, 'shot'));
    },
    /** A hallway tile centre with a long clear lane ahead and no floor items around, far from the `avoid` points. */
    openSpot(minLane = 10, avoid = []) {
      const floor = [...sim.floor.values()];
      for (let r = 0; r < w.H; r++) {
        for (let c = 0; c < w.W; c++) {
          const i = r * w.W + c;
          if (w.areas[w.areaIdx[i]]?.c !== 'hallway' || w.solid[i]) continue;
          const x = c * 2 + 1, z = r * 2 + 1;
          if (w.collides(x, z, 0.4) || sim.atmos.pressureAt(c, r) < 90) continue;
          if (avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < 16)) continue;
          if (floor.some((f) => Math.hypot(f.x - x, f.z - z) < 7)) continue;
          if ([...sim.mobs.values()].some((m) => Math.hypot(m.x - x, m.z - z) < 10)) continue;
          for (let k = 0; k < 4; k++) {
            const yaw = k * Math.PI / 2;
            if (T.lane(x, z, yaw) >= minLane && T.lane(x, z, yaw + Math.PI) >= 1.5) return { x, z, yaw };
          }
        }
      }
      return null;
    },
    /** Lay a fresh item on the floor at (x, z). */
    spawn(path, x, z) { const it = sim.newItem(path); inv.place(sim, it, x, z); return { id: it.id, n: it.name, s: it.sprite }; },
    /** Lay a fresh item on the floor `d` metres in front of you (`side` metres to the right). */
    spawnAhead(path, d, side = 0) {
      const m = T.mob, yaw = yad.yaw;
      const x = m.x - Math.sin(yaw) * d + Math.cos(yaw) * side, z = m.z - Math.cos(yaw) * d - Math.sin(yaw) * side;
      return { ...T.spawn(path, x, z), x, z };
    },
    give(path, i) { const it = sim.newItem(path); inv.attach(sim, it, { t: 'hand', mob: T.mob, i }); inv.recalc(sim, T.mob); return { id: it.id, n: it.name }; },
    clearHands() { for (const it of T.mob.hands) if (it) { inv.detach(sim, it); sim.items.delete(it.id); } T.mob.dirty = true; },
    healAll() { const b = T.mob.body; for (const k of ['brute', 'burn', 'tox', 'oxy']) b.heal(k, 999); T.mob.dirty = true; },
    proj(x, y, z) { const v = new yad.camera.position.constructor(x, y, z).project(yad.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
    center(sel) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
    handXY(i) { const r = document.querySelector(`#hands [data-hand="${i}"]`).getBoundingClientRect(); return [r.left + r.width / 2, Math.min(innerHeight - 20, r.top + r.height * 0.62)]; },
    /** A screen point where a drop puts a thing on the floor within reach, with nothing else under the cursor. */
    dropSpot(minR = 1.0, maxR = 2.4) {
      for (let y = innerHeight * 0.5; y < innerHeight * 0.95; y += 12) {
        for (let x = innerWidth * 0.4; x < innerWidth * 0.6; x += 16) {
          if (document.elementFromPoint(x, y) !== yad.canvas) continue;
          const r = yad.rayAt(x, y), fp = yad.floorPoint(r.o, r.d);
          if (!fp || !fp.ok || fp.reach < minR || fp.reach > maxR || yad.findTarget(r.o, r.d)) continue;
          return { xy: [x, y], fp: { x: fp.x, z: fp.z } };
        }
      }
      return null;
    },
    /** Sample the springs of hand i for n frames into T.spr. */
    sampleSprings(i, n) {
      const H = yad.hands.h[i], out = [];
      T.spr = { done: false, out };
      const f = () => {
        const m = /rotate\((-?[\d.]+)deg\) scale\((-?[\d.]+), (-?[\d.]+)\)/.exec(H.anim.style.transform) || [];
        out.push({ r: H.sp.r.x, y: H.sp.y.x, sx: H.sp.sx.x, sy: H.sp.sy.x, domR: +m[1], domSx: +m[2], domSy: +m[3] });
        if (out.length < n) requestAnimationFrame(f); else T.spr.done = true;
      };
      requestAnimationFrame(f);
    },
    /** Pixels with any alpha in a canvas, and a cheap fingerprint of what is drawn. */
    paint(cv) {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0, h = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k + 3]) { n++; h = (h * 31 + d[k] * 7 + d[k + 1] * 3 + d[k + 2] + k) >>> 0; }
      return { n, h };
    },
    textOutside(skip) {
      const out = [];
      const walk = (el) => {
        if (skip.some((s) => el.matches?.(s))) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.textContent.trim()) out.push(n.textContent.trim());
          else if (n.nodeType === 1) walk(n);
        }
      };
      walk(document.body);
      return out;
    },
  };
});

// a quiet hallway with a long clear lane ahead: most of the test happens here
const spot = await ev(() => T.openSpot(10));
ok(spot, 'found an open hallway to test in', JSON.stringify(spot));
const home = async (pitch = -0.45) => { await teleport(spot.x, spot.z, spot.yaw, pitch); };
await home();
await ev(() => T.clearHands());
await wait(() => yad.self.inv.hands.every((h) => !h));

// ------------------------------------------------------------------ HUD
await section('HUD: nothing but a crosshair', async () => {
  ok(await ev(() => !document.getElementById('hud').classList.contains('hidden')), 'HUD is shown in play');
  ok(await ev(() => !document.querySelector('#tracker, #topright, #bottom, #radar, #minimap, #vitals, #invbar, #invpanel')), 'no radar, vitals bars or readout panels (#tracker, #topright, #bottom...)');
  const kids = await ev(() => [...document.getElementById('hud').children].map((e) => e.id));
  ok(kids.every((k) => ['runechat', 'cross', 'hover', 'progress', 'ghostbar', 'toast'].includes(k)), 'HUD holds only crosshair, hover label, progress, runechat, ghost bar and toast', kids.join(','));
  ok(await ev(() => yad.mode) === 'look', 'you start in look mode');
  await until('crosshair is drawn in look mode', () => getComputedStyle(document.getElementById('cross')).display === 'block');
  // nothing on screen reads out numbers at you: only the chat log has text
  await frames(3);
  const txt = await ev(() => T.textOutside(['#chat', '#toast:not(.on)', '#lobby', '.screen:not(.on)']));
  ok(txt.length === 0, 'no visible text outside the chat log (no readouts)', JSON.stringify(txt.slice(0, 6)));
  ok(await ev(() => !yad.pda.open && !yad.body.open && !yad.bags.openIds.length), 'no panels are open');
  await shot('hud');
});

// ------------------------------------------------------------------ hands
await section('hands: visible, intents, springs', async () => {
  await until('both hands are on screen in play', () => {
    const r = document.getElementById('hands');
    if (getComputedStyle(r).display === 'none') return false;
    return [...r.querySelectorAll('.hand')].every((h) => { const b = h.getBoundingClientRect(); return b.width > 50 && b.top < innerHeight - 60 && b.bottom > innerHeight * 0.7; });
  });
  ok(await ev(() => [...document.querySelectorAll('#hands .hand canvas')].every((c) => T.paint(c).n > 300)), 'both hands are painted');
  ok(await ev(() => document.querySelector('#hands [data-hand="0"]').classList.contains('active')), 'the active hand is marked');
  const poses = {};
  for (const [k, intent, pose] of [['Digit2', 'disarm', 'push'], ['Digit3', 'grab', 'claw'], ['Digit4', 'harm', 'fist'], ['Digit1', 'help', 'open']]) {
    await key(k);
    await until(`key ${k.slice(5)} sets ${intent} intent`, (i) => yad.self.inv.intent === i, intent);
    await until(`the empty hand takes the ${pose} pose`, (p) => yad.hands.h[yad.self.inv.active].key.includes('|' + p + '|'), pose, 8000, () => yad.hands.h.map((h) => h.key));
    poses[pose] = await ev(() => T.paint(yad.hands.h[yad.self.inv.active].cv).h);
    if (pose === 'fist') await shot('fist');
  }
  ok(new Set(Object.values(poses)).size === 4, 'each intent draws a different hand', JSON.stringify(poses));

  // dorky springs: an intent change kicks the hand, which wobbles past its rest pose and settles
  await frames(40);
  await ev(() => T.sampleSprings(yad.self.inv.active, 75));
  await key('Digit4');
  await wait(() => T.spr.done, null, 60000);
  const spr = await ev(() => T.spr.out);
  const rs = spr.map((s) => s.r);
  const peak = Math.max(...rs.map(Math.abs));
  let flips = 0;
  for (let k = 1; k < rs.length; k++) if (Math.abs(rs[k]) > 0.5 && Math.abs(rs[k - 1]) > 0.5 && Math.sign(rs[k]) !== Math.sign(rs[k - 1])) flips++;
  ok(peak > 8, 'changing intent kicks the hand into a wobble (rotation peak > 8 deg)', `peak ${peak.toFixed(1)}`);
  ok(flips >= 1, 'the wobble overshoots its rest pose (springy, under-damped)', `sign flips ${flips}, r: ${rs.filter((_, k) => k % 5 === 0).map((v) => v.toFixed(1)).join(' ')}`);
  ok(Math.abs(rs[rs.length - 1]) < 2.5, 'and settles back', `last ${rs[rs.length - 1].toFixed(2)}`);
  ok(spr.some((s) => Math.abs(s.sx - 1) > 0.02 || Math.abs(s.sy - 1) > 0.02), 'it squashes and stretches', JSON.stringify(spr.slice(0, 6).map((s) => [s.sx.toFixed(3), s.sy.toFixed(3)])));
  ok(spr.filter((s) => Number.isFinite(s.domR)).length > spr.length * 0.8 && spr.some((s) => Math.abs(s.domR - s.r) < 0.02 && Math.abs(s.domR) > 3), 'the wobble is applied to the hand on screen (CSS transform)');
  await key('Digit1');
  await until('back to help intent', () => yad.self.inv.intent === 'help');
});

// ------------------------------------------------------------------ keys
await section('keys: X, E, R, Q', async () => {
  await key('KeyX');
  await until('X swaps hands', () => yad.self.inv.active === 1 && document.querySelector('#hands [data-hand="1"]').classList.contains('active'));
  await key('KeyX');
  await until('X swaps back', () => yad.self.inv.active === 0);
  await key('KeyE');
  await until('E with an empty hand draws a tool from your belt', () => !!yad.self.inv.hands[0], null, 15000, diagInv);
  const drawn = await ev(() => yad.self.inv.hands[0]);
  await until('the hand holds the real item sprite', (s) => yad.hands.h[0].key.startsWith(`${s.id}:${s.s}|hold`), drawn, 8000, () => yad.hands.h[0].key);
  await shot('holding');
  await key('KeyE');
  await until('E puts it away again', (id) => !yad.self.inv.hands[0] && yad.invIndex.has(id), drawn.id, 15000, diagInv);
  await key('KeyE');
  await until('E draws again', () => !!yad.self.inv.hands[0]);
  const it = await ev(() => yad.self.inv.hands[0]);
  await key('KeyR');
  await until('R turns throw mode on', () => yad.self.inv.throwMode);
  await until('the hand cocks back to throw', () => { const H = yad.hands.h[0]; return H.sp.r.x < -10 && H.sp.x.x < -2; }, null, 15000, () => ({ r: yad.hands.h[0].sp.r.x, x: yad.hands.h[0].sp.x.x }));
  await key('KeyR');
  await until('R turns it off', () => !yad.self.inv.throwMode);
  await key('KeyQ');
  await until('Q drops what you hold', (id) => !yad.self.inv.hands[0] && yad.rep.items.has(id), it.id, 15000, diagInv);
  ok(await ev((id) => { const i = yad.rep.items.get(id); return i && Math.hypot(i.x - yad.pred.x, i.z - yad.pred.z) < 1.5; }, it.id), 'it lands at your feet');
  await ev((id) => { const r = T.sim.floor.get(id); if (r) { T.inv.detach(T.sim, r.item); T.sim.items.delete(id); } }, it.id);
});

// ------------------------------------------------------------------ modes
await section('look / hands modes', async () => {
  await key('Space');
  await until('Space switches to hands mode', () => yad.mode === 'hands' && document.body.classList.contains('handsmode'));
  await until('the crosshair goes away in hands mode', () => getComputedStyle(document.getElementById('cross')).display === 'none');
  await moveTo([W / 2, H / 2]);
  await until('the cursor is a pixel hand', () => /--cur-point/.test(yad.canvas.style.cursor) && /^url\(/.test(getComputedStyle(document.documentElement).getPropertyValue('--cur-point').trim()), null, 8000, () => [yad.canvas.style.cursor, getComputedStyle(document.documentElement).getPropertyValue('--cur-point').slice(0, 40)]);
  ok(await ev(() => getComputedStyle(document.querySelector('#hands .hand')).pointerEvents === 'auto'), 'hands become drop targets in hands mode');
  await key('Space');
  await until('Space goes back to look mode', () => yad.mode === 'look' && !document.body.classList.contains('handsmode'));
  ok(await ev(() => getComputedStyle(document.querySelector('#hands .hand')).pointerEvents === 'none'), 'hands ignore the pointer in look mode');
  // losing pointer lock (Esc in a real browser) hands you the cursor
  await ev(() => yad.input.onLockChange(false));
  await until('losing the pointer lock lands in hands mode', () => yad.mode === 'hands');
  await key('Space');
  await until('and Space returns to look', () => yad.mode === 'look');
});

// ------------------------------------------------------------------ look mode
await section('look mode: crosshair click, examine', async () => {
  await home(-0.5);
  const it = await ev(() => T.spawnAhead('/obj/item/wrench', 1.25));
  await wait((id) => yad.rep.items.has(id), it.id);
  await ev((p) => { const dx = p.x - yad.pred.x, dz = p.z - yad.pred.z; yad.yaw = Math.atan2(-dx, -dz); yad.pitch = Math.atan2(0.15 - 1.45, Math.hypot(dx, dz)); }, it);
  await until('the crosshair finds the item', (id) => yad.target && yad.target.k === 'item' && yad.target.id === id, it.id, 15000, diagInv);
  await until('its name shows under the crosshair', (n) => document.getElementById('hover').textContent === n && getComputedStyle(document.getElementById('hover')).display === 'block', it.n);
  ok(await ev(() => document.getElementById('cross').classList.contains('hot')), 'the crosshair lights up');
  await shot('look_target');
  await page.mouse.click(W / 2, H / 2, { button: 'right' });
  await until('right-click examines it', (n) => [...document.querySelectorAll('#chatlog > div')].some((d) => d.textContent.includes('This is') && d.textContent.includes(n)), it.n);
  ok(await ev((id) => yad.rep.items.has(id), it.id), 'examining does not pick it up');
  await page.mouse.click(W / 2, H / 2);
  await until('left click picks it up into the active hand', (id) => yad.self.inv.hands[yad.self.inv.active]?.id === id, it.id, 15000, diagInv);
  ok(await ev((id) => !yad.rep.items.has(id), it.id), 'it is gone from the floor');
  await ev(() => T.clearHands());
  await wait(() => yad.self.inv.hands.every((h) => !h));
});

// ------------------------------------------------------------------ hands mode: world <-> hands
let floorItem = null;
await section('hands mode: hover, click, drag between the world and your hands', async () => {
  await home(-0.5);
  const a = await ev(() => T.spawnAhead('/obj/item/screwdriver', 1.4, -0.25));
  await wait((id) => yad.rep.items.has(id), a.id);
  await setMode('hands');
  const xy = await hoverItem(a.id);
  await until('hovering a floor item targets it (cursorTarget.k === item)', (id) => yad.cursorTarget?.k === 'item' && yad.cursorTarget.id === id, a.id, 8000, diagInv);
  await until('the pointer opens its hand over it', () => /--cur-open/.test(yad.canvas.style.cursor));
  await until('its name follows the pointer', (n) => document.getElementById('hover').textContent === n, a.n);
  await shot('hands_hover');
  await page.mouse.click(xy[0], xy[1], { button: 'right' });
  await until('right-click examines in hands mode', (n) => [...document.querySelectorAll('#chatlog > div')].slice(-3).some((d) => d.textContent.includes('This is') && d.textContent.includes(n)), a.n);
  // a plain click: pick it up with the active (left) hand
  await page.mouse.click(xy[0], xy[1]);
  await until('clicking it picks it up', (id) => yad.self.inv.hands[0]?.id === id, a.id, 15000, diagInv);
  // drag from the left hand to the right one
  await drag(await handXY(0), await handXY(1));
  await until('drag left hand -> right hand moves it across', (id) => yad.self.inv.hands[1]?.id === id && !yad.self.inv.hands[0], a.id, 15000, diagInv);
  // drag right hand -> a spot on the floor
  const ds = await ev(() => T.dropSpot());
  ok(ds, 'found a spot on the floor to drop on', JSON.stringify(ds));
  await drag(await handXY(1), ds.xy, { mid: () => shot('hands_drag') });
  await until('drag hand -> floor puts it down', (id) => yad.rep.items.has(id) && !yad.self.inv.hands[1], a.id, 15000, diagInv);
  const d = await ev((p) => { const i = yad.rep.items.get(p.id); return i && Math.hypot(i.x - p.fp.x, i.z - p.fp.z); }, { id: a.id, fp: ds.fp });
  ok(d !== null && d < 0.3, 'it lands where it was dropped', `off by ${d?.toFixed(2)} m`);
  // drag floor -> right hand
  const from = await hoverItem(a.id);
  await drag(from, await handXY(1), { ready: () => wait((id) => yad.cursorTarget?.id === id, a.id, 8000), mid: () => shot('world_drag') });
  await until('drag floor item -> right hand ([data-hand="1"])', (id) => yad.self.inv.hands[1]?.id === id, a.id, 15000, diagInv);
  ok(await ev((id) => !yad.rep.items.has(id) && yad.hands.h[1].key.startsWith(id + ':'), a.id), 'the right hand now holds it');
  await shot('in_right_hand');
  // drag it to another spot on the floor, then floor -> floor
  const ds2 = await ev(() => T.dropSpot(1.0, 2.0));
  await drag(await handXY(1), ds2.xy);
  await until('drop it again', (id) => yad.rep.items.has(id), a.id, 15000, diagInv);
  const ds3 = await ev((id) => { const i = yad.rep.items.get(id); const s = T.dropSpot(1.0, 2.4); return s && Math.hypot(s.fp.x - i.x, s.fp.z - i.z) > 0.4 ? s : null; }, a.id);
  if (ds3) {
    const f2 = await hoverItem(a.id);
    await drag(f2, ds3.xy, { ready: () => wait((id) => yad.cursorTarget?.id === id, a.id, 8000) });
    await until('drag floor -> floor slides it along the floor', (p) => { const i = yad.rep.items.get(p.id); return i && Math.hypot(i.x - p.fp.x, i.z - p.fp.z) < 0.3; }, { id: a.id, fp: ds3.fp }, 15000, diagInv);
  }
  floorItem = a;
});

// ------------------------------------------------------------------ body panel and bags
await section('body panel (I), bags', async () => {
  await setMode('look');
  await ev(() => T.clearHands());
  await wait(() => yad.self.inv.hands.every((h) => !h));
  await key('KeyI');
  await until('I opens the body panel', () => yad.body.open && document.getElementById('body').classList.contains('on'));
  ok(await ev(() => yad.mode === 'hands' && yad.autoHands), 'opening it frees the hand (hands mode)');
  const slots = await ev(() => [...document.querySelectorAll('#body .slot')].map((e) => [e.dataset.slot, /^url\(/.test(e.style.backgroundImage)]));
  ok(slots.length === 15 && slots.every((s) => s[1]), 'all 15 SS13 slots, each with its slot icon', JSON.stringify(slots));
  ok(await ev(() => { const u = document.querySelector('#body [data-slot=uniform]'); return u.classList.contains('full') && +u.dataset.item === yad.self.inv.worn.uniform.id && T.paint(u.querySelector('canvas')).n > 20; }), 'the uniform is drawn in its slot');
  ok(await ev(() => T.paint(document.querySelector('#body .bp-doll')).n > 50), 'the SS13 health doll is drawn');
  ok(await ev(() => /You feel fine/.test(document.querySelector('#body .bp-cond').textContent)), 'the condition line says you feel fine');
  ok(await ev(() => document.querySelector('#body .bp-name').textContent === yad.self.name), 'it is your name on it');
  // buttons
  const harm = await centerOf('#body .act[data-act=intent][data-v="3"]');
  await page.mouse.click(harm[0], harm[1]);
  await until('the harm button sets harm intent', () => yad.self.inv.intent === 'harm' && document.querySelector('#body .act[data-v="3"]').classList.contains('on'));
  const help = await centerOf('#body .act[data-act=intent][data-v="0"]');
  await page.mouse.click(help[0], help[1]);
  await until('the help button sets help intent', () => yad.self.inv.intent === 'help');
  const thr = await centerOf('#body .act[data-act=throw]');
  await page.mouse.click(thr[0], thr[1]);
  await until('the throw button toggles throw mode', () => yad.self.inv.throwMode);
  await page.mouse.click(thr[0], thr[1]);
  await until('and back off', () => !yad.self.inv.throwMode);
  // worn things come off by dragging them to a hand, and go back on by dragging them to the slot
  const hat = await ev(() => yad.self.inv.worn.head);
  await drag(await centerOf('#body [data-slot=head]'), await handXY(1));
  await until('drag head slot -> right hand takes the hard hat off', (id) => yad.self.inv.hands[1]?.id === id && !yad.self.inv.worn.head, hat.id, 15000, diagInv);
  await drag(await handXY(1), await centerOf('#body [data-slot=head]'));
  await until('drag it back onto the head slot puts it on', (id) => yad.self.inv.worn.head?.id === id && !yad.self.inv.hands[1], hat.id, 15000, diagInv);
  // open the backpack by clicking its slot
  const back = await ev(() => yad.self.inv.worn.back);
  const bxy = await centerOf('#body [data-slot=back]');
  await page.mouse.click(bxy[0], bxy[1]);
  await until('clicking the back slot opens the backpack window', (id) => yad.bags.openIds.includes(id) && !!document.querySelector(`#bags .bag[data-box="${id}"]`), back.id, 15000, diagInv);
  ok(await ev((b) => document.querySelectorAll(`#bags .bag[data-box="${b.id}"] .cell.full`).length === b.c.length, back), 'its window shows what is inside, one SS13 slot each');
  ok(await ev((b) => document.querySelector(`#bags .bag[data-box="${b.id}"] .bag-n`).textContent === b.n, back), 'the window is titled with the bag name');
  await shot('body_bag');
  // move the window by its strap
  const before = await ev(() => document.querySelector('#bags .bag').getBoundingClientRect().left);
  const strap = await ev(() => { const r = document.querySelector('#bags .bag .bag-n').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await drag(strap, [strap[0] + 120, strap[1] - 60]);
  const after = await ev(() => document.querySelector('#bags .bag').getBoundingClientRect().left);
  ok(Math.abs(after - before - 120) < 8, 'the bag window can be dragged by its header', `${before} -> ${after}`);
  // floor -> bag window
  await home(-0.55);
  const b = await ev(() => T.spawnAhead('/obj/item/crowbar', 1.3, 0.1));
  await wait((id) => yad.rep.items.has(id), b.id);
  const from = await hoverItem(b.id);
  ok(from, 'the item on the floor is under the pointer');
  const grid = await ev(() => { const r = document.querySelector('#bags .bag-g').getBoundingClientRect(); return [r.right - 12, r.top + r.height / 2]; });
  await drag(from, grid, { ready: () => wait((id) => yad.cursorTarget?.id === id, b.id, 8000) });
  await until('drag floor item -> bag window stows it', (p) => yad.self.inv.worn.back.c.some((c) => c.id === p.id), b, 15000, diagInv);
  await until('it shows up in the bag window', (id) => !!document.querySelector(`#bags [data-item="${id}"]`), b.id);
  // bag -> left hand
  await drag(await centerOf(`#bags [data-item="${b.id}"]`), await handXY(0));
  await until('drag bag item -> left hand', (id) => yad.self.inv.hands[0]?.id === id && !yad.self.inv.worn.back.c.some((c) => c.id === id), b.id, 15000, diagInv);
  // hand -> the backpack's slot on the body panel stows it again
  await drag(await handXY(0), await centerOf('#body [data-slot=back]'));
  await until('drag hand -> backpack slot puts it in the backpack', (id) => yad.self.inv.worn.back.c.some((c) => c.id === id) && !yad.self.inv.hands[0], b.id, 15000, diagInv);
  // click a stored item: it comes to the active hand
  await until('it is back in the bag window', (id) => !!document.querySelector(`#bags [data-item="${id}"]`), b.id);
  const cell = await centerOf(`#bags [data-item="${b.id}"]`);
  await page.mouse.click(cell[0], cell[1]);
  await until('clicking a stored item takes it in hand', (id) => yad.self.inv.hands[0]?.id === id, b.id, 15000, diagInv);
  // a worn container opens in a window too: the toolbelt
  const belt = await ev(() => yad.self.inv.worn.belt.id);
  await key('KeyX');
  await wait(() => yad.self.inv.active === 1);
  const beltXY = await centerOf('#body [data-slot=belt]');
  await page.mouse.click(beltXY[0], beltXY[1]);
  await until('clicking the belt opens a second window', (id) => yad.bags.openIds.length === 2 && yad.bags.openIds.includes(id), belt, 15000, diagInv);
  await shot('two_bags');
  await key('KeyX');
  await wait(() => yad.self.inv.active === 0);
  // Esc closes the top-most thing first; the cursor goes back to look mode when everything is closed
  await key('Escape');
  await until('Esc closes the body panel first', () => !yad.body.open && yad.bags.openIds.length === 2);
  ok(await ev(() => yad.mode === 'hands'), 'still in hands mode while bags are open');
  await key('Escape');
  await until('Esc again closes the bags', () => yad.bags.openIds.length === 0 && !document.querySelector('#bags .bag'));
  await until('everything closed: back to look mode', () => yad.mode === 'look');
  // when you chose hands mode yourself, closing panels leaves you there
  await setMode('hands');
  await key('KeyI');
  await until('I opens the panel from hands mode', () => yad.body.open);
  await key('KeyI');
  await until('I closes it', () => !yad.body.open);
  ok(await ev(() => yad.mode === 'hands'), 'and you stay in hands mode, since you chose it');
});

// ------------------------------------------------------------------ throwing
await section('throwing', async () => {
  await home(-0.08);
  await setMode('hands');
  if (!(await ev(() => yad.self.inv.hands[0]))) { await ev(() => T.give('/obj/item/crowbar', 0)); await wait(() => !!yad.self.inv.hands[0]); }
  const it = await ev(() => yad.self.inv.hands[0]);
  const lane = await ev(() => T.lane(yad.pred.x, yad.pred.z, yad.yaw));
  ok(lane >= 8, 'there is an open lane ahead', lane.toFixed(1));
  await drag(await handXY(0), [W / 2, H / 2 - 20]);
  await until('drag a held item far away throws it', (id) => yad.rep.items.has(id), it.id, 15000, diagInv);
  const d = await ev((id) => { const i = yad.rep.items.get(id); return Math.hypot(i.x - yad.pred.x, i.z - yad.pred.z); }, it.id);
  ok(d > 3.5, 'it lands several metres away', d.toFixed(2) + ' m');
  await shot('thrown');
  // R + click in look mode throws too
  await setMode('look');
  const g = await ev(() => T.give('/obj/item/wrench', yad.self.inv.active));
  await wait((id) => yad.self.inv.hands[yad.self.inv.active]?.id === id, g.id);
  await key('KeyR');
  await until('throw mode on', () => yad.self.inv.throwMode);
  await setMode('hands');
  await moveTo([W / 2, H / 2 - 30]);
  await until('the pointer turns into a throw target', () => /--cur-throw/.test(yad.canvas.style.cursor));
  await setMode('look');
  await frames(2);
  await page.mouse.click(W / 2, H / 2);
  await until('a click in throw mode throws what you hold', (id) => yad.rep.items.has(id), g.id, 15000, diagInv);
  ok(await ev((id) => { const i = yad.rep.items.get(id); return Math.hypot(i.x - yad.pred.x, i.z - yad.pred.z) > 3.5; }, g.id), 'it flies off down the hall');
  await until('throw mode switches itself off', () => !yad.self.inv.throwMode);
});

// ------------------------------------------------------------------ using held things on people and doors by dropping them
await section('drop a held item on a person or a door: use it on them', async () => {
  // a person: a hurt crewmember, a bruise pack
  await home(-0.15);
  const npc = await ev(() => {
    const m = T.mob, yaw = yad.yaw;
    const o = T.sim.spawnCrew(T.sim.jobs.get('assistant'), null);
    o.x = m.x - Math.sin(yaw) * 1.8; o.z = m.z - Math.cos(yaw) * 1.8; o.yaw = yaw + Math.PI; o.stunned = 999; o.path = null;
    T.sim.hurt(o, 30, 'brute', 'test');
    return { id: o.id, n: o.name, brute: o.body.brute };
  });
  await wait((id) => yad.rep.mobs.has(id) && !yad.rep.mobs.get(id).fresh, npc.id);
  // they speak: runechat over their head
  await ev((id) => T.sim.chat.npcSay(T.sim.mobs.get(id), 'Hello there, engineer'), npc.id);
  await until('speech floats over the speaker (runechat)', (id) => { const sp = yad.hud.speakers.get(id); return sp && sp.box.style.display === 'block' && sp.box.textContent.includes('Hello there'); }, npc.id, 15000);
  const off = await ev((id) => { const sp = yad.hud.speakers.get(id), m = yad.rep.mobs.get(id); const r = sp.box.getBoundingClientRect(); const [x, y] = T.proj(m.x, 2.0, m.z); return [r.left + r.width / 2 - x, r.bottom - y]; }, npc.id);
  ok(Math.abs(off[0]) < 30 && Math.abs(off[1]) < 30, 'right above their head', JSON.stringify(off.map((v) => Math.round(v))));
  await shot('runechat');
  await setMode('hands');
  await ev(() => { T.clearHands(); T.give('/obj/item/stack/medical/bruise_pack', 0); });
  await wait(() => !!yad.self.inv.hands[0]);
  const at = await ev((id) => { const m = yad.rep.mobs.get(id); return T.proj(m.x, 1.1, m.z); }, npc.id);
  await moveTo(at);
  await until('the pointer finds the person', (id) => yad.cursorTarget?.k === 'mob' && yad.cursorTarget.id === id, npc.id, 8000, diagInv);
  await drag(await handXY(0), at);
  await until('dropping a bruise pack on them treats them', (p) => T.sim.mobs.get(p.id).body.brute < p.brute - 10, npc, 15000, (p) => ({ brute: T.sim.mobs.get(p.id).body.brute, ...diagInv() }));
  ok(await ev(() => !!yad.self.inv.hands[0]), 'and you keep the pack');
  await ev((id) => { const o = T.sim.mobs.get(id); o.x = 5; o.z = 5; }, npc.id);
  // a door that opens for anyone
  const door = await ev(() => {
    const sim = T.sim, w = sim.world;
    for (let i = 0; i < sim.doors.length; i++) {
      const d = sim.doors[i];
      if (d.state !== 'closed' || d.a.length || d.o.length || d.bolted || !sim.power.doorsWork(d)) continue;
      for (const [ox, oz] of [[0, 1.7], [0, -1.7], [1.7, 0], [-1.7, 0]]) {
        const x = d.x + ox, z = d.z + oz;
        if (w.collides(x, z, 0.4) || sim.atmos.pressureAt(Math.floor(x / 2), Math.floor(z / 2)) < 90) continue;
        return { idx: i, x: d.x, z: d.z, me: [x, z], yaw: Math.atan2(ox, oz) };
      }
    }
    return null;
  });
  ok(door, 'found a public door');
  await teleport(door.me[0], door.me[1], door.yaw, -0.1);
  await setMode('hands');
  const dxy = await ev((d) => T.proj(d.x, 1.2, d.z), door);
  await moveTo(dxy);
  await until('the pointer finds the door', (i) => yad.cursorTarget?.k === 'door' && yad.cursorTarget.idx === i, door.idx, 8000, diagInv);
  await drag(await handXY(0), dxy);
  await until('dropping a held item on a door uses it on the door (it opens)', (i) => yad.rep.doors[i].state !== 'closed', door.idx, 15000, diagInv);
  ok(await ev(() => !!yad.self.inv.hands[0]), 'the item stays in your hand');
  await shot('door');
  await ev(() => T.clearHands());
});

// ------------------------------------------------------------------ PDA
await section('PDA (Tab)', async () => {
  await home(-0.1);
  await setMode('look');
  await key('Tab');
  await until('Tab opens your PDA', () => yad.pda.open && document.getElementById('pda').classList.contains('on'));
  ok(await ev(() => yad.mode === 'hands'), 'it frees the hand');
  await until('it shows station time, location and air', () => /Station time \d\d:\d\d/.test(document.querySelector('.pda-time').textContent) && /Location: \S/.test(document.querySelector('.pda-loc').textContent) && /Air: \d+ kPa/.test(document.querySelector('.pda-air').textContent));
  await until('the explored map is drawn', () => { const d = document.querySelector('.pda-map').getContext('2d').getImageData(0, 0, 560, 360).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 1] > 150) n++; return n > 40; });
  ok(await ev(() => document.querySelector('#pda .crt') && /VCR/.test(getComputedStyle(document.querySelector('.pda-time')).fontFamily)), 'on a CRT screen in the VCR font');
  await shot('pda');
  await key('Tab');
  await until('Tab puts it away', () => !yad.pda.open && !document.getElementById('pda').classList.contains('on'));
  await until('and returns to look mode', () => yad.mode === 'look');
  // no PDA, no PDA screen
  const pda = await ev(() => yad.self.inv.worn.lpocket);
  ok(pda?.tg?.includes('pda'), 'the engineer carries a PDA in a pocket');
  await ev((id) => { const it = T.sim.items.get(id); T.inv.detach(T.sim, it); T.inv.place(T.sim, it, yad.pred.x, yad.pred.z); T.mob.dirty = true; }, pda.id);
  await wait(() => !yad.pda.find());
  await key('Tab');
  await until('without a PDA, Tab just tells you so', () => [...document.querySelectorAll('#chatlog > div')].slice(-2).some((d) => /don't have a PDA/.test(d.textContent)));
  ok(await ev(() => !yad.pda.open && yad.mode === 'look'), 'and nothing opens');
  await ev((id) => yad.send({ t: 'inv', op: 'move', item: id, to: { t: 'slot', slot: 'lpocket' } }), pda.id);
  await until('picked the PDA back up', (id) => yad.self.inv.worn.lpocket?.id === id, pda.id);
});

// ------------------------------------------------------------------ consoles
await section('consoles', async () => {
  const term = await ev(() => {
    const sim = T.sim, w = sim.world;
    const comps = sim.props.interact.filter((p) => /computer/.test(p.path || '') && p.kind !== 'wm');
    for (const it of comps) {
      for (const [ox, oz] of [[0, 1.3], [0, -1.3], [1.3, 0], [-1.3, 0]]) {
        const x = it.x + ox, z = it.z + oz;
        if (w.collides(x, z, 0.4) || w.raycast(x, z, -ox, -oz, 1.3, 'shot') < 0.6) continue;
        return { idx: it.idx, name: it.name, x: it.x, z: it.z, y: (it.y0 + Math.max(it.y0 + 1, it.y1)) / 2, me: [x, z] };
      }
    }
    return null;
  });
  ok(term, 'found a computer', JSON.stringify(term));
  await setMode('look');
  await teleport(term.me[0], term.me[1]);
  await ev((p) => { const dx = p.x - yad.pred.x, dz = p.z - yad.pred.z; yad.yaw = Math.atan2(-dx, -dz); yad.pitch = Math.atan2(p.y - 1.45, Math.hypot(dx, dz)); }, term);
  await until('the crosshair finds the console', (i) => yad.target?.k === 'prop' && yad.target.idx === i, term.idx, 15000, diagInv);
  await page.mouse.click(W / 2, H / 2);
  await until('clicking a computer opens its console', () => yad.term.open && document.getElementById('term-screen').classList.contains('on'), null, 15000, diagInv);
  ok(await ev(() => yad.mode === 'hands'), 'the console frees the hand');
  ok(await ev(() => document.getElementById('term-title').textContent.length > 2), 'the console has a title');
  ok(await ev(() => /VCR/.test(getComputedStyle(document.getElementById('term-body')).fontFamily)), 'console text is in the VCR font');
  await shot('console');
  await key('Escape');
  await until('Esc closes the console', () => !yad.term.open && !document.getElementById('term-screen').classList.contains('on'));
  await until('and returns to look mode', () => yad.mode === 'look');
  // hands mode: click it with the pointer, close it with its button
  await setMode('hands');
  const at = await ev((p) => T.proj(p.x, p.y, p.z), term);
  await moveTo(at);
  await until('the pointer finds the console', (i) => yad.cursorTarget?.k === 'prop' && yad.cursorTarget.idx === i, term.idx, 8000, diagInv);
  await page.mouse.click(at[0], at[1]);
  await until('clicking it with the pointer opens it', () => yad.term.open);
  const close = await centerOf('#term-ft [data-close]');
  await page.mouse.click(close[0], close[1]);
  await until('its close button closes it', () => !yad.term.open);
  ok(await ev(() => yad.mode === 'hands'), 'you stay in hands mode (you chose it)');
  await setMode('look');
});

// ------------------------------------------------------------------ chat
await section('chat', async () => {
  await key('KeyT');
  await until('T opens the say line', () => yad.chat.isOpen && document.activeElement.id === 'chatinput');
  await page.keyboard.type('testing one two');
  await page.keyboard.press('Enter');
  await until('typed text is spoken', () => document.getElementById('chatlog').textContent.includes('testing one two'));
  ok(!(await ev(() => yad.chat.isOpen)), 'the line closes after sending');
  await until('your words float over your head too (runechat)', () => [...document.querySelectorAll('#runechat .rune')].some((r) => r.textContent.includes('testing one two')));
  await key('KeyM');
  await until('M opens the emote line', () => yad.chat.isOpen && yad.chat.mode === 'me');
  await page.keyboard.type('waves.');
  await page.keyboard.press('Enter');
  await until('M sends an emote', () => /waves\./.test(document.getElementById('chatlog').textContent));
  await key('KeyT');
  await until('T again', () => yad.chat.isOpen);
  await page.keyboard.type('xyz');
  await key('Escape');
  await until('Esc cancels the line', () => !yad.chat.isOpen);
  ok(await ev(() => !document.getElementById('chatlog').textContent.includes('xyz')), 'and nothing is said');
});

// ------------------------------------------------------------------ body effects
await section('damage, effects, death', async () => {
  await home(-0.1);
  await setMode('look');
  await ev(() => T.healAll());
  await wait(() => yad.self.hp[2] < 1);
  ok(await ev(() => ['fx-brute', 'fx-oxy', 'fx-crit'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none')), 'no damage overlays when healthy');
  await ev(() => { T.flashMax = 0; const f = () => { T.flashMax = Math.max(T.flashMax, +getComputedStyle(document.getElementById('fx-flash')).opacity); if (!T.stopFlash) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await ev(() => T.sim.hurt(T.mob, 45, 'brute', 'test'));
  await until('getting hurt shows SS13\'s brute overlay (#fx-brute)', () => { const e = document.getElementById('fx-brute'); return getComputedStyle(e).display === 'block' && /brutedamageoverlay/.test(e.getAttribute('src') || '') || /^data:|^blob:/.test(e.getAttribute('src') || ''); }, null, 15000, () => [document.getElementById('fx-brute').getAttribute('src')?.slice(0, 60), yad.self.hp]);
  await until('the screen flashes red', () => T.flashMax > 0.2, null, 8000, () => T.flashMax);
  await ev(() => { T.stopFlash = true; });
  await until('the world loses some colour', () => /saturate\(/.test(yad.canvas.style.filter));
  await shot('hurt');
  await key('KeyI');
  await until('the body panel describes the bruises', () => /bruis/.test(document.querySelector('#body .bp-cond').textContent));
  ok(await ev(() => yad.body.dollKey !== '0'), 'the health doll shows the damage');
  await shot('hurt_body');
  await key('Escape');
  await until('Esc closes it', () => !yad.body.open && yad.mode === 'look');
  await ev(() => { T.healAll(); T.mob.body.damage('oxy', 45); });
  await until('suffocating closes the black in (#fx-oxy)', () => getComputedStyle(document.getElementById('fx-oxy')).display === 'block');
  await ev(() => T.healAll());
  await until('healing clears the overlays', () => ['fx-brute', 'fx-oxy'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none') && !/saturate/.test(yad.canvas.style.filter), null, 15000, () => yad.self.hp);
  // a space helmet: dragged off the floor onto your head, it puts a visor round the view
  await home(-0.55);
  await key('KeyI');
  await until('body panel open', () => yad.body.open);
  const hat = await ev(() => yad.self.inv.worn.head.id);
  await drag(await centerOf('#body [data-slot=head]'), await handXY(1));
  await until('hard hat off', (id) => yad.self.inv.hands[1]?.id === id, hat, 15000, diagInv);
  const helm = await ev(() => T.spawnAhead('/obj/item/clothing/head/helmet/space/emergency', 1.3, 0));
  await wait((id) => yad.rep.items.has(id), helm.id);
  const from = await hoverItem(helm.id);
  await drag(from, await centerOf('#body [data-slot=head]'), { ready: () => wait((id) => yad.cursorTarget?.id === id, helm.id, 8000) });
  await until('drag a helmet from the floor onto the head slot', (id) => yad.self.inv.worn.head?.id === id, helm.id, 15000, diagInv);
  await until('a helmet visor frames the view', () => getComputedStyle(document.getElementById('fx-visor')).display === 'block');
  await shot('visor');
  await drag(await centerOf('#body [data-slot=head]'), await handXY(0));
  await until('helmet off', (id) => yad.self.inv.hands[0]?.id === id, helm.id, 15000, diagInv);
  await until('the visor goes away', () => getComputedStyle(document.getElementById('fx-visor')).display === 'none');
  await key('Escape');
  await wait(() => !yad.body.open);
  // vacuum
  const vac = await ev(() => {
    const sim = T.sim, w = sim.world;
    for (let r = 1; r < w.H - 1; r++) for (let c = 1; c < w.W - 1; c++) {
      const x = c * 2 + 1, z = r * 2 + 1;
      if (w.collides(x, z, 0.4) || sim.atmos.pressureAt(c, r) > 5) continue;
      return [x, z];
    }
    return null;
  });
  if (vac) {
    await teleport(vac[0], vac[1]);
    await until('vacuum tints the edges of the view blue', () => yad.rep.env.p < 30 && +getComputedStyle(document.getElementById('fx-vac')).opacity > 0.4, null, 15000, () => [yad.rep.env, getComputedStyle(document.getElementById('fx-vac')).opacity]);
    await shot('vacuum');
    await home(-0.1);
    await ev(() => T.healAll());
    await until('back in the air', () => yad.rep.env.p > 80 && +getComputedStyle(document.getElementById('fx-vac')).opacity < 0.05);
  } else ok(false, 'found somewhere airless to stand');
  // critical, then dead
  await ev(() => T.sim.hurt(T.mob, 75, 'brute', 'test'));
  await until('in critical condition the view narrows (#fx-crit)', () => yad.self.crit && getComputedStyle(document.getElementById('fx-crit')).display === 'block', null, 15000, () => [yad.self.hp, yad.self.crit]);
  await shot('crit');
  await ev(() => T.sim.hurt(T.mob, 400, 'brute', 'test'));
  await until('dying turns you into a ghost', () => yad.phase === 'ghost', null, 20000);
  await until('the ghost bar says you are dead', () => { const g = document.getElementById('ghostbar'); return getComputedStyle(g).display === 'block' && /dead/.test(g.textContent); });
  ok(await ev(() => getComputedStyle(document.getElementById('hands')).display === 'none'), 'ghosts have no hands');
  ok(await ev(() => ['fx-brute', 'fx-oxy', 'fx-crit'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none') && !yad.canvas.style.filter), 'the damage overlays are gone');
  ok(await ev(() => document.getElementById('hud').classList.contains('ghost') && getComputedStyle(document.getElementById('cross')).display === 'none'), 'ghost HUD, no crosshair');
  await shot('ghost');
  await key('Tab');
  await until('ghosts can still read the station map', () => yad.pda.open && /observer/.test(document.querySelector('.pda-owner').textContent));
  await key('Tab');
  await until('Tab closes it', () => !yad.pda.open);
});

const errs = logs.filter((l) => !/AudioContext|autoplay/i.test(l));
ok(errs.length === 0, 'no page errors', '\n' + errs.slice(0, 12).join('\n'));
console.log(`\n${pass} passed, ${fail} failed  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
await browser.close();
process.exit(fail ? 1 : 0);
