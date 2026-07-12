import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

export const PKG = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

// Where the logged-in Chromium profile (Google session cookies) lives.
// Treat this directory like a password store.
export const PROFILE_DIR =
  process.env.GDOCS_COMMENTS_PROFILE_DIR
  || join(homedir(), '.gdocs-comments-mcp', 'profile');

// When set, the server attaches to an already-running browser over CDP instead
// of managing its own profile. For server/datacenter deployments — see README.
export const CDP_URL = process.env.GDOCS_COMMENTS_CDP_URL || null;

export const HEADLESS = process.env.GDOCS_COMMENTS_HEADLESS !== 'false';

// Browser channel: 'chrome' (default, uses installed Google Chrome),
// 'msedge', or 'chromium' (requires `npx playwright install chromium`).
export const CHANNEL = process.env.GDOCS_COMMENTS_BROWSER_CHANNEL || 'chrome';

// Close the managed browser after this many idle minutes (0 = keep open).
export const IDLE_CLOSE_MIN = Number(process.env.GDOCS_COMMENTS_IDLE_CLOSE_MIN ?? 10);

// Optional JSONL audit log; off unless a path is given.
export const AUDIT_LOG = process.env.GDOCS_COMMENTS_AUDIT_LOG || null;

// Google Docs IDs: URL-safe [a-zA-Z0-9_-], 20..80 chars observed in the wild.
export const DOC_ID_RE = /^[a-zA-Z0-9_-]{20,80}$/;

/** Accept a bare document id or any docs.google.com URL containing /d/<id>/. */
export function extractDocId(input) {
  const s = String(input ?? '').trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,80})(?:[/?#]|$)/);
  const id = m ? m[1] : s;
  if (!DOC_ID_RE.test(id)) {
    throw new Error(
      'invalid doc: expected a Google Docs id (20-80 chars of [a-zA-Z0-9_-]) or a docs.google.com/document/d/<id>/ URL',
    );
  }
  return id;
}
