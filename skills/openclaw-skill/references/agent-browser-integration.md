# agent-browser Integration Reference

Use [agent-browser](https://www.npmjs.com/package/agent-browser) (Vercel Labs) to drive an Aluvia-backed browser by connecting via Chrome DevTools Protocol (CDP). All agent-browser traffic then goes through Aluvia's mobile proxy.

---

## Overview

- **agent-browser**: Headless browser automation CLI for AI agents (Rust CLI + Node fallback, Playwright under the hood).
- **Integration point**: agent-browser's `--cdp` flag connects to an existing browser. Aluvia's `session start` launches a Chromium instance and returns a `cdpUrl`; pass that URL to agent-browser so it controls the same browser.

---

## Prerequisites

- Aluvia session running (`aluvia session start ...`) and its `cdpUrl` available.
- agent-browser installed: `npm install -g agent-browser` then `agent-browser install` (Chromium). When using Aluvia's CDP, the local Chromium download is optional — agent-browser attaches to Aluvia's browser.

---

## Quick workflow

```bash
# 1. Start Aluvia proxy browser
CDP_URL=$(aluvia session start https://example.com --auto-unblock --browser-session my-task | jq -r '.cdpUrl')

# 2. Use agent-browser with that CDP endpoint
agent-browser --cdp "$CDP_URL" snapshot -i
agent-browser --cdp "$CDP_URL" click @e1
agent-browser --cdp "$CDP_URL" fill @e2 "search query"

# 3. When done, close the Aluvia session
aluvia session close --browser-session my-task
```

`--cdp` accepts a port number (e.g. `38209`) or a full URL (`http://127.0.0.1:38209`). Aluvia returns a full `cdpUrl`; use it as-is or extract the port.

---

## agent-browser CDP usage

### Passing CDP

- **Per command:** `agent-browser --cdp <port-or-url> <command> ...`
- **Persistent:** `agent-browser connect <port>` then run commands without `--cdp` until `agent-browser close`

Example with URL:

```bash
agent-browser --cdp "http://127.0.0.1:38209" open https://example.com
agent-browser --cdp "http://127.0.0.1:38209" snapshot -i --json
agent-browser --cdp "http://127.0.0.1:38209" click @e2
```

Example with port (local CDP):

```bash
agent-browser --cdp 38209 snapshot -i
```

---

## Commands relevant to Aluvia workflows

| Command | Purpose |
| ------- | ------- |
| `open <url>` | Navigate (alias: `goto`, `navigate`) |
| `snapshot` | Accessibility tree with refs (`@e1`, `@e2`, …). Use `-i` for interactive-only, `--json` for machine output |
| `click <sel>` | Click by ref (`@e1`) or selector |
| `fill <sel> <text>` | Clear and fill input |
| `type <sel> <text>` | Type into element |
| `press <key>` | Press key (Enter, Tab, etc.) |
| `hover <sel>` | Hover element |
| `get text <sel>` | Get text content |
| `get url` | Current URL |
| `screenshot [path]` | Screenshot (optional path; use `--full` for full page) |
| `wait <selector>` | Wait for element |
| `wait --text "..."` | Wait for text |
| `wait --url "**/dash"` | Wait for URL pattern |
| `close` | Close browser connection (does not stop Aluvia daemon; use `aluvia session close` for that) |

### Snapshot options

| Option | Description |
| ------ | ----------- |
| `-i, --interactive` | Only interactive elements (buttons, links, inputs) |
| `-c, --compact` | Fewer structural nodes |
| `-d, --depth <n>` | Limit tree depth |
| `-s, --selector <sel>` | Scope to CSS selector |
| `--json` | JSON output for agents |

Recommended for AI: `agent-browser --cdp "$CDP_URL" snapshot -i --json`, then use refs in `click @eN`, `fill @eN "..."`.

---

## Session lifecycle

1. **Start**: `aluvia session start <url> --auto-unblock --browser-session <name>` → capture `cdpUrl`.
2. **Use**: All agent-browser commands use `--cdp "$CDP_URL"` (or `connect` once).
3. **Close**: Run `aluvia session close --browser-session <name>`. Always close when the task is done; agent-browser `close` only disconnects the client from the browser.

If the agent crashes or exits without closing, run `aluvia session list` and then `aluvia session close --browser-session <name>` or `aluvia session close --all`.

---

## Options (agent-browser)

| Option | Description |
| ------ | ----------- |
| `--cdp <port\|url>` | Connect via CDP (required for Aluvia; use Aluvia's `cdpUrl`) |
| `--session <name>` | Isolated session (separate browser instance) |
| `--profile <path>` | Persistent profile directory |
| `--json` | JSON output |
| `--headed` | Show browser window (Aluvia can start with `--headful` if you need to see the same window) |

When using Aluvia, do not use `--proxy` in agent-browser; proxying is handled by the Aluvia-backed browser.

---

## References

- **agent-browser**: [npm](https://www.npmjs.com/package/agent-browser), [GitHub](https://github.com/vercel-labs/agent-browser)
- **Aluvia**: [command-reference.md](https://github.com/aluvia-connect/aluvia-skill/blob/main/references/command-reference.md), [workflows.md](https://github.com/aluvia-connect/aluvia-skill/blob/main/references/workflows.md), [troubleshooting.md](https://github.com/aluvia-connect/aluvia-skill/blob/main/references/troubleshooting.md)
