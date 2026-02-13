# Architecture

A detailed guide to the Aluvia SDK architecture — how components connect, data flows through the system, and design decisions behind the implementation.

## Table of Contents

- [System overview](#system-overview)
- [Package structure](#package-structure)
- [Component architecture](#component-architecture)
  - [AluviaClient](#aluviaclient)
  - [ConfigManager (Control Plane)](#configmanager-control-plane)
  - [ProxyServer (Data Plane)](#proxyserver-data-plane)
  - [Rules engine](#rules-engine)
  - [Block detection](#block-detection)
  - [AluviaApi](#aluviaapi)
  - [Session management](#session-management)
  - [CLI](#cli)
  - [MCP server](#mcp-server)
- [Data flow diagrams](#data-flow-diagrams)
- [Build system](#build-system)
- [Design decisions](#design-decisions)

---

## System overview

The Aluvia SDK sits between your application and the web. It runs a local HTTP proxy that intelligently routes traffic — blocked sites go through Aluvia's mobile IP gateway, everything else goes direct.

```
┌──────────────────┐      ┌──────────────────────────┐      ┌──────────────────────┐
│                  │      │                          │      │                      │
│    Your Agent    │─────▶│     Aluvia Client        │─────▶│  gateway.aluvia.io   │
│  (Playwright,    │      │     127.0.0.1:port       │      │    (Mobile IPs)      │
│   Puppeteer,     │      │                          │      │                      │
│   Axios, etc.)   │      │  Per-request routing:    │      └──────────────────────┘
│                  │      │                          │
└──────────────────┘      │  not-blocked.com ──▶ Direct (no proxy)
                          │  blocked-site.com ──▶ Via Aluvia gateway
                          │                          │
                          └──────────────────────────┘
```

The SDK is split into two independent planes:

- **Control Plane (ConfigManager)** — manages configuration by communicating with the Aluvia REST API, polls for updates using ETags, and pushes changes (rules, session ID, geo targeting)
- **Data Plane (ProxyServer)** — handles actual traffic routing at the per-request level using the latest config from the control plane

---

## Package structure

```
@aluvia/sdk
├── src/
│   ├── index.ts              # Public API surface (exports)
│   ├── connect.ts            # CDP connect helper (requires Playwright peer dep)
│   ├── errors.ts             # Custom error class hierarchy
│   │
│   ├── api/                  # REST API client layer
│   │   ├── AluviaApi.ts      # Main API class, constructor, namespace wiring
│   │   ├── request.ts        # Low-level HTTP transport (requestCore)
│   │   ├── apiUtils.ts       # Shared utilities (envelope unwrapping, error handling)
│   │   ├── account.ts        # Account endpoint helpers (createAccountApi)
│   │   ├── geos.ts           # Geos endpoint helpers (createGeosApi)
│   │   └── types.ts          # TypeScript types for API responses
│   │
│   ├── client/               # Core proxy client
│   │   ├── AluviaClient.ts   # Main public class — orchestrates everything
│   │   ├── ConfigManager.ts  # Control plane (fetch/poll/update config)
│   │   ├── ProxyServer.ts    # Data plane (local HTTP proxy)
│   │   ├── BlockDetection.ts # Weighted scoring block detection engine
│   │   ├── adapters.ts       # Framework-specific proxy config adapters
│   │   ├── rules.ts          # Hostname matching and routing rule engine
│   │   ├── logger.ts         # Leveled logger (silent/info/debug)
│   │   └── types.ts          # Public types for client layer
│   │
│   ├── session/              # Session lock file management
│   │   └── lock.ts           # Lock files, session naming, process lifecycle
│   │
│   └── bin/                  # CLI and MCP server entry points
│       ├── cli.ts            # CLI main entry point (aluvia / aluvia-sdk)
│       ├── mcp-server.ts     # MCP server entry point (aluvia-mcp)
│       ├── mcp-tools.ts      # MCP tool implementations
│       ├── mcp-helpers.ts    # Output capture for MCP (AsyncLocalStorage)
│       ├── open.ts           # session start / daemon logic
│       ├── close.ts          # session close logic
│       ├── session.ts        # Session subcommand dispatcher
│       ├── account.ts        # Account CLI commands
│       ├── geos.ts           # Geos CLI command
│       └── api-helpers.ts    # Shared CLI/API helpers
│
├── test/                     # Integration tests (node:test + node:assert)
├── dist/                     # Build output
│   ├── esm/                  # ES modules
│   ├── cjs/                  # CommonJS modules
│   └── types/                # TypeScript declarations
└── docs/                     # Documentation
```

---

## Component architecture

### AluviaClient

`AluviaClient` is the main public entry point that orchestrates all components.

```
AluviaClient
├── ConfigManager (control plane)
│   └── requestCore → Aluvia REST API
├── ProxyServer (data plane)
│   └── proxy-chain (local HTTP proxy)
├── AluviaApi (REST API wrapper)
│   └── requestCore → Aluvia REST API
├── BlockDetection (optional)
│   └── Playwright page event listeners
└── Adapters
    └── Framework-specific proxy configs
```

**Lifecycle:**

1. `new AluviaClient(options)` — validates apiKey, creates ConfigManager, ProxyServer, AluviaApi, and optionally BlockDetection
2. `client.start()` — initializes config (fetches or creates connection), starts polling, starts local proxy, optionally launches Playwright
3. Returns `AluviaClientConnection` with proxy details and adapter methods
4. `connection.close()` — stops proxy, polling, browser, destroys agents

**Idempotency:** Calling `start()` multiple times returns the same connection. Concurrent calls share a single startup promise.

---

### ConfigManager (Control Plane)

Manages the connection configuration lifecycle:

```
ConfigManager
│
├── init()
│   ├── connectionId provided → GET /account/connections/:id
│   └── no connectionId → POST /account/connections
│
├── startPolling()
│   └── setInterval (every pollIntervalMs)
│       └── GET /account/connections/:id (If-None-Match: etag)
│           ├── 304 → keep current config
│           ├── 200 → update config
│           └── error → log, keep current config
│
├── setConfig(body)
│   └── PATCH /account/connections/:id
│
└── getConfig()
    └── Returns current ConnectionNetworkConfig (or null)
```

**Key design:**
- ETag-based polling prevents unnecessary data transfer
- Config is read per-request by ProxyServer, so updates take effect immediately
- Poll guard prevents concurrent polls from overlapping
- Timer uses `.unref()` so it doesn't keep the process alive

---

### ProxyServer (Data Plane)

Runs a local HTTP proxy using `proxy-chain`:

```
Incoming request → ProxyServer.handleRequest()
│
├── ConfigManager.getConfig()
│   └── null → route direct (no config available)
│
├── Extract hostname
│   ├── From CONNECT target (HTTPS)
│   ├── From request URL (HTTP)
│   └── From Host header (fallback)
│
├── shouldProxy(hostname, rules)
│   ├── false → route direct (return undefined)
│   └── true → return { upstreamProxyUrl }
│
└── proxy-chain handles actual forwarding
```

**Security:** Binds to `127.0.0.1` only (loopback). Never exposes the proxy on `0.0.0.0`.

---

### Rules engine

The rules engine (`src/client/rules.ts`) determines per-request routing:

```
Rules: ["*.google.com", "example.com", "-internal.com"]
                ↓
        normalizeRules()
                ↓
  NormalizedRules {
    positiveRules: ["*.google.com", "example.com"],
    negativeRules: ["internal.com"],
    hasCatchAll: false,
    empty: false
  }
                ↓
  shouldProxyNormalized(hostname, normalizedRules)
    1. Check exclusions first (negativeRules) → if match, return false
    2. Check catch-all (*) → if present, return true
    3. Check positive rules → if match, return true
    4. Default: return false
```

**Pattern types:**

| Pattern | Matching logic |
|---------|---------------|
| `*` | Matches everything |
| `example.com` | Exact match (case-insensitive) |
| `*.example.com` | Suffix match on `.example.com` (any subdomain depth) |
| `google.*` | Prefix match on `google.` (any TLD) |
| `-example.com` | Exclusion — takes precedence over includes |

Rules are normalized once when config is loaded, then the pre-computed `NormalizedRules` structure is used for fast per-request matching.

---

### Block detection

The block detection engine uses a weighted scoring system with two-pass analysis:

```
Page Navigation
│
├── domcontentloaded (Fast Pass)
│   ├── HTTP status codes (403, 429, 503)
│   ├── WAF response headers (cf-mitigated, server: cloudflare)
│   └── Score >= 0.9 → immediate remediation, skip full pass
│
├── networkidle (Full Pass, with timeout cap)
│   ├── Page title keywords
│   ├── Challenge DOM selectors (CAPTCHA, WAF forms)
│   ├── Visible text analysis (strong + weak keywords)
│   ├── Text-to-HTML ratio
│   ├── Redirect chain analysis
│   ├── Meta refresh detection
│   └── Score in [0.4, 0.7) → re-evaluate with layout-aware innerText
│
└── framenavigated (SPA Pass)
    └── Content-based detectors only (debounced per page)
```

**Scoring:** Signals are combined using probabilistic combination: `score = 1 - product(1 - weight)`. This prevents weak signals from stacking into false positives.

**Auto-unblock flow (when enabled):**

1. Block detected (score >= 0.7)
2. Check persistent block tracking (prevent infinite loops)
3. Add hostname to proxy routing rules via PATCH API
4. Reload the page
5. If blocked again on same URL → mark hostname as persistently blocked

---

### AluviaApi

A typed REST API wrapper independent of the proxy client:

```
AluviaApi
├── account
│   ├── get()                      → GET /account
│   ├── usage.get(params?)         → GET /account/usage
│   ├── payments.list(params?)     → GET /account/payments
│   └── connections
│       ├── list()                 → GET /account/connections
│       ├── create(body)           → POST /account/connections
│       ├── get(id, opts?)         → GET /account/connections/:id
│       ├── patch(id, body)        → PATCH /account/connections/:id
│       └── delete(id)             → DELETE /account/connections/:id
├── geos
│   └── list()                     → GET /geos
└── request(args)                  → Raw escape hatch
```

**Request pipeline:**

```
AluviaApi method call
    ↓
requestAndUnwrap (envelope unwrapping, error throwing)
    ↓
requestCore (URL building, headers, timeout, JSON parsing)
    ↓
globalThis.fetch
```

- High-level helpers automatically unwrap `{ success: true, data: T }` envelopes
- Auth errors (401/403) throw `InvalidApiKeyError`
- Other errors throw `ApiError` with status code
- ETag support for conditional requests

---

### Session management

Session management uses lock files on disk for inter-process coordination:

```
Session Lifecycle
│
├── session start (CLI parent process)
│   ├── Validate args, check for name conflicts
│   ├── Spawn detached daemon child with --daemon flag
│   ├── Poll lock file every 250ms for ready: true
│   ├── Timeout after 60 seconds
│   └── Output JSON and exit
│
├── Daemon (child process)
│   ├── Create AluviaClient with startPlaywright: true
│   ├── Write early lock file (pid, session, no ready flag)
│   ├── Start proxy, launch browser, navigate
│   ├── Write final lock file (ready: true, cdpUrl, etc.)
│   ├── If --run: execute script, then exit
│   └── Otherwise: stay alive until killed
│
├── connect() (separate process)
│   ├── Read lock files to discover sessions
│   ├── Validate: process alive, session ready, CDP URL present
│   └── Connect to browser via CDP (Playwright connectOverCDP)
│
└── session close
    ├── SIGTERM → daemon
    ├── Wait up to 10 seconds
    ├── SIGKILL if still alive
    └── Clean up lock file
```

**Lock files:**
- Location: `{os.tmpdir()}/aluvia-sdk/cli-{sessionName}.lock`
- Written atomically (temp file + rename)
- Auto-cleaned on stale process detection

---

### CLI

The CLI entry point dispatches commands to handlers:

```
aluvia <command> [args]
│
├── session → handleSession()
│   ├── start → handleOpen() (spawns daemon)
│   ├── close → handleClose()
│   ├── list → listSessions()
│   ├── get → session details + API enrichment
│   ├── rotate-ip → updateSessionId() via API
│   ├── set-geo → updateTargetGeo() via API
│   └── set-rules → updateRules() via API
│
├── account → handleAccount()
│   ├── (default) → api.account.get()
│   └── usage → api.account.usage.get()
│
├── geos → handleGeos()
│   └── api.geos.list()
│
└── help → printHelp() / printHelpJson()
```

All commands output a single JSON object to stdout. Exit code 0 for success, 1 for errors.

---

### MCP server

The MCP server wraps CLI handlers as MCP tools:

```
MCP Server (stdio transport)
│
├── session_start      → captureOutput(handleOpen)
├── session_close      → captureOutput(handleSession["close"])
├── session_list       → captureOutput(handleSession["list"])
├── session_get        → captureOutput(handleSession["get"])
├── session_rotate_ip  → captureOutput(handleSession["rotate-ip"])
├── session_set_geo    → captureOutput(handleSession["set-geo"])
├── session_set_rules  → captureOutput(handleSession["set-rules"])
├── account_get        → captureOutput(handleAccount)
├── account_usage      → captureOutput(handleAccount["usage"])
└── geos_list          → captureOutput(handleGeos)
```

**Output capture:** The MCP server uses `AsyncLocalStorage` to intercept the CLI's `output()` function (which normally calls `process.exit()`). In MCP mode, `output()` throws an `MCPOutputCapture` instead, allowing the server to catch the data and return it as an MCP tool result without exiting the process. This is safe for concurrent tool calls.

---

## Data flow diagrams

### Request routing flow

```
Browser/Client Request
         │
         ▼
┌─────────────────────┐
│   Local Proxy        │
│   127.0.0.1:port     │
│                      │
│   1. Read config     │
│   2. Extract host    │
│   3. Check rules     │
└────┬────────┬────────┘
     │        │
  Direct    Proxied
     │        │
     ▼        ▼
  Target   gateway.aluvia.io:8080
  Server     │
             ▼
          Mobile IP
          Pool
             │
             ▼
          Target
          Server
```

### Configuration update flow

```
client.updateRules(["example.com"])
         │
         ▼
ConfigManager.setConfig({ rules })
         │
         ▼
PATCH /account/connections/:id
         │
         ▼
API returns updated config
         │
         ▼
ConfigManager stores new config
         │
         ▼
Next proxy request reads new config
(immediate effect, no restart needed)
```

### Block detection and auto-unblock flow

```
Page navigation
         │
         ▼
Fast pass (domcontentloaded)
├── HTTP 403/429 → score: 0.85
├── cf-mitigated: challenge → score: 0.90
└── Score >= 0.9? ──Yes──▶ Immediate remediation
         │ No
         ▼
Full pass (networkidle)
├── Title keywords → 0.8
├── CAPTCHA selectors → 0.8
├── Visible text → 0.15-0.6
├── Redirect chains → 0.7
└── Combined score
         │
         ▼
┌─────────────────────┐
│ Score >= 0.7        │──▶ "blocked"
│ Score >= 0.4        │──▶ "suspected"
│ Score < 0.4         │──▶ "clear"
└─────────────────────┘
         │
    (if blocked + autoUnblock)
         │
         ▼
┌─────────────────────┐
│ 1. Check persistent │
│    block tracking    │
│ 2. Add hostname to  │
│    routing rules     │
│ 3. Reload page       │
└─────────────────────┘
```

---

## Build system

The SDK produces a dual ESM/CJS build:

```
Source (ESM, .ts)
    │
    ├── tsc -p tsconfig.esm.json → dist/esm/ (ES modules)
    ├── tsc -p tsconfig.cjs.json → dist/cjs/ (CommonJS + declarations)
    │   └── + dist/cjs/package.json {"type": "commonjs"}
    └── dist/types/ (TypeScript declarations)
```

**Package exports:**

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    }
  }
}
```

**Key details:**
- Source uses `.js` extensions in imports (required for ESM resolution)
- Package is `"type": "module"` (ESM-first)
- CJS build gets a `package.json` shim with `"type": "commonjs"`
- Tests import from `src/` directly via `tsx` loader (no build needed)

---

## Design decisions

### Why a local proxy instead of direct gateway connections?

The local proxy pattern provides several advantages:
- **Universal compatibility** — any tool that supports HTTP proxies works automatically
- **Per-request routing** — the proxy can decide per-request whether to go direct or through Aluvia
- **Runtime rule updates** — rules take effect immediately without restarting browsers or HTTP clients
- **No credential exposure** — proxy credentials stay inside the SDK; clients only see `127.0.0.1:port`

### Why two planes?

Separating control and data planes means:
- Config polling doesn't block request handling
- Config updates are atomic (swap the entire config object)
- The proxy can continue serving requests even if a poll fails
- Each concern has a clear boundary and can be tested independently

### Why proxy-chain?

`proxy-chain` supports both HTTP CONNECT tunneling (for HTTPS) and plain HTTP forwarding, with upstream proxy support — exactly what's needed for selective routing.

### Why `Object.setPrototypeOf` in error classes?

TypeScript's compilation of `extends Error` doesn't always set the prototype chain correctly, which breaks `instanceof` checks. `Object.setPrototypeOf(this, ClassName.prototype)` ensures proper prototype chain for all error classes.

### Why `AsyncLocalStorage` in MCP output capture?

The CLI handlers call `output()` which does `console.log` + `process.exit()`. In MCP mode, multiple tool calls can be in-flight concurrently. `AsyncLocalStorage` provides a per-call context so each MCP tool invocation has its own capture flag, preventing interference between concurrent calls.

### Why atomic lock file writes?

Lock files are read by multiple processes (the CLI, `connect()`, `session list`). Writing to a temp file and atomically renaming prevents partial reads — a reader either sees the old complete file or the new complete file, never a half-written state.
