<h1 align="center">gdocs-comments-mcp</h1>

<p align="center">
  <b>Inline, range-anchored comments for Google Docs — the one comment operation the Google APIs can't do.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gdocs-comments-mcp"><img src="https://img.shields.io/npm/v/gdocs-comments-mcp?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen?logo=node.js" alt="node >= 18">
  <img src="https://img.shields.io/badge/MCP-stdio-8A2BE2" alt="MCP stdio">
</p>

<p align="center">
  <sub>
    <a href="#quickstart">Quickstart</a>
    &nbsp;·&nbsp;
    <a href="#tools">Tools</a>
    &nbsp;·&nbsp;
    <a href="#configuration">Configuration</a>
    &nbsp;·&nbsp;
    <a href="#how-it-works">How it works</a>
    &nbsp;·&nbsp;
    <a href="#troubleshooting">Troubleshooting</a>
    &nbsp;·&nbsp;
    <a href="#running-on-a-server--datacenter-ip">Server deployment</a>
    &nbsp;·&nbsp;
    <a href="#faq">FAQ</a>
  </sub>
</p>

You're building an AI process around Google Docs — an agent that reviews drafts, audits contracts, gives editorial feedback. The natural way to deliver that feedback is how humans do it: **a comment pinned to the exact sentence it's about**, not a wall of text dumped at the end of the doc or into chat.

Then you hit the wall: **the Google APIs can't create anchored comments.** The Docs API has no comment endpoints at all, and the Drive API accepts an `anchor` field only to have the Docs editor ignore it — the comment shows up as a general, whole-document comment.

This MCP server closes that gap. Your agent calls `add_comment` with a text fragment and a comment; the server posts it through a real, logged-in Google Docs session, so it lands anchored to that exact text — just as if a human had selected it and pressed `Ctrl+Alt+M`:

<p align="center">
  <img src="https://raw.githubusercontent.com/stanislawherjan1/gdocs-comments-mcp/main/assets/demo.png" alt="A Google Doc with two inline comments posted by the agent, each anchored to a highlighted text fragment" width="900">
</p>

## Why not the official APIs?

Verified the hard way:

| Operation | Docs API | Drive API | this server |
|---|:---:|:---:|:---:|
| Comment on the whole document | ❌ ¹ | ✅ | ❌ ³ |
| List / reply / resolve / delete comments | ❌ ¹ | ✅ | ❌ ³ |
| **Comment anchored to a text range** | ❌ | ❌ ² | ✅ |

<sup>¹</sup> The Docs API has no comment endpoints at all.
<sup>²</sup> The Drive API's `comments.create` accepts an `anchor` field, but the Docs editor **ignores** it — the comment renders as an unanchored, whole-document comment.
<sup>³</sup> By design — these already work over the Drive API, which is faster and needs no browser. This server does the one thing that API can't.

