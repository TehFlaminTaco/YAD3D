// Headless harness: node tools/shot.mjs "<query>" outPrefix --steps '[{"eval":"js","wait":300,"snap":"name"},...]' [--w 960 --h 540]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const args = process.argv.slice(2);
const query = args[0] || '';
const prefix = args[1] || '/tmp/shot';
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const W = +opt('--w', 960), H = +opt('--h', 540);
const steps = JSON.parse(opt('--steps', '[{"snap":"a","wait":1500}]'));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
await page.goto('http://localhost:8123/index.html' + (query ? '?' + query : ''));
await page.waitForFunction(() => window.yad && window.yad.time > 0.1, null, { timeout: 90000 }).catch(() => logs.push('[harness] game never started'));
for (const s of steps) {
  if (s.eval) {
    const r = await page.evaluate(s.eval).catch((err) => 'EVAL ERROR: ' + err.message);
    if (r !== undefined) logs.push('[eval] ' + JSON.stringify(r));
  }
  if (s.key) { await page.keyboard.press(s.key); }
  if (s.down) { await page.keyboard.down(s.down); }
  if (s.up) { await page.keyboard.up(s.up); }
  if (s.click !== undefined) { await page.mouse.click(480, 270, { button: s.click === 2 ? 'right' : 'left' }); }
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.snap) await page.screenshot({ path: `${prefix}_${s.snap}.png` });
}
console.log(logs.filter((l) => !l.includes('GPU stall') && !l.includes('GroupMarker')).slice(0, 40).join('\n'));
await browser.close();
