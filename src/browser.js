/**
 * Browser session management.
 *
 * Two modes:
 *  - profile (default): this process owns a persistent Chromium context backed
 *    by PROFILE_DIR. The operator logs in once via `gdocs-comments-mcp login`;
 *    every later launch reuses those cookies, headless.
 *  - cdp (GDOCS_COMMENTS_CDP_URL set): attach to a browser somebody else keeps
 *    alive. This is the right shape on datacenter IPs, where Google's
 *    anti-fraud rejects a fresh browser process reusing a session (it bounces
 *    to accounts.google.com/confirmidentifier) — the only thing that works
 *    there is to keep the exact browser the operator logged into alive and
 *    drive it.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { PROFILE_DIR, CDP_URL, HEADLESS, CHANNEL, IDLE_CLOSE_MIN } from './config.js';

export const MODE = CDP_URL ? 'cdp' : 'profile';

export class ConnectionError extends Error {
  constructor(message, code = 'NOT_CONNECTED') {
    super(message);
    this.code = code;
  }
}

let ownedContext = null;   // BrowserContext from launchPersistentContext (we own it)
let attachedBrowser = null; // Browser from connectOverCDP (we do NOT own it)
let idleTimer = null;

/**
 * Launch a persistent context on PROFILE_DIR. Tries the configured channel
 * first, then sensible fallbacks, and reports what to install if none exists.
 */
export async function launchProfile({ headless = HEADLESS } = {}) {
  mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 });
  const tried = [];
  // undefined channel = Playwright's bundled Chromium (needs `playwright install`).
  const channels = [...new Set([CHANNEL, 'chrome', 'msedge', 'chromium'])]
    .map((c) => (c === 'chromium' ? undefined : c));
  for (const channel of channels) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, {
        channel,
        headless,
        viewport: { width: 1440, height: 900 },
        // Without these, Google's sign-in page rejects the browser as automated.
        args: ['--disable-blink-features=AutomationControlled'],
        ignoreDefaultArgs: ['--enable-automation'],
      });
    } catch (err) {
      tried.push(`${channel ?? 'bundled chromium'}: ${firstLine(err.message)}`);
      if (isProfileLocked(err)) {
        throw new ConnectionError(
          `The browser profile at ${PROFILE_DIR} is in use by another process `
          + '(a running gdocs-comments-mcp server, or a login window). '
          + 'Stop it first, or point GDOCS_COMMENTS_PROFILE_DIR elsewhere.',
          'PROFILE_LOCKED',
        );
      }
    }
  }
  throw new ConnectionError(
    'No usable browser found. Install Google Chrome, or run '
    + '`npx playwright install chromium` and set GDOCS_COMMENTS_BROWSER_CHANNEL=chromium.\n'
    + `Attempts:\n  ${tried.join('\n  ')}`,
    'NO_BROWSER',
  );
}

function isProfileLocked(err) {
  return /SingletonLock|ProcessSingleton|profile.*in use|already running/i.test(err.message || '');
}

function firstLine(s) {
  return String(s || '').split('\n')[0];
}

/** Get a live BrowserContext in the configured mode, launching/attaching lazily. */
export async function getContext() {
  clearIdleTimer();
  if (MODE === 'cdp') {
    if (!attachedBrowser?.isConnected()) {
      try {
        attachedBrowser = await chromium.connectOverCDP(CDP_URL, { timeout: 8000 });
      } catch {
        throw new ConnectionError(
          `Could not reach the browser at ${CDP_URL}. Start a logged-in Chrome with `
          + '--remote-debugging-port, or unset GDOCS_COMMENTS_CDP_URL to use the managed profile.',
        );
      }
    }
    const ctx = attachedBrowser.contexts()[0];
    if (!ctx) throw new ConnectionError('The CDP browser has no browser context to drive.');
    return ctx;
  }
  if (!ownedContext) {
    ownedContext = await launchProfile();
    ownedContext.on('close', () => { ownedContext = null; });
  }
  return ownedContext;
}

/** Call after each operation: closes the managed browser after an idle period. */
export function scheduleIdleClose() {
  clearIdleTimer();
  if (MODE !== 'profile' || !IDLE_CLOSE_MIN) return;
  idleTimer = setTimeout(() => {
    ownedContext?.close().catch(() => {});
  }, IDLE_CLOSE_MIN * 60_000);
  idleTimer.unref();
}

function clearIdleTimer() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
}

export async function shutdown() {
  clearIdleTimer();
  try { await ownedContext?.close(); } catch { /* ignore */ }
  // For an attached browser, close() only disconnects the CDP client — it does
  // NOT terminate the browser, which somebody else owns.
  try { await attachedBrowser?.close(); } catch { /* ignore */ }
  ownedContext = null;
  attachedBrowser = null;
}

/**
 * Probe whether the session is logged in: an authenticated navigation to the
 * Docs home stays on docs.google.com; a dead session bounces to
 * accounts.google.com. The navigation itself also refreshes session cookies.
 */
export async function probeSession(context) {
  const page = await context.newPage();
  try {
    await page.goto('https://docs.google.com/document/u/0/', {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    return new URL(page.url()).hostname === 'docs.google.com';
  } finally {
    await page.close().catch(() => {});
  }
}
