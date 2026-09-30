// Full-resolution screenshots + layout check of design/client.html with headless Chrome (no install needed).
// Needs the local server: python -m http.server 5173 --bind 127.0.0.1 --directory design
//   node design/tools/shots.mjs                    all sizes × all states
//   node design/tools/shots.mjs 1366x768 home.menu  only these (any mix of sizes and states)
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(dir, '..', 'shots');
const BASE = 'http://127.0.0.1:5173';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const WORKERS = 4;

const SIZES = ['1920x1080', '1536x864', '1366x768', '1280x720', '1100x700', '390x844'];
const STATES = ['home', 'library', 'downloads', 'settings', 'home.slide2', 'home.menu', 'home.notif', 'home.chat', 'home.newgroup'];

const args = process.argv.slice(2);
const sizes = args.filter(a => /^\d+x\d+$/.test(a)); const states = args.filter(a => !/^\d+x\d+$/.test(a));
mkdirSync(OUT, { recursive: true });
const profile = worker => join(tmpdir(), `force-studio-shots-${worker}`);

// one Chrome run; a hung run is killed after 45s and retried once
const run = (worker, extra, url) => new Promise((resolve, reject) => {
  execFile(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio',
    `--user-data-dir=${profile(worker)}`, '--virtual-time-budget=4000', ...extra, url], { encoding: 'utf8', timeout: 45000, maxBuffer: 32 << 20 },
    (err, stdout) => err ? reject(err) : resolve(stdout));
});
const chrome = async (worker, extra, url) => { try { return await run(worker, extra, url); } catch { return run(worker, extra, url); } };

async function job(worker, size, state) {
  const [w, h] = size.split('x').map(Number);
  const file = join(OUT, `${state}-${size}.png`);
  const url = `${BASE}/tools/check.html?w=${w}&h=${h}&s=${state}`;
  try {
    // shoot the exact-size iframe in tools/check.html, then crop: headless Chrome will not make a window narrower than ~500px
    await chrome(worker, [`--window-size=${Math.max(w, 600) + 40},${h + 200}`, `--screenshot=${file}`], url);
    execFileSync('python', ['-c', `from PIL import Image; im = Image.open(r'${file}'); im.crop((0, 0, ${w}, ${h})).save(r'${file}')`]);
    const dom = await chrome(worker, [`--window-size=${w + 40},${h + 200}`, '--dump-dom'], url);
    const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
    return m ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')) : { issues: ['check did not run'] };
  } catch (e) {
    return { issues: [`CHROME failed twice (${e.code || e.message})`] };
  }
}

// 4 Chrome workers in parallel, each with its own profile
const jobs = (sizes.length ? sizes : SIZES).flatMap(size => (states.length ? states : STATES).map(state => ({ size, state })));
const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, async (_, worker) => {
  while (next < jobs.length) { const i = next++; results[i] = await job(worker, jobs[i].size, jobs[i].state); }
}));

let total = 0;
jobs.forEach(({ size, state }, i) => {
  const r = results[i];
  total += r.issues.length;
  console.log(`${r.issues.length ? '✗' : '✓'} ${state.padEnd(14)} ${size.padEnd(10)} ${r.issues.length} issue(s) · ${r.checked ?? '?'} elements checked`);
  for (const x of r.issues) console.log('    ' + x);
});
for (let k = 0; k < WORKERS; k++) rmSync(profile(k), { recursive: true, force: true });
console.log(`\n${total} issue(s) in ${jobs.length} checks. Screenshots: design/shots/`);
process.exitCode = total ? 1 : 0;
