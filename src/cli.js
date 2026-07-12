#!/usr/bin/env node
import { PKG } from './config.js';

const HELP = `gdocs-comments-mcp v${PKG.version}
Inline (range-anchored) Google Docs comments over MCP.

Usage:
  gdocs-comments-mcp            Run the MCP server (stdio) — this is what MCP clients invoke
  gdocs-comments-mcp setup      One-shot: sign in, then register the server with your MCP client
  gdocs-comments-mcp login      One-time interactive Google sign-in (opens a browser window)
  gdocs-comments-mcp status     Check whether the saved session is still valid
  gdocs-comments-mcp logout     Delete the saved browser profile / Google session
  gdocs-comments-mcp help       Show this help

Environment:
  GDOCS_COMMENTS_PROFILE_DIR      Profile location (default ~/.gdocs-comments-mcp/profile)
  GDOCS_COMMENTS_CDP_URL          Attach to an existing browser over CDP instead (server mode)
  GDOCS_COMMENTS_BROWSER_CHANNEL  chrome (default) | msedge | chromium
  GDOCS_COMMENTS_HEADLESS         false to watch the browser work (default true)
  GDOCS_COMMENTS_IDLE_CLOSE_MIN   Close the idle managed browser after N minutes (default 10)
  GDOCS_COMMENTS_AUDIT_LOG        Path to a JSONL audit log (off unless set)

Docs: https://github.com/stanislawherjan1/gdocs-comments-mcp`;

const cmd = process.argv[2];

switch (cmd) {
  case undefined:
  case 'serve':
    await import('./server.js');
    break;
  case 'setup': {
    const { setup } = await import('./commands.js');
    await setup();
    break;
  }
  case 'login': {
    const { login } = await import('./commands.js');
    await login();
    break;
  }
  case 'status': {
    const { status } = await import('./commands.js');
    await status();
    break;
  }
  case 'logout': {
    const { logout } = await import('./commands.js');
    await logout();
    break;
  }
  case 'help':
  case '--help':
  case '-h':
    console.log(HELP);
    break;
  case '--version':
  case '-v':
    console.log(PKG.version);
    break;
  default:
    console.error(`Unknown command: ${cmd}\n\n${HELP}`);
    process.exit(2);
}
