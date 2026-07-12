/**
 * MCP stdio server: inline (range-anchored) Google Docs comments.
 *
 * One write tool (add_comment) plus a connection probe. Everything else about
 * a comment's lifecycle (list / reply / resolve / delete) works fine over the
 * Drive API — use a Drive-API-based tool for those; this server exists only
 * for the one operation that API cannot do.
 *
 * Output is structured-only ({ ok, occurrence_used, verified }) — never raw
 * document content — so a poisoned doc can't smuggle instructions into the
 * model's next turn through this tool.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PKG, extractDocId } from './config.js';
import { MODE, getContext, scheduleIdleClose, shutdown, probeSession } from './browser.js';
import { addComment } from './comment.js';

const TOOLS = [
  {
    name: 'add_comment',
    description:
      'Add an inline comment anchored to a specific text fragment in a Google '
      + 'Doc. Drives a real logged-in Docs session (browser UI) because the '
      + 'Docs/Drive APIs cannot anchor comments to a text range. Use ONLY for '
      + 'adding anchored comments — list/reply/resolve/delete work over the '
      + 'Drive API and belong in Drive tools. Requires a one-time '
      + '`npx gdocs-comments-mcp login` by the operator. Returns only '
      + '{ ok, occurrence_used, verified } — never document content.',
    inputSchema: {
      type: 'object',
      required: ['doc', 'find_text', 'comment_text'],
      properties: {
        doc: {
          type: 'string',
          description: 'Google Docs document id, or the full docs.google.com/document/d/<id>/edit URL.',
        },
        find_text: {
          type: 'string',
          description: 'Exact single-line text fragment to anchor the comment to. Must match the doc text exactly; pick a fragment unique enough to identify the spot (or pass occurrence).',
        },
        comment_text: {
          type: 'string',
          description: 'The comment body. Plain text; newlines allowed.',
        },
        occurrence: {
          type: 'integer',
          minimum: 1,
          description: 'When find_text appears multiple times, anchor to the N-th match (1-based). Default: 1.',
        },
      },
    },
  },
  {
    name: 'check_connection',
    description:
      'Check whether the Google session behind this server is usable: launches/attaches the browser '
      + 'and probes docs.google.com. Returns { connected, mode }. Call this to diagnose failures; '
      + 'if connected=false, ask the operator to run `npx gdocs-comments-mcp login`.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// The keyboard flow must never interleave across concurrent tool calls.
let tail = Promise.resolve();
function withLock(fn) {
  const run = tail.then(() => fn());
  tail = run.catch(() => {});
  return run;
}

async function handleAddComment(args) {
  const docId = extractDocId(args.doc);
  const context = await getContext();
  try {
    return await addComment(context, {
      docId,
      findText: args.find_text,
      commentText: args.comment_text,
      occurrence: args.occurrence,
    });
  } finally {
    scheduleIdleClose();
  }
}

async function handleCheckConnection() {
  try {
    const context = await getContext();
    const connected = await probeSession(context);
    scheduleIdleClose();
    return {
      connected,
      mode: MODE,
      ...(connected ? {} : { hint: 'Run `npx gdocs-comments-mcp login` to (re)connect the Google session.' }),
    };
  } catch (err) {
    return { connected: false, mode: MODE, hint: err.message };
  }
}

const server = new Server(
  { name: 'gdocs-comments-mcp', version: PKG.version },
  {
    capabilities: { tools: {} },
    instructions:
      'Adds inline (range-anchored) comments to Google Docs by driving a logged-in browser session. '
      + 'If a call fails with SESSION_EXPIRED or NOT_CONNECTED, the human operator must run '
      + '`npx gdocs-comments-mcp login` in a terminal — you cannot log in for them. '
      + 'For listing, replying to, resolving, or deleting comments use Drive-API-based tools instead.',
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    if (name === 'add_comment') {
      const result = await withLock(() => handleAddComment(args));
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
    if (name === 'check_connection') {
      const result = await withLock(() => handleCheckConnection());
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  } catch (err) {
    const known = ['NOT_CONNECTED', 'SESSION_EXPIRED', 'PROFILE_LOCKED', 'NO_BROWSER', 'TEXT_NOT_FOUND', 'BAD_INPUT'];
    const msg = known.includes(err.code)
      ? `${err.code}: ${err.message}`
      : `add_comment failed: ${err.message || String(err)}`;
    return { content: [{ type: 'text', text: msg }], isError: true };
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await shutdown();
    process.exit(0);
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[gdocs-comments-mcp] ready (mode: ${MODE})\n`);