The Docs editor's own anchor format (`kix.*`) is undocumented and can't be produced externally ([Drive API docs](https://developers.google.com/workspace/drive/api/guides/manage-comments), [issuetracker #292610078](https://issuetracker.google.com/issues/292610078), open since 2016). Driving the editor UI is the only way — so this server does exactly that, and nothing else.

## Quickstart

**1. Log in once** — opens a browser window; the Google session is saved to a local profile (`~/.gdocs-comments-mcp/profile`):

```bash
npx -y gdocs-comments-mcp login
```

**2. Add the server to your MCP client:**

```bash
# Claude Code
claude mcp add gdocs-comments -- npx -y gdocs-comments-mcp
```

<details>
<summary><b>Claude Desktop / Cowork</b></summary>

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

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
</details>

<details>
<summary><b>Project-level <code>.mcp.json</code></b> (shared with your team via git)</summary>

Create `.mcp.json` in the project root — Claude Code, Cowork, and most MCP clients pick it up:

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

Note: every user of the project still runs `npx gdocs-comments-mcp login` once on their own machine — sessions are personal and never shared through git.
</details>

<details>
<summary><b>Cursor</b></summary>

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

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
</details>

<details>
<summary><b>VS Code (GitHub Copilot)</b></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "gdocs-comments": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "gdocs-comments-mcp"]
    }
  }
}
```
</details>

**3. Use it** — ask your agent:

> Add a comment to https://docs.google.com/document/d/1AbC…/edit — anchor it to "quarterly numbers" and say "Update this before Friday".

The agent calls `add_comment` and gets back:

```json
{ "ok": true, "occurrence_used": 1, "verified": true }
```

…and the comment is sitting on the highlighted phrase in the doc, from the account you logged in with.

No Playwright browser download is needed — by default the server drives your installed Google Chrome via `playwright-core`.

## Tools

### `add_comment`

| Param | Required | Description |
|---|:---:|---|
| `doc` | ✅ | Document id **or** full `docs.google.com/document/d/<id>/edit` URL |
| `find_text` | ✅ | Exact, single-line text fragment to anchor to (must match the doc text) |
| `comment_text` | ✅ | Comment body (plain text, newlines OK) |
| `occurrence` | — | Anchor to the N-th match when `find_text` appears multiple times (default 1) |

Returns `{ ok, occurrence_used, verified }` — `verified: true` means the posted comment was observed in the page after submitting. If `find_text` isn't found, the call fails with `TEXT_NOT_FOUND` and **nothing is posted**.

The tool **never returns document content**, so a malicious doc can't inject instructions into your agent through it.

### `check_connection`

Probes the Google session; returns `{ connected, mode }`. If `connected: false`, run `npx gdocs-comments-mcp login` again.

> **Scope note:** this server does *one* thing — creating anchored comments. Listing, replying, resolving, and deleting comments all work fine through the Drive API (`comments.*`), which is faster and needs no browser — use a Drive-based MCP for those.

## CLI

```bash
npx gdocs-comments-mcp login    # one-time interactive Google sign-in
npx gdocs-comments-mcp status   # is the saved session still valid?
npx gdocs-comments-mcp logout   # delete the saved session/profile
```

## Configuration

All optional, via environment variables:

| Env var | Default | Purpose |
|---|---|---|
| `GDOCS_COMMENTS_PROFILE_DIR` | `~/.gdocs-comments-mcp/profile` | Where the logged-in browser profile lives (set a different dir per Google account) |
| `GDOCS_COMMENTS_BROWSER_CHANNEL` | `chrome` | `chrome` \| `msedge` \| `chromium` (bundled; needs `npx playwright install chromium`) |
| `GDOCS_COMMENTS_HEADLESS` | `true` | Set `false` to watch the automation work |
| `GDOCS_COMMENTS_IDLE_CLOSE_MIN` | `10` | Close the managed browser after N idle minutes (`0` = keep open) |
| `GDOCS_COMMENTS_CDP_URL` | — | Attach to an existing browser over CDP instead of managing a profile ([see below](#running-on-a-server--datacenter-ip)) |
| `GDOCS_COMMENTS_AUDIT_LOG` | off | JSONL audit log (hashes only, no content) |

## Troubleshooting

| Error | What it means | Fix |
|---|---|---|
| `NOT_CONNECTED` | No saved Google session yet | `npx gdocs-comments-mcp login` |
| `SESSION_EXPIRED` | The saved session lapsed (idle sessions die after ~1–2 weeks) | `npx gdocs-comments-mcp login` again |
| `TEXT_NOT_FOUND` | `find_text` doesn't occur in the doc (or `occurrence` > number of matches) | Pass a fragment that matches the doc text exactly — nothing was posted |
| `NO_BROWSER` | No Chrome/Edge/Chromium found | Install Google Chrome, or `npx playwright install chromium` + `GDOCS_COMMENTS_BROWSER_CHANNEL=chromium` |
| `PROFILE_LOCKED` | Another process holds the profile (usually a running server + a `login`/`status` attempt) | Stop one of them, or use a second `GDOCS_COMMENTS_PROFILE_DIR` |
| Comment lands but `verified: false` | The post-submit check couldn't see the comment (can be a false negative on long comments) | Check the doc; rerun with `GDOCS_COMMENTS_HEADLESS=false` to watch |

First run on a new machine? `npx gdocs-comments-mcp status` tells you exactly where you stand.

## Running on a server / datacenter IP

On a residential machine the default profile mode just works. On datacenter IPs, Google's anti-fraud **rejects a freshly launched browser process reusing a saved session** — it bounces to `accounts.google.com/confirmidentifier`. Relaunching from a profile does not work there.

What does work: keep the exact browser the operator logged into **alive**, and let this server attach to it:

1. Start a long-lived Chrome/Chromium (under Xvfb if headless) with `--remote-debugging-port=9333` and log in to Google inside it once.
2. Run the MCP server with `GDOCS_COMMENTS_CDP_URL=http://127.0.0.1:9333`.

The server then drives that live session over CDP and never launches its own browser. Keep the session warm by navigating it to `docs.google.com` every few hours, or an idle session expires after ~1–2 weeks.

## How it works

Because the APIs can't anchor a comment, the server does exactly what a person would: it drives the real Google Docs editor. Here's the full path of one `add_comment` call.

