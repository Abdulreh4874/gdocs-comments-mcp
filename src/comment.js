/**
 * The anchored-comment flow. The Docs/Drive REST APIs save a comment `anchor`
 * but the Docs UI ignores it (renders un-anchored), and the editor's own
 * anchor format (kix.*) is undocumented — so the only way to get a real inline
 * comment is to drive the editor UI.
 *
 * Keyboard-driven and class-agnostic (the doc body is canvas; toolbar chrome
 * is DOM with localised labels):
 *   Mod+F → type find_text → N×Enter (occurrence) → Esc → Mod+Alt+M → type → Mod+Enter
 *
 * Hardening over a blind key sequence:
 *  - the doc is opened with ?hl=en so the find bar's "X of Y" counter is
 *    parseable; if find_text has no match we abort instead of anchoring the
 *    comment to wherever the cursor happens to be
 *  - after submit we wait for the comment text to appear in the page DOM
 *    (the comment card is DOM even though the doc body is canvas) and report
 *    `verified` accordingly
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { AUDIT_LOG } from './config.js';

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

export class CommentError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function shortHash(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 12);
}

function audit(entry) {
  if (!AUDIT_LOG) return;
  try {
    mkdirSync(dirname(AUDIT_LOG), { recursive: true });
    appendFileSync(AUDIT_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', { mode: 0o640 });
  } catch (err) {
    process.stderr.write(`[gdocs-comments] audit append failed (${AUDIT_LOG}): ${err.message}\n`);
  }
}

/**
 * Best-effort read of the find bar's match counter. Returns
 * { current, total } when parseable, or null when the UI text can't be read
 * (in which case the caller proceeds, matching the original behaviour).
 */
async function readFindCounter(page) {
  try {
    const bar = page.locator('[class*="findbar"]').first();
    const text = await bar.innerText({ timeout: 1500 });
    if (/no results/i.test(text)) return { current: 0, total: 0 };
    const m = text.match(/(\d[\d,.]*)\s+of\s+(\d[\d,.]*)/i);
    if (!m) return null;
    const toInt = (s) => parseInt(s.replace(/[,.]/g, ''), 10);
    return { current: toInt(m[1]), total: toInt(m[2]) };
  } catch {
    return null;
  }
}

/**
 * Add one inline comment. `context` is a live, logged-in BrowserContext.
 * Returns { ok, occurrence_used, verified } and never any document content.
 */
export async function addComment(context, { docId, findText, commentText, occurrence }) {
  const anchored = typeof findText === 'string' && findText.trim() !== '';
  if (anchored && /[\r\n]/.test(findText)) {
    throw new CommentError(
      'find_text must be a single-line fragment (the find bar is one line); anchor to a shorter piece of the passage',
      'BAD_INPUT',
    );
  }
  if (typeof commentText !== 'string' || !commentText.trim()) {
    throw new CommentError('comment_text is required', 'BAD_INPUT');
  }
  const occ = Number.isFinite(occurrence) && occurrence >= 1 ? Math.floor(occurrence) : 1;

  // hl=en pins the editor UI to English so the find counter check is reliable.
  const docUrl = `https://docs.google.com/document/d/${docId}/edit?hl=en`;
  if (!docUrl.startsWith('https://docs.google.com/document/')) {
    throw new CommentError('refused to navigate outside docs.google.com', 'BAD_INPUT');
  }

  const docHash = shortHash([docId]);
  const page = await context.newPage();
  try {
    await page.goto(docUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    const landedAt = new URL(page.url());
    if (landedAt.hostname === 'accounts.google.com') {
      throw new CommentError(
        'Google session expired or missing: run `npx gdocs-comments-mcp login` and try again.',
        'SESSION_EXPIRED',
      );
    }
    if (landedAt.hostname !== 'docs.google.com' || !landedAt.pathname.startsWith(`/document/d/${docId}/`)) {
      throw new CommentError(`unexpected post-navigation URL: ${landedAt.origin}${landedAt.pathname}`, 'NAV_ERROR');
    }

    // Wait for the editor shell (DOM even when the doc body renders to
    // canvas), then let the canvas paint so find has text to search.
    await page.waitForSelector('#docs-editor, .kix-appview-editor', { timeout: 25000 });
    await page.waitForTimeout(3000);

    if (anchored) {
      // Find the anchor text and land on the requested occurrence.
      await page.keyboard.press(`${MOD}+f`);
      await page.waitForTimeout(700);
      await page.keyboard.type(findText, { delay: 8 });
      await page.waitForTimeout(600);

      const counter = await readFindCounter(page);
      if (counter && counter.total === 0) {
        throw new CommentError(
          'find_text was not found in the document — nothing was commented. Check the fragment (it must match the doc text exactly).',
          'TEXT_NOT_FOUND',
        );
      }
      if (counter && occ > counter.total) {
        throw new CommentError(
          `occurrence ${occ} requested but only ${counter.total} match(es) exist — nothing was commented.`,
          'TEXT_NOT_FOUND',
        );
      }

      for (let i = 0; i < occ; i++) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(250);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      // Unanchored: place the cursor at the document start and comment there,
      // so the comment isn't tied to a highlighted range.
      await page.keyboard.press(`${MOD}+Home`);
      await page.waitForTimeout(300);
    }

    // Open the comment box on the found selection, type, submit.
    await page.keyboard.press(`${MOD}+Alt+m`);
    await page.waitForTimeout(1000);
    const lines = commentText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) await page.keyboard.press('Shift+Enter');
      if (lines[i]) await page.keyboard.type(lines[i], { delay: 4 });
    }
    await page.waitForTimeout(300);
    await page.keyboard.press(`${MOD}+Enter`);

    // The doc body is canvas, so DOM text matching the comment is (in
    // practice) the posted comment card. Best-effort: verified=false can be a
    // false negative on very long comments, not proof of failure.
    const snippet = lines.find((l) => l.trim())?.trim().slice(0, 60) ?? '';
    const verified = await page
      .waitForFunction(
        (s) => document.body && document.body.innerText.includes(s),
        snippet,
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(1200); // let the save round-trip settle before closing the tab

    audit({
      event: 'add_comment.ok',
      doc_hash: docHash,
      anchored,
      occurrence_used: anchored ? occ : null,
      find_text_hash: anchored ? shortHash([findText]) : null,
      verified,
    });
    return { ok: true, anchored, occurrence_used: anchored ? occ : null, verified };
  } catch (err) {
    audit({ event: 'add_comment.fail', doc_hash: docHash, reason: err.code || err.message?.slice(0, 200) || 'unknown' });
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}
