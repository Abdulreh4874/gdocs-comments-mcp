#!/usr/bin/env node
/**
 * Dev helper: post many comments to one doc in a single browser session.
 *
 *   node scripts/try-batch.mjs <doc-id-or-url> <comments.json>
 *
 * comments.json is an array of objects:
 *   [
 *     { "find_text": "quarterly numbers", "comment_text": "Update before Friday" },
 *     { "find_text": "billing system", "comment_text": "Which vendor?", "occurrence": 1 },
 *     { "comment_text": "General note on the whole doc" }   // no find_text = unanchored
 *   ]
 *
 * Set GDOCS_COMMENTS_HEADLESS=false to watch it work.
 */
import { readFileSync } from 'node:fs';
import { extractDocId } from '../src/config.js';
import { getContext, shutdown } from '../src/browser.js';
import { addComment } from '../src/comment.js';

const [docArg, jsonPath] = process.argv.slice(2);
if (!docArg || !jsonPath) {
  console.error('usage: node scripts/try-batch.mjs <doc-id-or-url> <comments.json>');
  process.exit(2);
}

const items = JSON.parse(readFileSync(jsonPath, 'utf8'));
if (!Array.isArray(items) || items.length === 0) {
  console.error('comments.json must be a non-empty JSON array');
  process.exit(2);
}

try {
  const docId = extractDocId(docArg);
  const context = await getContext();
  let ok = 0;
  for (const [i, it] of items.entries()) {
    const label = it.find_text ? `"${it.find_text}"` : '(unanchored)';
    try {
      const r = await addComment(context, {
        docId,
        commentText: it.comment_text,
        findText: it.find_text || undefined,
        occurrence: it.occurrence,
      });
      ok++;
      console.log(`[${i + 1}/${items.length}] ✅ ${label} → ${JSON.stringify(r)}`);
    } catch (err) {
      console.log(`[${i + 1}/${items.length}] ❌ ${label} → ${err.code || ''} ${err.message}`);
    }
  }
  console.log(`\nDone: ${ok}/${items.length} posted.`);
} catch (err) {
  console.error('failed:', err.code || '', err.message);
  process.exitCode = 1;
} finally {
  await shutdown();
}
