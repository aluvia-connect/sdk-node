---
name: aluvia
description: "Route web traffic through premium US mobile carrier IPs to bypass anti-bot systems. Use when an agent needs to browse websites that block bots, handle CAPTCHAs, bypass WAF protections, rotate IPs, or scrape sites returning 403/challenge pages. Wraps the Aluvia CLI for session management, block detection, IP rotation, geo-targeting, and routing rules."
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["aluvia"], "env": ["ALUVIA_API_KEY"] },
        "primaryEnv": "ALUVIA_API_KEY",
        "emoji": "🌐",
      },
  }
---

# Agent Web Unblock: Playwright + Browser + Proxies

## Overview

Aluvia routes AI agent web traffic through premium US mobile carrier IPs so websites treat your agent like a real user. Use the `aluvia` CLI to manage headless Chromium sessions with automatic block detection and unblocking.

**Key facts:**

- Every command outputs a single JSON object to stdout. Parse it with your JSON tool.
- Exit code `0` = success, `1` = error. Errors return `{"error": "message"}`.
- The CLI manages long-running browser daemons — start a session, interact via the `exec` tool, close when done.
- Block detection scores pages 0.0-1.0: `blocked` >= 0.7, `suspected` >= 0.4, `clear` < 0.4.
- `--auto-unblock` handles most blocks automatically by adding hostnames to proxy rules and reloading.

## Prerequisites Check

Before using any command, verify the environment:

```bash
# 1. Check API key is set (never log the full value)
echo "${ALUVIA_API_KEY:0:8}..."

# 2. Verify the CLI binary is available
aluvia help --json

# 3. Verify Playwright is installed (required for browser sessions)
node -e "require('playwright')"
```

If the API key is missing, stop and ask the user to set `ALUVIA_API_KEY`. If `aluvia` is not found, run `npm install @aluvia/sdk`. If Playwright is missing, run `npm install playwright`.

## Core Commands Quick Reference

| Command                     | Purpose                                                 | Common Usage                                                                        |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `session start <url>`       | Launch a headless browser session                       | `aluvia session start https://example.com --auto-unblock --browser-session my-task` |
| `session close`             | Stop a running session                                  | `aluvia session close --browser-session my-task`                                    |
| `session list`              | List all active sessions                                | `aluvia session list`                                                               |
| `session get`               | Get session details + block detection + connection info | `aluvia session get --browser-session my-task`                                      |
| `session rotate-ip`         | Rotate to a new upstream IP                             | `aluvia session rotate-ip --browser-session my-task`                                |
| `session set-geo <geo>`     | Target IPs from a specific US region                    | `aluvia session set-geo us_ca --browser-session my-task`                            |
| `session set-rules <rules>` | Add hostnames to proxy routing                          | `aluvia session set-rules "example.com,api.example.com" --browser-session my-task`  |
| `account`                   | Show account info and balance                           | `aluvia account`                                                                    |
| `account usage`             | Show bandwidth usage stats                              | `aluvia account usage`                                                              |
| `geos`                      | List available geo-targeting regions                    | `aluvia geos`                                                                       |
| `help`                      | Show help (use `--json` for structured output)          | `aluvia help --json`                                                                |

## Standard Workflow

### 1. Start a session

Always use `--browser-session` to name your session. Always use `--auto-unblock` unless you need manual block control.

```bash
aluvia session start https://example.com --auto-unblock --browser-session my-task
```

### 2. Parse the JSON output

The start command returns:

```json
{
  "browserSession": "my-task",
  "pid": 12345,
  "startUrl": "https://example.com",
  "cdpUrl": "http://127.0.0.1:38209",
  "connectionId": 3449,
  "blockDetection": true,
  "autoUnblock": true
}
```

Save `browserSession` — you need it for every subsequent command.

### 3. Monitor for blocks

Check session status including the latest block detection result:

```bash
aluvia session get --browser-session my-task
```

Look at the `lastDetection` object in the response. If `blockStatus` is `"blocked"` and `--auto-unblock` is on, the SDK already handled it. If blocks persist, escalate:

### 4. Rotate IP if blocked

```bash
aluvia session rotate-ip --browser-session my-task
```

Returns a new `sessionId` (UUID). The next request through the proxy uses a fresh IP.

### 5. Set geo-targeting if needed

Some sites serve different content or apply different blocks by region:

```bash
aluvia session set-geo us_ca --browser-session my-task
```

### 6. Expand routing rules

If your agent navigates to new domains that need proxying, add them dynamically:

```bash
aluvia session set-rules "newsite.com,api.newsite.com" --browser-session my-task
```

Rules are appended to existing rules (not replaced).

### 7. Close the session when done

**Always close your session.** Sessions consume resources until explicitly closed.

```bash
aluvia session close --browser-session my-task
```

## Safety Constraints

Follow these rules in every interaction:

1. **Always close sessions.** When your task finishes — success or failure — run `session close`. If uncertain whether a session exists, run `session list` first.
2. **Never expose the API key.** Reference `ALUVIA_API_KEY` by name only. Never log, print, or include its value in output.
3. **Check balance before expensive operations.** Run `aluvia account` and inspect `balance_gb` before long scraping tasks.
4. **Limit IP rotation retries to 3.** If rotating IP three times doesn't resolve a block, stop and report the issue — the site may use fingerprinting beyond IP.
5. **Prefer `--auto-unblock`.** Let the SDK handle block detection and remediation automatically. Only disable it when you need manual control over routing decisions.
6. **Prefer headless mode.** Only use `--headful` for debugging. Headless is faster and uses fewer resources.
7. **Parse exit codes.** Always check the exit code. On exit code 1, parse the `error` field and handle it — do not blindly retry.
8. **Use named sessions.** Always pass `--browser-session <name>` to avoid ambiguity errors when multiple sessions run.
9. **Clean up on failure.** If any step fails, close the session before retrying or aborting. Use `session close --all` as a last resort.
10. **One session per task.** Do not start multiple sessions unless the task explicitly requires parallel browsing of different sites.

## References

For detailed command specs, workflows, and troubleshooting:

- **Command reference:** `{baseDir}/references/command-reference.md` — every flag, output schema, and error for all 11 commands
- **Workflow recipes:** `{baseDir}/references/workflows.md` — step-by-step patterns for common scenarios
- **Troubleshooting:** `{baseDir}/references/troubleshooting.md` — error messages, block score interpretation, signal names, recovery steps
