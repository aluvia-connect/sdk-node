# Aluvia Client Technical Guide



## Table of Contents

- [Architecture](#architecture)
- [AluviaClient API](#aluviaclient-api)
- [Connection Object](#connection-object)
- [Tool Adapters](#tool-adapters)
- [Routing Rules](#routing-rules)
- [Runtime Updates](#runtime-updates)
- [Error Handling](#error-handling)
- [Block Detection](#block-detection)
- [Security](#security)
- [Internal Behavior](#internal-behavior)

---

## Architecture

The client is split into two independent **planes**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AluviaClient                             │
├─────────────────────────────┬───────────────────────────────────┤
│       Control Plane         │          Data Plane               │
│       (ConfigManager)       │          (ProxyServer)            │
├─────────────────────────────┼───────────────────────────────────┤
│ • Fetches/creates config    │ • Local HTTP proxy (proxy-chain)  │
│ • Polls for updates (ETag)  │ • Per-request routing decisions   │
│ • PATCH updates (rules,     │ • Routes direct or via gateway    │
│   session, geo)             │                                   │
├─────────────────────────────┴───────────────────────────────────┤
│                    Rules Engine (shouldProxy)                   │
│          Hostname-based routing: direct vs gateway              │
└─────────────────────────────────────────────────────────────────┘
```

### Control Plane (ConfigManager)

- Communicates with the Aluvia REST API (`/account/connections/...`)
- Fetches proxy credentials and routing rules
- Polls for configuration updates using ETag/If-None-Match
- Applies PATCH updates for rules, session ID, and geo targeting

### Data Plane (ProxyServer)

- Runs a local HTTP proxy powered by `proxy-chain`
- Binds to `127.0.0.1` only (loopback—security first)
- For each incoming request, reads current config and decides:
  - **Direct**: no upstream proxy
  - **Via Aluvia**: upstream proxy URL with embedded credentials

### Rules Engine

- Evaluates `shouldProxy(hostname, rules)` for each request
- Supports wildcards, subdomain matching, and exclusions
- Rules can be updated at runtime

---

---

## AluviaClient API

### Constructor Options

```ts
new AluviaClient(options: AluviaClientOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Account API key (used as `Bearer` token). |
| `connectionId` | `string` | `undefined` | Existing connection ID. If omitted, creates a new connection. |
| `strict` | `boolean` | `true` | Fail fast if config can't be loaded/created. |
| `apiBaseUrl` | `string` | `"https://api.aluvia.io/v1"` | Aluvia API base URL. |
| `pollIntervalMs` | `number` | `5000` | Config polling interval (ms). Minimum: 1000. Values below 1000 are capped. |
| `timeoutMs` | `number` | `30000` | API request timeout in milliseconds (for `client.api` only). Optional — omit to use the default. |
| `gatewayProtocol` | `"http" \| "https"` | `"http"` | Protocol for gateway connection. |
| `gatewayPort` | `number` | `8080` (http) / `8443` (https) | Gateway port. |
| `localPort` | `number` | OS-assigned | Local proxy port (client proxy mode only). |
| `logLevel` | `"silent" \| "info" \| "debug"` | `"info"` | Logging verbosity. |
| `startPlaywright` | `boolean` | `false` | Auto-launch Chromium with proxy configured. Requires `playwright` installed. |
| `blockDetection` | `BlockDetectionConfig` | `undefined` | Configure automatic website block detection. See [Block Detection](#block-detection). |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `api` | `AluviaApi` | Direct access to the REST API wrapper. Available immediately after construction. |
| `connectionId` | `number \| undefined` | Read-only connection ID from ConfigManager. Available after `start()`. |

### Methods

#### `start(): Promise<AluviaClientConnection>`

Starts the client and returns a connection object.

**Behavior:**
1. Validates `apiKey` (throws `MissingApiKeyError` if empty)
2. Initializes configuration via `ConfigManager.init()`:
   - If `connectionId` provided: `GET /account/connections/:id`
   - If omitted: `POST /account/connections` to create one
3. Starts polling for config updates
4. Starts the local proxy on `127.0.0.1`
5. Returns the connection object

**Idempotency:** Calling `start()` multiple times returns the same connection. Concurrent calls share the same startup promise.

```ts
const connection = await client.start();
```

#### `stop(): Promise<void>`

Global cleanup—stops the local proxy (if running) and stops polling.

```ts
await client.stop();
```

**Note:** Prefer `connection.close()` for full cleanup, as it also destroys cached agents/dispatchers.

#### `updateRules(rules: string[]): Promise<void>`

Updates the routing rules via `PATCH /account/connections/:id`.

```ts
await client.updateRules(['example.com', '*.google.com']);
```

**Requirement:** Needs an account connection ID. If the SDK created the connection and the response didn't include an ID, this throws `ApiError`.

#### `updateSessionId(sessionId: string): Promise<void>`

Updates the upstream session ID for sticky sessions / IP rotation.

```ts
await client.updateSessionId('session-abc-123');
```

#### `updateTargetGeo(targetGeo: string | null): Promise<void>`

Updates geo targeting. Pass `null` to clear.

```ts
await client.updateTargetGeo('us_ca');  // Target California IPs
await client.updateTargetGeo(null);    // Clear geo targeting
```

#### `getBlockedHostnames(): string[]`

Returns the list of hostnames that have been marked as persistently blocked (hostname-level escalation after repeated blocks). Used by block detection to prevent infinite retry loops.

#### `clearBlockedHostnames(): void`

Resets the persistent block tracking. Use this to allow the SDK to retry previously blocked hostnames.

---

## Connection Object

The `connection` object returned by `start()` contains proxy details and adapters.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `host` | `string` | Proxy host (`"127.0.0.1"`). |
| `port` | `number` | Local proxy port. |
| `url` | `string` | Proxy URL (`"http://127.0.0.1:<port>"`). |

### Methods

| Method | Description |
|--------|-------------|
| `asPlaywright()` | Returns `{ server, username?, password? }` for Playwright. |
| `asPuppeteer()` | Returns `['--proxy-server=<url>']` for Puppeteer launch args. |
| `asSelenium()` | Returns `'--proxy-server=<url>'` for Selenium. |
| `asNodeAgents()` | Returns `{ http: Agent, https: Agent }` for Node HTTP clients. |
| `asAxiosConfig()` | Returns `{ proxy: false, httpAgent, httpsAgent }` for Axios. |
| `asGotOptions()` | Returns `{ agent: { http, https } }` for got. |
| `asUndiciDispatcher()` | Returns `undici.Dispatcher` for undici clients. |
| `asUndiciFetch()` | Returns a `fetch` function powered by undici with proxy support. |
| `stop()` / `close()` | Stops the connection (proxy, polling, destroys agents). |

### Cleanup

Always call `connection.close()` (or `connection.stop()`) when done:

```ts
try {
  // Use the connection...
} finally {
  await connection.close();
}
```

This:
- Stops config polling
- Stops the local proxy
- Destroys cached Node agents and undici dispatchers

---

## Tool Adapters

### Playwright

```ts
import { chromium } from 'playwright';

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});
```

**Returns:** `{ server: string }` — e.g., `{ server: "http://127.0.0.1:54321" }`

### Puppeteer

```ts
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  args: connection.asPuppeteer(),
});
```

**Returns:** `['--proxy-server=http://127.0.0.1:54321']`

### Selenium

```ts
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

const options = new chrome.Options();
options.addArguments(connection.asSelenium());

const driver = await new Builder()
  .forBrowser('chrome')
  .setChromeOptions(options)
  .build();
```

**Returns:** `'--proxy-server=http://127.0.0.1:54321'`

### Axios

```ts
import axios from 'axios';

const response = await axios.get('https://example.com', connection.asAxiosConfig());
```

**Returns:** `{ proxy: false, httpAgent: Agent, httpsAgent: Agent }`

### got

```ts
import got from 'got';

const response = await got('https://example.com', connection.asGotOptions());
```

**Returns:** `{ agent: { http: Agent, https: Agent } }`

### Fetch (Node 18+)

Node's built-in `fetch()` does **not** accept proxy agents. Use the undici adapter:

```ts
const fetch = connection.asUndiciFetch();

const response = await fetch('https://example.com');
```

**Returns:** A `fetch` function that uses undici with the proxy dispatcher.

### undici Dispatcher

For direct undici usage:

```ts
import { request } from 'undici';

const dispatcher = connection.asUndiciDispatcher();
const response = await request('https://example.com', { dispatcher });
```

---

## Routing Rules

The rules engine determines whether a hostname should be proxied or go direct.

### Rule Patterns

| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `*` | Any hostname | — |
| `example.com` | `example.com` exactly | `www.example.com`, `sub.example.com` |
| `*.example.com` | `www.example.com`, `api.example.com`, `a.b.example.com` | `example.com` itself |
| `google.*` | `google.com`, `google.co.uk`, `google.de` | `www.google.com` |
| `-example.com` | (exclusion) | Excludes `example.com` from proxying |

### Rule Semantics

- **Empty rules `[]`** → proxy nothing (all direct)
- **`['*']`** → proxy everything
- **`['example.com']`** → proxy only `example.com`
- **`['*', '-example.com']`** → proxy everything except `example.com`
- **`['AUTO']`** → placeholder, ignored (same as empty)

**Exclusions win:** Rules prefixed with `-` are exclusions and take precedence over includes.

### Examples

```ts
// Proxy only specific hosts
await client.updateRules(['api.example.com', 'cdn.example.com']);

// Proxy everything
await client.updateRules(['*']);

// Proxy everything except certain hosts
await client.updateRules(['*', '-localhost', '-*.internal.com']);

// Proxy all google domains
await client.updateRules(['*.google.com', 'google.*']);

// Clear rules (all direct)
await client.updateRules([]);
```

### How Routing Works (Client Proxy Mode)

For each proxied request:

1. Local proxy receives the request
2. Extracts the hostname (from CONNECT target or request URL)
3. Calls `shouldProxy(hostname, rules)` with current config
4. If `true` → forwards to `gateway.aluvia.io` with credentials
5. If `false` → routes direct (no upstream proxy)

Because config is read per-request, rule updates apply immediately without restarting the proxy.

---

## Runtime Updates

### Update Rules

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // Required for updates
});

const connection = await client.start();

// Initial state: no proxying
await client.updateRules([]);

// Later: start proxying example.com
await client.updateRules(['example.com']);

// Even later: proxy everything except internal
await client.updateRules(['*', '-*.internal.com']);
```

### Update Session ID

Session IDs enable sticky sessions and IP rotation:

```ts
// Use session "alpha" (same IP for requests with this session)
await client.updateSessionId('alpha');

// Switch to session "beta" (different IP)
await client.updateSessionId('beta');
```

**Tip:** After changing session ID, create a new browser context for requests to use the new session cleanly.

### Update Geo Targeting

```ts
// Target California IPs
await client.updateTargetGeo('us_ca');

// Target New York IPs
await client.updateTargetGeo('us_ny');

// Clear geo targeting
await client.updateTargetGeo(null);
```

### Requirements for Updates

Runtime update methods (`updateRules`, `updateSessionId`, `updateTargetGeo`) require an **account connection ID**:

- If you provided `connectionId` in options, updates work immediately.
- If the SDK created the connection and the API returned an ID, updates work.
- If the create response didn't include an ID, updates throw `ApiError('No account connection ID available')`.

---

## Error Handling

### Error Classes

```ts
import {
  MissingApiKeyError,
  InvalidApiKeyError,
  ApiError,
  ProxyStartError,
  ConnectError,
} from '@aluvia/sdk';
```

| Error | Thrown When |
|-------|-------------|
| `MissingApiKeyError` | `apiKey` is empty or missing in constructor. |
| `InvalidApiKeyError` | API returns 401/403 (invalid or expired token). |
| `ApiError` | Non-auth API failures, malformed responses, timeouts. |
| `ProxyStartError` | Local proxy fails to bind/listen (e.g., port in use). |
| `ConnectError` | `connect()` cannot find, resolve, or establish CDP connection to a session. |

### Error Properties

```ts
try {
  await client.start();
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API error:', error.message);
    console.error('Status code:', error.statusCode); // e.g., 500, 408 (timeout)
  }
}
```

### Strict Mode

**`strict: true`** (default): `start()` throws if config can't be loaded/created.

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  strict: true, // default
});

// Throws if API is unreachable or returns an error
const connection = await client.start();
```

**`strict: false`**: SDK may start with no config (routes direct).

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  strict: false,
});

// May succeed even if config load fails
// Warning: proxy routes direct until config is available
const connection = await client.start();
```

**Warning:** With `strict: false`, if `init()` fails, the local proxy starts but routes **all traffic direct**. Polling won't self-heal because there's no initial config or connection ID.

---

## Block Detection

The SDK includes automatic website block detection that identifies blocks, CAPTCHAs, and WAF challenges using a weighted scoring system. When enabled, it monitors Playwright pages and fires the `onDetection` callback on every page analysis (including clear results). By default, `autoUnblock` is `false` (detection-only mode), meaning the SDK reports detection results but does not automatically remediate. Set `autoUnblock: true` to automatically add blocked hostnames to routing rules and reload the page.

### Configuration

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  startPlaywright: true,
  blockDetection: {
    enabled: true,
    autoUnblock: false,                  // Auto-add rules and reload on block (default: false)
    autoUnblockOnSuspected: false,       // Also reload on "suspected" status (default: false)
    networkIdleTimeoutMs: 3000,          // Max wait for networkidle (default: 3000)
    challengeSelectors: ['#my-captcha'], // Additional DOM selectors to check
    extraKeywords: ['custom block msg'], // Additional keywords to detect
    extraStatusCodes: [418],             // Additional HTTP status codes
    onDetection: (result, page) => {
      console.log(`${result.blockStatus} on ${result.hostname} — score: ${result.score}`);
      console.log('Signals:', result.signals.map(s => s.name));
    },
  },
});
```

### `BlockDetectionConfig`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable detection. |
| `challengeSelectors` | `string[]` | See below | CSS selectors to check for WAF/challenge elements. Defaults to 8 built-in selectors (Cloudflare, reCAPTCHA, hCaptcha, PerimeterX). Providing this replaces the defaults. |
| `extraKeywords` | `string[]` | `[]` | Additional keywords to detect in page content. |
| `extraStatusCodes` | `number[]` | `[]` | Additional HTTP status codes to treat as blocks. |
| `networkIdleTimeoutMs` | `number` | `3000` | Max ms to wait for `networkidle` before full-pass analysis. |
| `autoUnblock` | `boolean` | `false` | Automatically add blocked hostnames to routing rules and reload the page. Set to `true` to enable automatic remediation. |
| `autoUnblockOnSuspected` | `boolean` | `false` | Also reload on `suspected` block status (by default, only `blocked` triggers reload). Requires `autoUnblock: true`. |
| `onDetection` | `function` | `undefined` | Callback fired on every detection result, including `clear`. Receives `(result, page)`. |

#### Default Challenge Selectors

When `challengeSelectors` is not provided, the SDK uses these built-in selectors:

- `#challenge-form` — Cloudflare challenge form
- `#challenge-running` — Cloudflare active challenge
- `.cf-browser-verification` — Cloudflare browser verification
- `iframe[src*="recaptcha"]` — Google reCAPTCHA
- `.g-recaptcha` — Google reCAPTCHA container
- `#px-captcha` — PerimeterX CAPTCHA
- `iframe[src*="hcaptcha"]` — hCaptcha
- `.h-captcha` — hCaptcha container

### Detection Result

The `onDetection` callback receives a `BlockDetectionResult`:

```ts
type BlockDetectionResult = {
  url: string;               // Page URL
  hostname: string;          // Extracted hostname
  blockStatus: DetectionBlockStatus;  // "blocked" | "suspected" | "clear"
  score: number;             // 0.0 to 1.0
  signals: DetectionSignal[];// Fired signals with names and weights
  pass: "fast" | "full";    // Which analysis pass produced this result
  persistentBlock: boolean;  // True if hostname is persistently blocked
  redirectChain: RedirectHop[];
};
```

### How Scoring Works

Each signal detector returns a weight (0.0 to 1.0) representing independent probability of blocking. Scores are combined using probabilistic combination: `score = 1 - product(1 - weight)`. This prevents weak signals from stacking to false positives.

| Score Range | Block Status | Action (when `autoUnblock: true`) |
|-------------|------|--------|
| >= 0.7 | `blocked` | Add hostname to rules and reload page |
| >= 0.4 | `suspected` | Reload only if `autoUnblockOnSuspected: true` |
| < 0.4 | `clear` | No action |

When `autoUnblock: false` (the default), no automatic rule updates or page reloads occur for any status. The `onDetection` callback still fires for every result, allowing agents to inspect scores and take action themselves.

### Signal Detectors

| Signal | Weight | Description |
|--------|--------|-------------|
| `http_status_403` | 0.85 | HTTP 403 Forbidden |
| `http_status_429` | 0.85 | HTTP 429 Too Many Requests |
| `http_status_503` | 0.6 | HTTP 503 Service Unavailable |
| `waf_header_cf_mitigated` | 0.9 | `cf-mitigated: challenge` header |
| `waf_header_cloudflare` | 0.1 | `server: cloudflare` header alone |
| `title_keyword` | 0.8 | Block keywords in page title |
| `challenge_selector` | 0.8 | WAF/CAPTCHA DOM elements detected |
| `visible_text_keyword_strong` | 0.6 | High-confidence keywords on short pages |
| `visible_text_keyword_weak` | 0.15 | Low-confidence keywords with word-boundary matching |
| `visible_text_short` | 0.2 | Page has < 50 chars of visible text |
| `low_text_ratio` | 0.2 | Text-to-HTML ratio < 3% (on pages >= 1000 bytes) |
| `redirect_to_challenge` | 0.7 | Redirect chain includes challenge domain |
| `meta_refresh_challenge` | 0.65 | `<meta http-equiv="refresh">` pointing to challenge URL |

### Two-Pass Analysis

1. **Fast pass** (at `domcontentloaded`): Checks HTTP status and response headers only. If score >= 0.9, triggers immediate remediation without waiting for full page load.
2. **Full pass** (after `networkidle` with timeout cap): Runs all detectors including DOM inspection and page content analysis. If score falls in suspected range (0.4-0.7), re-runs text detection with layout-aware `innerText` for better accuracy.

SPA navigations (URL changes without new HTTP responses) are also detected via `framenavigated` events with per-page debouncing.

### Persistent Block Escalation

The SDK tracks retried URLs and blocked hostnames to prevent infinite retry loops:

1. First block on a URL: add to routing rules and reload.
2. Second block on same URL: mark hostname as persistently blocked, skip reload.
3. Any subsequent URL on a persistently blocked hostname: skip reload immediately.

Use `client.getBlockedHostnames()` to see persistently blocked hostnames and `client.clearBlockedHostnames()` to reset tracking.

### Structured Debug Logging

Set `logLevel: 'debug'` to get JSON-formatted detection results for every analysis pass, useful for calibrating signal weights:

```
Detection result: {"url":"...","blockStatus":"clear","score":0.10,"signals":[{"name":"waf_header_cloudflare","weight":0.10,"source":"fast"}],"pass":"full"}
```

---

## Security

### Secrets

The following values are **secrets**—do not log or expose them:

1. **`apiKey`** — Your account API key
2. **Proxy credentials** — `proxy_username` and `proxy_password` from the API

### Proxy Security

- Local proxy binds to **`127.0.0.1` only** (not `0.0.0.0`)
- `connection.url` and `connection.getUrl()` return the same safe URL
- Credentials never leave the SDK's internal state

---

## Internal Behavior

### Startup Flow

```
new AluviaClient(options)
    │
    ▼
client.start()
    │
    ├─► Validate apiKey
    │
    ├─► ConfigManager.init()
    │       │
    │       ├─► connectionId provided?
    │       │       ├─► Yes: GET /account/connections/:id
    │       │       └─► No:  POST /account/connections
    │       │
    │       └─► Parse response → ConnectionNetworkConfig
    │               • rawProxy (protocol, host, port, username, password)
    │               • rules
    │               • sessionId, targetGeo
    │               • etag
    │
    ├─► Start polling (setInterval)
    │
    ├─► Start ProxyServer on 127.0.0.1
    │
    └─► Return AluviaClientConnection (local proxy URL)
```

### Per-Request Routing (Client Proxy Mode)

```
Incoming request → ProxyServer.handleRequest()
    │
    ├─► ConfigManager.getConfig()
    │       └─► null? → route direct
    │
    ├─► Extract hostname
    │       • From params.hostname (CONNECT)
    │       • Or from request URL
    │       └─► Cannot extract? → route direct
    │
    ├─► shouldProxy(hostname, rules)
    │       ├─► false → route direct
    │       └─► true  → return { upstreamProxyUrl: "http://user:pass@gateway..." }
    │
    └─► proxy-chain handles actual forwarding
```

### Polling (Client Proxy Mode)

- Runs every `pollIntervalMs` (default: 5000ms)
- Uses `If-None-Match: <etag>` for efficient conditional requests
- `304 Not Modified` → keep current config
- `200 OK` → update config (new rules apply to next request)
- Errors → log warning, keep existing config

### Gateway Host

The upstream gateway host is **fixed** to `gateway.aluvia.io`. Only protocol and port are configurable:

- `http://gateway.aluvia.io:8080` (default)
- `https://gateway.aluvia.io:8443`

---

## Example

```ts
import { chromium } from 'playwright';
import { AluviaClient, ApiError, InvalidApiKeyError } from '@aluvia/sdk';

async function main() {
  const client = new AluviaClient({
    apiKey: process.env.ALUVIA_API_KEY!,
    connectionId: process.env.ALUVIA_CONNECTION_ID, // Optional
    logLevel: 'info',
  });

  let connection;
  try {
    connection = await client.start();
    console.log('Proxy started at:', connection.url);
  } catch (error) {
    if (error instanceof InvalidApiKeyError) {
      console.error('Invalid API key. Check your ALUVIA_API_KEY.');
    } else if (error instanceof ApiError) {
      console.error('API error:', error.message, 'Status:', error.statusCode);
    }
    throw error;
  }

  const browser = await chromium.launch({
    proxy: connection.asPlaywright(),
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Initially: proxy everything
    await client.updateRules(['*']);
    await page.goto('https://example.com');

    // Later: only proxy specific hosts
    await client.updateRules(['api.example.com']);
    await page.goto('https://api.example.com/data');

    // Change session for fresh IP
    await client.updateSessionId('session-2');
    await page.goto('https://api.example.com/data');

  } finally {
    await browser.close();
    await connection.close();
  }
}

main().catch(console.error);
```

