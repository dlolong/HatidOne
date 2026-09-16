// Dependency-free browser checks using installed Chrome's DevTools protocol.
// Only fictional local testing; never uses the owner's browser profile.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export class LocalChrome {
  pending = new Map();
  sequence = 0;
  async start() {
    this.profile = await mkdtemp(join(tmpdir(), 'hatidone-browser-'));
    this.process = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', `--user-data-dir=${this.profile}`, 'about:blank'], { stdio: 'ignore' });
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { port = Number((await readFile(join(this.profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch { /* startup */ }
      await pause(100);
    }
    if (!port) throw new Error('BLOCKED: isolated Chrome did not start');
    const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    this.socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { this.socket.addEventListener('open', resolve, { once: true }); this.socket.addEventListener('error', reject, { once: true }); });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, timer } = this.pending.get(message.id);
        clearTimeout(timer); this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      }
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }
  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error('Browser evaluation failed');
    return result.result.value;
  }
  async navigate(url) {
    if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Browser QA requires an explicitly local URL');
    await this.send('Page.navigate', { url });
    await pause(300);
    await this.evaluate('new Promise(resolve => { const done = () => resolve(true); if(document.readyState === "complete") done(); else window.addEventListener("load", done, {once:true}); })');
    await this.evaluate('document.fonts.ready.then(() => true)');
    await pause(250);
  }
  async stop() {
    this.socket?.close();
    this.process?.kill('SIGTERM');
    await pause(300);
    if (this.profile) await rm(this.profile, { recursive: true, force: true, maxRetries: 3 });
  }
}

export async function snapshots(base, label) {
  if (!['before', 'after'].includes(label)) throw new Error('Snapshot label must be before or after');
  const browser = new LocalChrome();
  const directory = resolve(`docs/screenshots/driver-registration/${label}`);
  await mkdir(directory, { recursive: true });
  const results = [];
  try {
    await browser.start();
    for (const width of [360, 390, 430, 768, 1440]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 800 : 1000, deviceScaleFactor: 1, mobile: false });
      for (const [name, path] of [['home', '/'], ['signup', '/signup'], ['login', '/login']]) {
        await browser.navigate(new URL(path, base).href);
        const metrics = await browser.evaluate(`(() => { const elements=[...document.querySelectorAll('a,button')].filter(el=>/Apply to drive/i.test(el.innerText)); return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,driverActions:elements.map(el=>{const r=el.getBoundingClientRect();return {label:el.innerText,href:el.getAttribute('href'),visible:r.width>0&&r.height>0,aboveFold:r.top>=0&&r.bottom<=innerHeight};}),heading:document.querySelector('h1')?.innerText};})()`);
        const screenshot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(join(directory, `${name}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
        results.push({ page: name, ...metrics });
        console.log(`${metrics.overflow ? 'FAIL' : 'PASS'} ${label} ${name} ${width}: horizontal overflow ${metrics.overflow}; visible driver actions ${metrics.driverActions.filter(action => action.visible).length}`);
      }
    }
    await writeFile(join(directory, 'measurements.json'), JSON.stringify(results, null, 2) + '\n');
    if (label === 'after' && results.some(result => result.overflow || (result.page === 'home' && !result.driverActions.some(action => action.visible && action.aboveFold)))) throw new Error('Driver discovery or overflow checks failed');
  } finally { await browser.stop(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await snapshots(process.env.HATIDONE_QA_URL ?? 'http://127.0.0.1:3109', process.argv[2] ?? 'after');
