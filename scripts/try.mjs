#!/usr/bin/env node
/**
 * Dev helper: post one comment end-to-end against a real doc.
 *
 *   node scripts/try.mjs <doc-id-or-url> "<comment text>" ["<find_text>"] [occurrence]
 *
 * Omit <find_text> to add an unanchored (whole-document) comment.
 * Set GDOCS_COMMENTS_HEADLESS=false to watch it work.
 */
import { extractDocId } from '../src/config.js';
import { getContext, shutdown } from '../src/browser.js';
import { addComment } from '../src/comment.js';

const [docArg, commentText, findText, occ] = process.argv.slice(2);
if (!docArg || !commentText) {
  console.error('usage: node scripts/try.mjs <doc-id-or-url> "<comment>" ["<find_text>"] [occurrence]');
  process.exit(2);
}

try {
  const docId = extractDocId(docArg);
  const context = await getContext();
  const result = await addComment(context, {
    docId,
    commentText,
    findText: findText || undefined,
    occurrence: occ ? Number(occ) : undefined,
  });
  console.log('result:', result);
} catch (err) {
  console.error('failed:', err.code || '', err.message);
  process.exitCode = 1;
} finally {
  await shutdown();
}