**1. Attach to a logged-in browser.** In the default *profile mode*, the server owns a persistent Chromium profile (your installed Google Chrome, via `playwright-core` — no extra browser download). You authenticate into it once with `gdocs-comments-mcp login`; the Google session cookies are saved to `~/.gdocs-comments-mcp/profile` and reused headlessly on every later run. In *CDP mode* (`GDOCS_COMMENTS_CDP_URL`) the server instead attaches over the Chrome DevTools Protocol to a browser you keep alive — see [server deployment](#running-on-a-server--datacenter-ip).

**2. Open the document.** It navigates to `https://docs.google.com/document/d/<id>/edit?hl=en`. The `doc` id is validated first, and navigation is hard-pinned to `docs.google.com` — the tool can't be steered elsewhere. If the page bounces to `accounts.google.com`, the session is dead and the call returns `SESSION_EXPIRED`. `?hl=en` pins the UI language so the find-bar counter is parseable in the next step.

**3. Find the anchor text.** The document body renders to an HTML `<canvas>`, not selectable DOM — so you can't just query for the text and click it. Instead the flow is entirely keyboard-driven (which also makes it locale- and CSS-class-independent):

```
Ctrl/Cmd+F  →  type find_text  →  read the "N of M" match counter
```

Reading the counter **before** commenting is the key safety step: if `find_text` has zero matches, or `occurrence` is larger than the match count, the call fails with `TEXT_NOT_FOUND` and **nothing is posted** — instead of the old failure mode where a blind key sequence would silently drop the comment wherever the cursor happened to sit.

**4. Select the requested occurrence and comment.** It presses `Enter` N times to land on the N-th match, `Esc` to close the find bar (leaving that occurrence selected), then:

```
Ctrl/Cmd+Alt+M  →  type comment_text  →  Ctrl/Cmd+Enter (submit)
```

`Ctrl/Cmd+Alt+M` is the Docs shortcut for "insert comment on the current selection" — which is precisely the anchored comment the APIs won't create. Keyboard shortcuts are chosen per-platform (`Cmd` on macOS, `Ctrl` elsewhere).

**5. Verify and report.** After submitting, the server waits for the comment text to appear in the page and returns `{ ok, occurrence_used, verified }`. `verified: true` means the posted comment was actually observed; it never returns any document content, so a poisoned document can't smuggle instructions back into your agent. Concurrent calls are serialized behind a mutex, because two keyboard flows in the same window would interleave and corrupt each other.

```
add_comment ─▶ attach browser ─▶ open doc (?hl=en) ─▶ Ctrl/Cmd+F find_text
             ─▶ check match counter ─(0 matches)─▶ TEXT_NOT_FOUND, nothing posted
             ─▶ Enter×N ─▶ Esc ─▶ Ctrl/Cmd+Alt+M ─▶ type ─▶ Ctrl/Cmd+Enter
             ─▶ verify comment in page ─▶ { ok, occurrence_used, verified }
```

## Limitations

- **UI automation is inherently less stable than an API.** If Google reworks the editor, this can break until updated. The `verified` flag tells you whether the comment was actually observed after posting; contributions reporting UI changes are very welcome.
- The logged-in account needs **comment access** to the target doc.
- `find_text` must be a **single-line** fragment (the find bar is one line) and must match the document text exactly.
- An unused session expires after roughly 1–2 weeks; `status` tells you, `login` fixes it.
- Calls are serialized, so bulk commenting is sequential by design (typically a few seconds per comment).
- Automating your own Google account through its normal UI is your responsibility under Google's Terms of Service. Use your own account; don't use this for spam.

## Security

- The profile directory contains your **Google session cookies** — treat it like a password. It's created with `0700` permissions; `logout` deletes it (and see [device activity](https://myaccount.google.com/device-activity) to revoke server-side).
- Doc ids are strictly validated and navigation is pinned to `docs.google.com` — the tool can't be steered to other sites.
- Tool output is structured-only (`{ ok, occurrence_used, verified }`); document content never flows back to the model.

## FAQ

**Can the Google Docs API or Drive API create anchored comments on a specific text range?**
No. The Google Docs API has no comment endpoints, and the Drive API's `comments.create` accepts an `anchor` field that the Docs editor ignores — the comment renders as an unanchored, whole-document comment. This project exists specifically to work around that. See [Why not the official APIs?](#why-not-the-official-apis).

**How do I add inline / anchored comments to Google Docs programmatically?**
Use this MCP server, or the same technique it uses: drive the Docs editor UI (find the text, press `Ctrl+Alt+M`) rather than calling the REST API. [How it works](#how-it-works) documents the full flow.

**How do I let an AI agent (Claude, Cursor, Copilot) comment on Google Docs?**
Add this server to your MCP client ([Quickstart](#quickstart)) and the agent gets an `add_comment` tool that posts real, anchored comments — ideal for AI document review, contract/editorial feedback, and automated proofreading workflows.

**Do I need a Google Cloud project, OAuth client, or service account?**
No. Auth is a one-time interactive browser login (`gdocs-comments-mcp login`) using your normal Google account — no API credentials, no OAuth consent screen, no service-account setup.

**Does it work with Google Workspace / shared drives / commenter-only access?**
Yes, as long as the logged-in account has at least comment access to the document.

**Can I run it on a server or in CI?**
Yes — see [Running on a server / datacenter IP](#running-on-a-server--datacenter-ip). On datacenter IPs you attach to a long-lived logged-in browser over CDP instead of relaunching one.

## Contributing

Issues and PRs welcome — especially reports of Docs UI changes that break the keyboard flow (please include your locale and whether `verified` was `false`). Plain ESM, no build step: `git clone`, `npm install`, `node src/cli.js`.

## License

[MIT](LICENSE) © Stanisław Herjan

---

<sub><b>Keywords:</b> Google Docs anchored comments · inline comments Google Docs API · add comments to Google Docs programmatically · Google Docs comment API workaround · MCP server Google Docs · Model Context Protocol · Claude / Cursor / Copilot Google Docs integration · AI document review · Playwright Google Docs automation · comment on text range Google Docs.</sub>
