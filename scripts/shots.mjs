/**
 * Design-review screenshot kit.
 *
 * `npm run build && npm run shots` captures the review states into
 * `.artifacts/screenshots/`, reports the QR Panel's module size, and runs the
 * decode proxy. It drives headless Chromium over the Chrome DevTools Protocol
 * with Node's built-in WebSocket and fetch: no Puppeteer, no new dependency.
 *
 * Screenshots are review material, not assertions. They do not replace the
 * two-phone scan matrix in docs/design/verification.md, which needs real
 * cameras, glare, and phone brightness.
 */
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.artifacts', 'screenshots');
const PORT = 4178;
const DEBUG_PORT = 9333;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const STORAGE_KEY = 'qr_wallet_v1';
const VIEWPORT = { width: 430, height: 932 };
const PNG_SCALE = 2;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html is missing; run `npm run build` before `npm run shots`.');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const work = join(tmpdir(), `qr-wallet-shots-${process.pid}`);
mkdirSync(work, { recursive: true });
const profile = join(work, 'profile');

/* ------------------------------------------------------------------ server -- */

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', ORIGIN);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = resolve(join(DIST, decodeURIComponent(requested)));
  if (!filePath.startsWith(DIST) || !existsSync(filePath)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  response.end(readFileSync(filePath));
});

await new Promise((loaded) => server.listen(PORT, '127.0.0.1', loaded));

/* --------------------------------------------------------------- chromium -- */

function findChromium() {
  for (const candidate of [
    process.env.CHROME_PATH,
    'chromium',
    'chromium-browser',
    'google-chrome',
    '/usr/bin/chromium',
  ]) {
    if (candidate === undefined) {
      continue;
    }
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (probe.error === undefined) {
      return candidate;
    }
  }
  return null;
}

const chromium = findChromium();
if (chromium === null) {
  server.close();
  console.error('No Chromium found; set CHROME_PATH to run the screenshot kit.');
  process.exit(1);
}

const browser = spawn(
  chromium,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${DEBUG_PORT}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

/** Polls the DevTools endpoint until Chromium is listening. */
async function waitForDebugger() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) {
        return (await response.json()).webSocketDebuggerUrl;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error('Chromium did not open its debugging port.');
}

/** A minimal flattened-session CDP client. */
class Cdp {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Set();
  sessionId = '';

  static async connect(url) {
    const client = new Cdp();
    client.#socket = new WebSocket(url);
    await new Promise((open, fail) => {
      client.#socket.addEventListener('open', open, { once: true });
      client.#socket.addEventListener('error', fail, { once: true });
    });
    client.#socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const entry = client.#pending.get(message.id);
        client.#pending.delete(message.id);
        if (entry === undefined) {
          return;
        }
        if (message.error !== undefined) {
          entry.reject(new Error(`${entry.method}: ${message.error.message}`));
        } else {
          entry.resolve(message.result);
        }
        return;
      }
      for (const listener of client.#listeners) {
        listener(message);
      }
    });
    return client;
  }

  send(method, params = {}) {
    const id = this.#nextId++;
    const message = { id, method, params, sessionId: this.sessionId || undefined };
    return new Promise((sent, failed) => {
      this.#pending.set(id, { resolve: sent, reject: failed, method });
      this.#socket.send(JSON.stringify(message));
    });
  }

  onEvent(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  waitFor(method) {
    return new Promise((found) => {
      const off = this.onEvent((message) => {
        if (message.method === method) {
          off();
          found(message.params);
        }
      });
    });
  }

  close() {
    this.#socket.close();
  }
}

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8' });
}

/** Card-shaped fixtures for states the Seed Cards do not cover. */
function visitCard(id) {
  return {
    id,
    label: 'Visit Card',
    updatedAt: '2026-11-26T00:00:00.000Z',
    source: {
      kind: 'visit',
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Analytical Engines',
      title: 'Mathematician',
      phone: '+44 20 7946 0958',
      email: 'ada@example.com',
      website: 'https://example.com/',
    },
  };
}

// Mixed-case text forces byte mode: 800 bytes is QR version 23, the worst case.
const denseCard = {
  id: 'dense-card',
  label: 'Dense Text',
  updatedAt: '2026-11-26T00:00:00.000Z',
  source: {
    kind: 'text',
    text: Array.from({ length: 800 }, (_, index) =>
      'abcdefghijklmnopqrstuvwxyz0123456789'[index % 36],
    ).join(''),
  },
};

