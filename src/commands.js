/**
 * CLI commands: login / status / logout. These run interactively in a
 * terminal (NOT under an MCP client) and manage the persistent profile.
 */
import { rmSync, existsSync } from 'node:fs';
import { PROFILE_DIR, CDP_URL } from './config.js';
import { MODE, launchProfile, getContext, probeSession, shutdown, ConnectionError } from './browser.js';

const LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?continue='
  + encodeURIComponent('https://docs.google.com/document/u/0/');

export async function login() {
  if (CDP_URL) {
    console.error(
      `GDOCS_COMMENTS_CDP_URL is set (${CDP_URL}) — in CDP mode you log in inside that browser itself, not here.\n`
      + 'Unset the variable to use the managed profile instead.',
    );
    process.exit(2);
  }
  console.log(`Opening a browser window (profile: ${PROFILE_DIR})...`);
  console.log('Sign in to the Google account you want comments posted as.');
  const context = await launchProfile({ headless: false });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

  const deadline = Date.now() + 10 * 60_000;
  let closed = false;
  context.on('close', () => { closed = true; });
  while (Date.now() < deadline && !closed) {
    const url = page.isClosed() ? null : page.url();
    if (url && new URL(url).hostname === 'docs.google.com') {
      console.log('\n✅ Logged in. The session is saved; the MCP server can now run headless.');
      console.log('   Try it: npx gdocs-comments-mcp status');
      await context.close().catch(() => {});
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!closed) await context.close().catch(() => {});
  console.error('\n❌ Login was not completed (window closed or timed out). Run `login` again.');
  process.exit(1);
}

export async function status() {
  console.log(`mode:    ${MODE}`);
  console.log(`profile: ${MODE === 'profile' ? PROFILE_DIR : `(unused, CDP ${CDP_URL})`}`);
  if (MODE === 'profile' && !existsSync(PROFILE_DIR)) {
    console.log('session: ❌ no profile yet — run: npx gdocs-comments-mcp login');
    process.exit(1);
  }
  try {
    const context = await getContext();
    const ok = await probeSession(context);
    await shutdown();
    console.log(ok
      ? 'session: ✅ logged in — anchored comments will work'
      : 'session: ❌ expired — run: npx gdocs-comments-mcp login');
    process.exit(ok ? 0 : 1);
  } catch (err) {
    await shutdown();
    if (err instanceof ConnectionError && err.code === 'PROFILE_LOCKED') {
      console.log('session: ⚠️ profile is in use (an MCP server is probably running and holding it — that usually means it works). Stop the server to probe from here.');
      process.exit(0);
    }
    console.log(`session: ❌ ${err.message}`);
    process.exit(1);
  }
}

export async function logout() {
  if (!existsSync(PROFILE_DIR)) {
    console.log(`Nothing to remove (${PROFILE_DIR} does not exist).`);
    return;
  }
  rmSync(PROFILE_DIR, { recursive: true, force: true });
  console.log(`Removed ${PROFILE_DIR} — the saved Google session is gone.`);
  console.log('Tip: also review https://myaccount.google.com/device-activity to revoke it server-side.');
}
