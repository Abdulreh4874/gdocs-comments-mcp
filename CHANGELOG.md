# Changelog

## 0.1.1 — 2026-07-12

- Add `mcpName` to package.json and align `server.json` to the current registry
  schema, for listing in the official MCP Registry.

## 0.1.0 — 2026-07-12

Initial public release, extracted from an internal integration.

- `add_comment` MCP tool: range-anchored inline comments on Google Docs via a
  real logged-in browser session (the operation the Docs/Drive APIs cannot do).
- `check_connection` MCP tool for session diagnostics.
- CLI: `login` (one-time interactive sign-in to a managed persistent profile),
  `status`, `logout`.
- Managed-profile mode (default, local machines) and CDP-attach mode
  (`GDOCS_COMMENTS_CDP_URL`, for servers/datacenter IPs).
- Cross-platform keyboard flow (macOS `Cmd`, elsewhere `Ctrl`).
- Safety rails: find-match counting before commenting (`TEXT_NOT_FOUND` instead
  of mis-anchoring), post-submit verification (`verified` flag), doc-id
  validation, docs.google.com-pinned navigation, structured-only output,
  serialized calls, optional hash-only audit log.
