# Session Management Guide

A guide to managing browser sessions — starting, connecting, monitoring, and stopping Aluvia browser sessions across processes.

## Table of Contents

- [Overview](#overview)
- [Starting sessions](#starting-sessions)
  - [CLI: session start](#cli-session-start)
  - [Programmatic: AluviaClient with startPlaywright](#programmatic-aluviaclient-with-startplaywright)
- [Connecting to sessions](#connecting-to-sessions)
  - [Using --run scripts](#using---run-scripts)
  - [Using connect()](#using-connect)
  - [Using CDP directly](#using-cdp-directly)
- [Monitoring sessions](#monitoring-sessions)
- [Runtime modifications](#runtime-modifications)
- [Stopping sessions](#stopping-sessions)
- [Session naming](#session-naming)
- [Lock file internals](#lock-file-internals)
- [Multi-session workflows](#multi-session-workflows)

---

## Overview

Aluvia sessions are long-running headless browser instances routed through Aluvia's mobile proxy network. The SDK provides two approaches:

1. **CLI sessions** — managed as background daemon processes with lock files, designed for AI agent frameworks
2. **Programmatic sessions** — managed in-process via `AluviaClient`, designed for Node.js applications

Both approaches support block detection, runtime rule updates, IP rotation, and geo targeting.

---

## Starting sessions

### CLI: session start

```bash
aluvia session start https://example.com --auto-unblock
```

This spawns a background daemon that:
1. Creates an `AluviaClient` with `startPlaywright: true`
2. Starts a local proxy and launches headless Chromium
3. Navigates to the URL
4. Writes a lock file marking the session as ready
5. Stays alive until killed or browser disconnects

The CLI parent process polls the lock file and exits once the session is ready.

**Common options:**

```bash
# With auto-unblocking (recommended)
aluvia session start https://example.com --auto-unblock

# Run a script then exit
aluvia session start https://example.com --run scrape.mjs

# Visible browser for debugging
aluvia session start https://example.com --headful

# Named session
aluvia session start https://example.com --browser-session my-scraper

# Reuse existing connection
aluvia session start https://example.com --connection-id 3449
```

### Programmatic: AluviaClient with startPlaywright

```ts
import { AluviaClient } from "@aluvia/sdk";

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  startPlaywright: true,
  blockDetection: {
    enabled: true,
    autoUnblock: true,
  },
});

const connection = await client.start();

// connection.browser is a Playwright Browser instance
// connection.browserContext is a BrowserContext
// connection.cdpUrl is the CDP endpoint
const page = await connection.browserContext.newPage();
await page.goto("https://example.com");
```

This runs everything in-process — no daemon, no lock files.

---

## Connecting to sessions

### Using --run scripts

The simplest way to run code against a session. Pass a script path to `session start`:

```bash
aluvia session start https://example.com --auto-unblock --run scrape.mjs
```

```js
// scrape.mjs — page, browser, context are injected as globals
console.log("Title:", await page.title());

// Open additional pages
const newPage = await context.newPage();
await newPage.goto("https://another-site.com");
console.log("Other title:", await newPage.title());
```

**Behavior:**
- The script runs inside the daemon process after the browser is ready
- `page`, `browser`, `context` are injected via `globalThis`
- The session exits when the script finishes (or throws)
- Script errors are logged to the daemon log file
- Script path is resolved relative to the current working directory

### Using connect()

For AI agents that generate automation code at runtime, or long-running processes that need a persistent browser:

```bash
# Start session in background
aluvia session start https://example.com --auto-unblock
```

```ts
import { connect } from "@aluvia/sdk";

// Auto-discover single running session
const { page, browser, context, disconnect, sessionName, cdpUrl } =
  await connect();

console.log(`Connected to session: ${sessionName}`);
console.log(`CDP URL: ${cdpUrl}`);
console.log(`Page: ${page.url()}`);

// Do your work...
await page.click("button.next");

// Disconnect when done (session keeps running!)
await disconnect();
```

**Multiple sessions:**

```ts
// List sessions first
import { connect } from "@aluvia/sdk";

// Connect to a specific session by name
const conn1 = await connect("swift-falcon");
const conn2 = await connect("bold-tiger");

// Use each independently
await conn1.page.goto("https://site-a.com");
await conn2.page.goto("https://site-b.com");

await conn1.disconnect();
await conn2.disconnect();
```

**How connect() works:**
1. Reads lock files from `{os.tmpdir()}/aluvia-sdk/`
2. Resolves to a single session (auto-select or by name)
3. Validates: process alive, session ready, CDP URL present
4. Connects to the browser via Playwright's `chromium.connectOverCDP(cdpUrl)`
5. Gets the first browser context and page (or creates new ones)
6. Returns `ConnectResult` with browser, context, page, and disconnect function

### Using CDP directly

If you're not using Playwright in your connecting process, you can use the CDP URL from `session get` or `session list`:

```bash
aluvia session get
# Output includes: "cdpUrl": "http://127.0.0.1:38209"
```

Use this URL with any CDP client (Puppeteer, chrome-remote-interface, etc.):

```ts
import puppeteer from "puppeteer";

const browser = await puppeteer.connect({
  browserURL: "http://127.0.0.1:38209",
});

const pages = await browser.pages();
console.log("Pages:", pages.length);
```

---

## Monitoring sessions

### List active sessions

```bash
aluvia session list
```

Returns all sessions with their status. Automatically cleans up stale lock files (dead processes).

### Get session details

```bash
aluvia session get [--browser-session <name>]
```

Returns enriched session info including:
- Block detection state (`lastDetection` with score, signals, status)
- Full connection object from the API (proxy credentials, rules, geo, session ID)

### Check block detection state

The `lastDetection` field in `session get` shows the most recent detection result:

```json
{
  "lastDetection": {
    "hostname": "example.com",
    "lastUrl": "https://example.com/page",
    "blockStatus": "blocked",
    "score": 0.85,
    "signals": ["http_status_403", "waf_header_cf_mitigated"],
    "pass": "fast",
    "persistentBlock": false,
    "timestamp": 1739290800000
  }
}
```

---

## Runtime modifications

All modifications work on running sessions via the Aluvia REST API:

### Rotate IP

```bash
aluvia session rotate-ip [--browser-session <name>]
```

Generates a new UUID session ID, which causes the Aluvia gateway to assign a new upstream IP.

### Change geo targeting

```bash
aluvia session set-geo us_ca [--browser-session <name>]
aluvia session set-geo --clear [--browser-session <name>]
```

### Update routing rules

```bash
# Append rules (merges with existing)
aluvia session set-rules "example.com,api.example.com"

# Remove specific rules
aluvia session set-rules --remove "example.com"
```

### Programmatic runtime updates

```ts
// Via AluviaClient (when using programmatic sessions)
await client.updateRules(["example.com", "*.google.com"]);
await client.updateSessionId("new-session-uuid");
await client.updateTargetGeo("us_ca");
await client.updateTargetGeo(null); // clear geo
```

All updates take effect immediately — the next request through the proxy uses the new config.

---

## Stopping sessions

### CLI

```bash
# Auto-select single session
aluvia session close

# Close by name
aluvia session close --browser-session swift-falcon

# Close all sessions
aluvia session close --all
```

**Shutdown sequence:**
1. Send `SIGTERM` to the daemon process
2. Wait up to 10 seconds (polling `isProcessAlive()`)
3. If still alive, send `SIGKILL`
4. Clean up the lock file

### Programmatic

```ts
// Via connection object (recommended — cleans up everything)
await connection.close();

// Via client (stops proxy and polling only)
await client.stop();
```

`connection.close()` handles: browser close, proxy stop, config polling stop, agent/dispatcher destruction.

### Browser closed by user

If running in `--headful` mode and the user closes the browser window, the daemon detects the `disconnected` event and performs graceful shutdown automatically.

---

## Session naming

Sessions are auto-named using an `adjective-noun` pattern: `swift-falcon`, `bold-tiger`, `calm-river`, etc.

**Word pools:**
- 20 adjectives: swift, bold, calm, keen, warm, bright, silent, rapid, steady, clever, vivid, agile, noble, lucid, crisp, gentle, fierce, nimble, sturdy, witty
- 20 nouns: falcon, tiger, river, maple, coral, cedar, orbit, prism, flint, spark, ridge, ember, crane, grove, stone, brook, drift, crest, sage, lynx

**Name generation algorithm:**
1. Pick random adjective + noun: `swift-falcon`
2. Check if a lock file exists for this name
3. If exists and process alive: try with suffix (`swift-falcon-1`, `-2`, etc.)
4. If exists but process dead: clean up stale lock, reuse name
5. After 10 attempts: fall back to `session-{timestamp}`

**Custom names** must match `/^[a-zA-Z0-9_-]+$/` — letters, numbers, hyphens, underscores only.

```bash
aluvia session start https://example.com --browser-session my-scraper-v2
```

---

## Lock file internals

### Location

```
{os.tmpdir()}/aluvia-sdk/cli-{sessionName}.lock
```

Example: `/tmp/aluvia-sdk/cli-swift-falcon.lock`

Daemon logs: `/tmp/aluvia-sdk/cli-swift-falcon.log`

### Lock file format

```json
{
  "pid": 12345,
  "session": "swift-falcon",
  "connectionId": 3449,
  "cdpUrl": "http://127.0.0.1:38209",
  "proxyUrl": "http://127.0.0.1:54321",
  "url": "https://example.com",
  "ready": true,
  "blockDetection": true,
  "autoUnblock": false,
  "lastDetection": { ... }
}
```

### Lock file lifecycle

1. **Early write** — daemon writes `pid`, `session`, `proxyUrl`, `blockDetection`, `autoUnblock`. No `ready` flag.
2. **Final write** — adds `connectionId`, `cdpUrl`, `url`, sets `ready: true`
3. **Runtime updates** — `lastDetection` updated on each block detection event
4. **Cleanup** — deleted on process exit, kill, or `session close`

### Atomic writes

Lock files use write-to-temp + atomic rename to prevent partial reads:

```ts
fs.writeFileSync(tmpPath, JSON.stringify(data));
fs.renameSync(tmpPath, filePath);
```

### Stale lock detection

`session list`, `session close`, and `connect()` all verify the PID is alive using `process.kill(pid, 0)`. Dead-process lock files are automatically removed.

---

## Multi-session workflows

### Running multiple sessions simultaneously

```bash
# Start multiple named sessions
aluvia session start https://site-a.com --browser-session scraper-a --auto-unblock
aluvia session start https://site-b.com --browser-session scraper-b --auto-unblock

# List all
aluvia session list

# Target specific sessions
aluvia session set-geo us_ca --browser-session scraper-a
aluvia session set-geo us_ny --browser-session scraper-b

# Connect from code
const connA = await connect("scraper-a");
const connB = await connect("scraper-b");
```

### AI agent workflow

A typical AI agent workflow:

```bash
# 1. Start session
aluvia session start https://target-site.com --auto-unblock

# 2. Agent runs automation code
# (uses connect() to attach to the session)

# 3. If blocked, the SDK auto-detects and re-routes

# 4. Agent checks session state
aluvia session get

# 5. Agent rotates IP if needed
aluvia session rotate-ip

# 6. Agent changes geo targeting
aluvia session set-geo us_ny

# 7. Clean up
aluvia session close
```

### Using the MCP server

For AI agents using MCP, the same workflow is available as tool calls:

```
session_start(url: "https://target-site.com", autoUnblock: true)
→ returns session details

session_get()
→ returns block detection state

session_rotate_ip()
→ returns new session ID

session_set_geo(geo: "us_ny")
→ confirms geo update

session_close()
→ confirms shutdown
```