let cdp;
try {
  const browserSocketUrl = await waitForDebugger();
  cdp = await Cdp.connect(browserSocketUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  cdp.sessionId = sessionId;

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  async function setViewport(width, height) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: PNG_SCALE,
      mobile: true,
    });
  }

  /** Runs an expression in the page and resolves its value. */
  async function evaluate(expression, { awaitPromise = false } = {}) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails !== undefined) {
      throw new Error(
        `Page script failed: ${result.exceptionDetails.exception?.description ?? 'unknown'}`,
      );
    }
    return result.result.value;
  }

  /** Waits for the next frame so a DOM update has been painted. */
  async function nextFrame() {
    await evaluate(
      'new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))',
      { awaitPromise: true },
    );
  }

  /** Navigates, waits for load, the display font, and a painted frame. */
  async function visit() {
    const loaded = cdp.waitFor('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `${ORIGIN}/` });
    await loaded;
    await evaluate('document.fonts.ready.then(() => true)', { awaitPromise: true });
    await nextFrame();
  }

  /** Navigates, stores the given Wallet, and reloads into it. */
  async function withWallet(wallet) {
    await visit();
    await evaluate(
      `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(wallet))})`,
    );
    await visit();
  }

  async function click(selector) {
    await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (element === null) throw new Error('Missing element: ' + ${JSON.stringify(selector)});
      element.click();
    })()`);
    await nextFrame();
  }

  async function close(selector) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.close()`);
    await nextFrame();
  }

  async function screenshot(name) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`  ${name}.png`);
  }

  /** The QR Panel's rendered geometry: module count includes the quiet zone. */
  async function panelGeometry() {
    return evaluate(`(() => {
      const panel = document.querySelector('.qr-panel');
      const svg = panel === null ? null : panel.querySelector('svg');
      if (panel === null || svg === null) return null;
      const rect = panel.getBoundingClientRect();
      const viewBox = (svg.getAttribute('viewBox') ?? '').split(/\\s+/).map(Number);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        modules: viewBox[2] ?? 0,
      };
    })()`);
  }

  /**
   * Decode proxy: capture the panel at 4×, downscale to 6/4/3/2 px per module,
   * soften and JPEG it, then decode with zbarimg. Only 4 px/module is required.
   */
  async function decodeProxy() {
    const geometry = await panelGeometry();
    if (geometry === null) {
      console.warn('No QR Panel on screen; decode proxy skipped.');
      return;
    }
    console.log(
      `QR Panel: ${geometry.width.toFixed(1)} px wide, ${geometry.modules} modules, ` +
        `${(geometry.width / geometry.modules).toFixed(2)} px per module`,
    );
    const haveMagick = run('magick', ['-version']).status === 0;
    const haveZbar = run('zbarimg', ['--version']).status === 0;
    if (!haveMagick || !haveZbar) {
      console.warn('magick or zbarimg is missing; decode proxy skipped.');
      return;
    }

    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height, scale: 4 },
    });
    const source = join(work, 'panel.png');
    writeFileSync(source, Buffer.from(data, 'base64'));

    for (const density of [6, 4, 3, 2]) {
      const size = Math.round(geometry.modules * density);
      const target = join(work, `panel-${density}.jpg`);
      const resized = run('magick', [
        source,
        '-resize',
        `${size}x${size}!`,
        '-blur',
        '0x0.8',
        '-quality',
        '60',
        target,
      ]);
      if (resized.status !== 0) {
        console.warn(`  could not render ${density} px/module`);
        continue;
      }
      const decoded = run('zbarimg', ['--quiet', '--raw', target]);
      const verdict = decoded.status === 0 ? 'decoded' : 'no decode';
      console.log(`  ${density} px/module: ${verdict}`);
    }
  }

  /** One pager step and one menu choice, with the state each produced. */
  async function interactionChecks() {
    const count = () => evaluate('document.querySelector(".wallet-pager__count span").textContent');
    const faceName = () => evaluate('document.querySelector(".card-face__name").textContent');
    const activeId = () => evaluate('JSON.parse(localStorage.getItem("qr_wallet_v1")).activeCardId');
    const menuOpen = () => evaluate('document.querySelector(".card-menu").open');

    const before = await count();
    await evaluate('[...document.querySelectorAll(".wallet-pager__step")][1].click()');
    await nextFrame();
    const after = await count();
    const stored = await activeId();
    console.log(`  pager: ${before} -> ${after}, face "${await faceName()}", stored ${stored}`);
    await screenshot('main-link');

    await click('.wallet-top-bar__control');
    const opened = await menuOpen();
    await click('.card-menu__row--active');
    const closed = await menuOpen();
    console.log(`  menu opens ${opened}, closes on choose ${!closed}, face "${await faceName()}"`);

    // Back to the first Card so every later screenshot is deterministic.
    await evaluate('[...document.querySelectorAll(".wallet-pager__step")][0].click()');
    await nextFrame();
  }

  console.log('Capturing design-review screenshots:');
  await setViewport(VIEWPORT.width, VIEWPORT.height);

  await visit();
  await screenshot('main-visit');
  await interactionChecks();

  await click('.wallet-top-bar__control');
  await screenshot('card-menu-open');
  await close('.card-menu');

  await click('.action-dock__action');
  await screenshot('edit-sheet');
  await evaluate(`(() => {
    const label = document.querySelector('#card-dialog-label');
    if (label === null) throw new Error('Missing the Label field');
    label.value = '';
    document.querySelector('.card-dialog__form').requestSubmit();
  })()`);
  await nextFrame();
  await screenshot('edit-sheet-error');
  await close('.card-dialog');

  await click('.wallet-top-bar__control');
  await click('.card-menu__backup');
  await screenshot('private-backup');
  await close('.backup-dialog');

  await withWallet({ version: 1, cards: [visitCard('one-card')], activeCardId: 'one-card' });
  await screenshot('main-single-card');

  await withWallet({ version: 1, cards: [], activeCardId: null });
  await screenshot('empty-state');

  await withWallet({ version: 1, cards: [denseCard], activeCardId: denseCard.id });
  await screenshot('main-dense');
  await decodeProxy();
  await evaluate(`localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`);

  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await visit();
  await screenshot('main-reduced-motion');
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });

  await setViewport(390, 844);
  await visit();
  await screenshot('main-390x844');

  console.log(`Screenshots written to ${OUT}`);
  console.log('Review them against docs/design/design.md; run the scan matrix by hand.');
} finally {
  cdp?.close();
  browser.kill('SIGTERM');
  await new Promise((done) => server.close(done));
  rmSync(work, { recursive: true, force: true });
}
