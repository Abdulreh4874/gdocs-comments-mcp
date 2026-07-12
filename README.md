# gdocs-comments-mcp

**Inline (range-anchored) comments for Google Docs, over MCP — the one comment operation the Google APIs can't do.**

The Google Docs API has no comment endpoints at all, and the Drive API's `comments.create` accepts an `anchor` field that the Docs editor UI **ignores** — the comment shows up as an unanchored, whole-document comment ([docs](https://developers.google.com/workspace/drive/api/guides/manage-comments), [issue](https://issuetracker.google.com/issues/292610078)). The editor's own anchor format (`kix.*`) is undocumented and can't be produced externally.

This MCP server closes that gap the only way that works: it drives a **real, logged-in Google Docs session** with Playwright and posts the comment through the editor UI — so the comment is genuinely anchored to your text fragment, exactly as if a human selected the text and pressed `Ctrl+Alt+M`.

```
you (or your agent)                    Google Docs
┌───────────────────┐    keyboard    ┌─────────────────────────────┐
│ add_comment(      │   automation   │ "…the quarterly numbers…"   │
│   doc, find_text, │ ─────────────▶ │        ▲                    │
│   comment_text)   │                │        └─ 💬 "Update this   │
└───────────────────┘                │            before Friday"  │
                                     └─────────────────────────────┘
```

## Quickstart

**1. Log in once** (opens a browser window; the session is saved to a local profile):

```bash
npx -y gdocs-comments-mcp login
```

**2. Add the server to your MCP client:**

**Claude Code**

```bash
claude mcp add gdocs-comments -- npx -y gdocs-comments-mcp
```

**Any project (`.mcp.json`)** — Claude Code, Cowork, and most MCP clients pick this up:

```json
{
  "mcpServers": {
    "gdocs-comments": {
      "command": "npx",
      "args": ["-y", "gdocs-comments-mcp"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`) and **Cursor** (`.cursor/mcp.json`) use the same `mcpServers` block.

**3. Use it** — ask your agent:

> Add a comment to https://docs.google.com/document/d/1AbC…/edit — anchor it to "quarterly numbers" and say "Update this before Friday".

## Tools

### `add_comment`

| Param | Required | Description |
|---|---|---|
| `doc` | ✅ | Document id **or** full `docs.google.com/document/d/<id>/edit` URL |
| `find_text` | ✅ | Exact, single-line text fragment to anchor to (must match the doc text) |
| `comment_text` | ✅ | Comment body (plain text, newlines OK) |
| `occurrence` | — | Anchor to the N-th match when `find_text` appears multiple times (default 1) |

Returns `{ ok, occurrence_used, verified }` — `verified` means the posted comment was seen in the page after submitting. The tool **never returns document content**, so a malicious doc can't inject instructions into your agent through it.

If `find_text` isn't found, the call fails with `TEXT_NOT_FOUND` and nothing is posted.

### `check_connection`

Probes the Google session; returns `{ connected, mode }`. If `connected: false`, run `npx gdocs-comments-mcp login` again.

**Scope note:** this server does *one* thing — creating anchored comments. Listing, replying, resolving, and deleting comments all work fine through the Drive API (`comments.*`), which is faster and needs no browser — use a Drive-based MCP for those.

## CLI

```bash
npx gdocs-comments-mcp login    # one-time interactive Google sign-in
npx gdocs-comments-mcp status   # is the saved session still valid?
npx gdocs-comments-mcp logout   # delete the saved session/profile
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `GDOCS_COMMENTS_PROFILE_DIR` | `~/.gdocs-comments-mcp/profile` | Where the logged-in browser profile lives |
| `GDOCS_COMMENTS_BROWSER_CHANNEL` | `chrome` | `chrome` \| `msedge` \| `chromium` (bundled; needs `npx playwright install chromium`) |
| `GDOCS_COMMENTS_HEADLESS` | `true` | Set `false` to watch the automation work |
| `GDOCS_COMMENTS_IDLE_CLOSE_MIN` | `10` | Close the managed browser after N idle minutes (`0` = keep open) |
| `GDOCS_COMMENTS_CDP_URL` | — | Attach to an existing browser over CDP instead of managing a profile (see below) |
| `GDOCS_COMMENTS_AUDIT_LOG` | off | JSONL audit log (hashes only, no content) |

No Playwright browser download is needed: by default the server drives your installed Google Chrome via `playwright-core`.

## Running on a server / datacenter IP

On a residential machine the default profile mode just works. On datacenter IPs, Google's anti-fraud **rejects a freshly launched browser process reusing a saved session** — it bounces to `accounts.google.com/confirmidentifier`. Relaunching from a profile does not work there.

What does work: keep the exact browser the operator logged into **alive**, and let this server attach to it:

1. Start a long-lived Chrome/Chromium (under Xvfb if headless) with `--remote-debugging-port=9333` and log in to Google inside it once.
2. Run the MCP server with `GDOCS_COMMENTS_CDP_URL=http://127.0.0.1:9333`.

The server then drives that live session over CDP and never launches its own browser. Keep the session warm by navigating it to `docs.google.com` every few hours, or an idle session expires after ~1–2 weeks.

## How it works & limitations

The doc body renders to `<canvas>`, so the flow is keyboard-driven and locale-independent: `Ctrl/Cmd+F` → type `find_text` → `Enter`×N → `Esc` → `Ctrl/Cmd+Alt+M` → type comment → `Ctrl/Cmd+Enter`. The doc is opened with `?hl=en` so the find bar's match counter can be checked before commenting.

- **UI automation is inherently less stable than an API.** If Google reworks the editor, this can break until updated. The `verified` flag tells you whether the comment was actually observed after posting.
- The logged-in account needs **comment access** to the target doc.
- An unused session expires after roughly 1–2 weeks; `status` tells you, `login` fixes it.
- Calls are serialized (the keyboard flow can't interleave), so bulk commenting is sequential by design.
- Automating your own Google account through its normal UI is your responsibility under Google's Terms of Service. Use your own account; don't use this for spam.

## Security

- The profile directory contains your **Google session cookies** — treat it like a password. It's created with `0700` permissions; `logout` deletes it.
- Doc ids are strictly validated and navigation is pinned to `docs.google.com` — the tool can't be steered to other sites.
- Tool output is structured-only (`{ ok, occurrence_used, verified }`); document content never flows back to the model.

## License

[MIT](LICENSE)
