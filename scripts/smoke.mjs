#!/usr/bin/env node
/**
 * CI smoke test: start the MCP server over stdio, run the initialize
 * handshake and tools/list, and assert the expected tools are exposed.
 * Does NOT launch a browser — it only exercises the protocol layer.
 * Exits non-zero on any mismatch so CI fails loudly.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cliPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.js');
const child = spawn('node', [cliPath], { stdio: ['pipe', 'pipe', 'inherit'] });

const EXPECTED = ['add_comment', 'check_connection'];
const responses = new Map();
let buffer = '';

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id != null) responses.set(msg.id, msg);
  }
});

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + '\n');
}

function fail(reason) {
  console.error(`SMOKE FAIL: ${reason}`);
  child.kill();
  process.exit(1);
}

async function waitFor(id, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (responses.has(id)) return responses.get(id);
    await new Promise((r) => setTimeout(r, 50));
  }
  fail(`timed out waiting for response id=${id}`);
}

const timeout = setTimeout(() => fail('overall timeout'), 20000);

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } });
const init = await waitFor(1);
if (!init.result?.serverInfo?.name) fail('initialize returned no serverInfo');

send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
const list = await waitFor(2);

const names = (list.result?.tools ?? []).map((t) => t.name).sort();
for (const want of EXPECTED) {
  if (!names.includes(want)) fail(`tools/list missing "${want}" (got: ${names.join(', ') || 'none'})`);
}

clearTimeout(timeout);
console.log(`SMOKE OK: ${init.result.serverInfo.name} v${init.result.serverInfo.version} exposes [${names.join(', ')}]`);
child.kill();
process.exit(0);
