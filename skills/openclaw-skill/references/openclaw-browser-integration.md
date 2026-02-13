# OpenClaw Browser Tool Integration Reference

Use the [OpenClaw browser tool](https://docs.openclaw.ai/tools/browser) with an Aluvia-backed browser by adding the Aluvia session's CDP URL as a **remote CDP profile**. The agent then uses that profile so all browser tool traffic goes through Aluvia's mobile proxy.

---

## Overview

- **OpenClaw browser**: One tool (`browser`) for status, tabs, snapshot, screenshot, navigate, and actions (click/type/drag/select). Supports local managed browser, Chrome extension relay, or **remote CDP**.
- **Integration point**: Create a profile with `cdpUrl` set to the Aluvia session's `cdpUrl`. Use `--browser-profile <name>` (CLI) or `profile` (tool) to target that profile.

---

## Prerequisites

- OpenClaw Gateway (and optional node host) configured; browser enabled in `~/.openclaw/openclaw.json` (`browser.enabled: true`).
- Aluvia session running and its `cdpUrl` available.

---

## Quick workflow

```bash
# 1. Start Aluvia proxy browser
CDP_URL=$(aluvia session start https://example.com --auto-unblock --browser-session my-task | jq -r '.cdpUrl')

# 2. Create OpenClaw profile pointing at Aluvia's CDP
openclaw browser create-profile --name aluvia-task --driver remote --cdp-url "$CDP_URL"

# 3. Use OpenClaw browser with that profile (CLI examples)
openclaw browser --browser-profile aluvia-task open https://example.com
openclaw browser --browser-profile aluvia-task snapshot --interactive
openclaw browser --browser-profile aluvia-task click 12
openclaw browser --browser-profile aluvia-task type 23 "query" --submit

# 4. When done: close Aluvia session and remove profile
aluvia session close --browser-session my-task
openclaw browser delete-profile --name aluvia-task
```

---

## Profile creation

### Create remote CDP profile

```bash
openclaw browser create-profile --name <name> --driver remote --cdp-url <cdpUrl>
```

- **`--name`**: Profile name (e.g. `aluvia-task`). Use this with `--browser-profile <name>`.
- **`--driver remote`**: Profile is a remote CDP endpoint (no local browser launch).
- **`--cdp-url`**: Full CDP URL from Aluvia `session start` output (e.g. `http://127.0.0.1:38209`).

Optional: `--color "#hex"` for UI accent. Config is stored in `~/.openclaw/openclaw.json` under `browser.profiles.<name>`.

### Delete profile when done

```bash
openclaw browser delete-profile --name aluvia-task
```

Removing the profile avoids reusing a stale CDP URL after the Aluvia session is closed.

---

## CLI usage (all commands)

Every browser CLI command accepts `--browser-profile <name>`. Use the Aluvia profile name.

### Basics

| Command | Purpose |
| ------- | ------- |
| `openclaw browser status` | Browser status |
| `openclaw browser start` | Start (N/A for remote profile; Aluvia starts the browser) |
| `openclaw browser stop` | Stop (for remote, close Aluvia session instead) |
| `openclaw browser tabs` | List tabs |
| `openclaw browser open <url>` | Navigate |
| `openclaw browser snapshot` | UI tree (AI snapshot with numeric refs by default) |
| `openclaw browser screenshot` | Screenshot (optional `--full-page`, `--ref <n>`) |

### Snapshot options

| Option | Description |
| ------ | ----------- |
| `--format ai` | AI snapshot with numeric refs (default when Playwright available) |
| `--format aria` | Accessibility tree (inspection only) |
| `--interactive` | Interactive elements only; role refs like `e12` |
| `--compact`, `--depth <n>` | Compact / depth limit |
| `--selector "#main"` | Scope to selector |
| `--frame "iframe#main"` | Scope to iframe |
| `--efficient` | Preset for smaller output |
| `--json` | JSON output |

### Actions (use refs from snapshot)

| Command | Purpose |
| ------- | ------- |
| `openclaw browser click <ref>` | Click (ref: numeric `12` or role `e12`) |
| `openclaw browser type <ref> "text"` | Type; optional `--submit` |
| `openclaw browser fill --fields '[...]'` | Batch fill |
| `openclaw browser hover <ref>` | Hover |
| `openclaw browser scrollintoview <ref>` | Scroll into view |
| `openclaw browser drag <refSrc> <refTgt>` | Drag and drop |
| `openclaw browser select <ref> Opt1 Opt2` | Select options |
| `openclaw browser press Enter` | Press key |

Refs are **not stable across navigations**; re-run `snapshot` after navigation and use fresh refs.

### Wait / debug

| Command | Purpose |
| ------- | ------- |
| `openclaw browser wait --text "Done"` | Wait for text |
| `openclaw browser wait --url "**/dash"` | Wait for URL |
| `openclaw browser wait --load networkidle` | Wait for load state |
| `openclaw browser wait --fn "window.ready===true"` | Wait for JS condition |
| `openclaw browser highlight <ref>` | Highlight element (debug) |
| `openclaw browser trace start` / `trace stop` | Record trace |

### State

| Command | Purpose |
| ------- | ------- |
| `openclaw browser cookies` | Get cookies |
| `openclaw browser cookies set ...` / `clear` | Set/clear cookies |
| `openclaw browser storage local get` / `set` / `clear` | localStorage |
| `openclaw browser set offline on` / `off` | Offline mode |
| `openclaw browser set headers --json '{}'` | Extra headers |
| `openclaw browser set credentials user pass` | HTTP basic auth |
| `openclaw browser set geo <lat> <lon>` | Geolocation |
| `openclaw browser set device "iPhone 14"` | Device emulation |

---

## Agent tool usage

The agent has a single **`browser`** tool. To use Aluvia:

1. **Profile**: Pass `profile: "aluvia-task"` (or whatever name you gave the remote CDP profile).
2. **Target**: For remote CDP, the browser runs where the CDP endpoint is (e.g. same host as Aluvia). Use `target: "host"` or `target: "node"` as appropriate; omit to use default routing.

Example tool usage (conceptual):

- `browser` with `profile: "aluvia-task"`, action `snapshot` → get UI tree with refs.
- `browser` with `profile: "aluvia-task"`, action `act`, `kind: "click"`, `ref: 12` → click ref 12.

Sandboxed sessions: if the browser tool defaults to `target: "sandbox"`, using a host-side Aluvia CDP may require `agents.defaults.sandbox.browser.allowHostControl: true` and `target: "host"`.

---

## Configuration (OpenClaw)

Browser config lives in `~/.openclaw/openclaw.json`:

```json
{
  "browser": {
    "enabled": true,
    "defaultProfile": "chrome",
    "remoteCdpTimeoutMs": 1500,
    "remoteCdpHandshakeTimeoutMs": 3000,
    "profiles": {
      "aluvia-task": {
        "cdpUrl": "http://127.0.0.1:38209",
        "color": "#00AA00"
      }
    }
  }
}
```

- **Remote CDP**: Set `browser.profiles.<name>.cdpUrl` to the Aluvia `cdpUrl`. OpenClaw does not launch a browser for that profile; it attaches to the existing one.
- **Timeouts**: `remoteCdpTimeoutMs` and `remoteCdpHandshakeTimeoutMs` apply to remote CDP reachability.

---

## Session lifecycle

1. **Start Aluvia**: `aluvia session start <url> --auto-unblock --browser-session <name>` → get `cdpUrl`.
2. **Create profile**: `openclaw browser create-profile --name aluvia-task --driver remote --cdp-url "$CDP_URL"`.
3. **Use profile**: All `openclaw browser --browser-profile aluvia-task` (or tool `profile: "aluvia-task"`) commands use the Aluvia-backed browser.
4. **Close Aluvia**: `aluvia session close --browser-session <name>`.
5. **Remove profile**: `openclaw browser delete-profile --name aluvia-task` so the profile is not reused with a dead CDP.

If the agent or process exits without closing the session, run `aluvia session list` and `aluvia session close` as needed.

---

## Refs: AI snapshot vs role snapshot

- **AI snapshot (default)**: Numeric refs (`12`, `23`). Use with `click 12`, `type 23 "text"`.
- **Role snapshot** (`--interactive`, `--compact`, `--depth`, `--selector`, `--frame`): Role refs like `e12`. Use with `click e12`, `highlight e12`.

Refs are invalid after navigation; take a new snapshot and use new refs.

---

## References

- **OpenClaw browser**: [Browser (OpenClaw-managed)](https://docs.openclaw.ai/tools/browser)
- **Aluvia**: [command-reference.md](https://github.com/aluvia-connect/aluvia-skill/blob/main/references/command-reference.md), [workflows.md](https://github.com/aluvia-connect/aluvia-skill/blob/main/references/workflows.md), [troubleshooting.md](https://github.com/aluvia-connect/aluvia-skill/blob/main/references/troubleshooting.md)
