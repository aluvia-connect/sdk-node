# Aluvia Client Technical Guide



## Table of Contents

- [Architecture](#architecture)
- [Operating Modes](#operating-modes)
- [AluviaClient API](#aluviaclient-api)
- [Connection Object](#connection-object)
- [Tool Adapters](#tool-adapters)
- [Routing Rules](#routing-rules)
- [Runtime Updates](#runtime-updates)
- [Error Handling](#error-handling)
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

## Operating Modes

The client supports two modes controlled by the `localProxy` option:

### Client Proxy Mode (Default)

**`localProxy: true`** (default)

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  localProxy: true, // default
});
```

**Behavior:**
- Starts a local proxy on `http://127.0.0.1:<port>`
- Your tools point at the local proxy (no credentials exposed)
- SDK makes per-request routing decisions (direct vs gateway)
- Polls for config updates—rules apply without restart

**Connection URLs:**
- `connection.url` → `"http://127.0.0.1:54321"` (no creds)
- `connection.getUrl()` → same as `connection.url` (safe)

**Best for:**
- Chromium-based tools (Puppeteer/Selenium) where proxy auth is cumbersome
- Selective per-hostname routing
- Keeping credentials completely out of your tool configuration

### Gateway Mode

**`localProxy: false`**

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  localProxy: false,
});
```

**Behavior:**
- **No local proxy** is started
- Connection returns gateway proxy settings directly
- Your tools must handle proxy authentication
- No continuous polling (config is snapshot at start)

**Connection URLs:**
- `connection.url` → `"http://gateway.aluvia.io:8080"` (no creds)
- `connection.getUrl()` → `"http://user:pass@gateway.aluvia.io:8080"` (**contains secrets**)

**Best for:**
- When you don't want a local listener process
- Tools that handle proxy auth cleanly (Playwright has built-in support)
- Pure HTTP client usage (Axios/got/undici)

### Mode Comparison

| Aspect | Client Proxy Mode | Gateway Mode |
|--------|-------------------|--------------|
| Local proxy | ✅ Starts on `127.0.0.1` | ❌ None |
| Per-request routing | ✅ Based on rules | ❌ All traffic goes through gateway |
| Credentials in config | ❌ Hidden internally | ⚠️ In `getUrl()` / adapters |
| Polling | ✅ Continuous ETag polling | ❌ Snapshot at start |
| Config required | ⚠️ Optional with `strict: false` | ✅ Required (fails without) |

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
| `localProxy` | `boolean` | `true` | Enable client proxy mode (local proxy). |
| `strict` | `boolean` | `true` | Fail fast if config can't be loaded/created. |
| `apiBaseUrl` | `string` | `"https://api.aluvia.io/v1"` | Aluvia API base URL. |
| `pollIntervalMs` | `number` | `5000` | Config polling interval (ms). |
| `timeoutMs` | `number` | `30000` | API request timeout (for `client.api` only). |
| `gatewayProtocol` | `"http" \| "https"` | `"http"` | Protocol for gateway connection. |
| `gatewayPort` | `number` | `8080` (http) / `8443` (https) | Gateway port. |
| `localPort` | `number` | OS-assigned | Local proxy port (client proxy mode only). |
| `logLevel` | `"silent" \| "info" \| "debug"` | `"info"` | Logging verbosity. |

### Methods

#### `start(): Promise<AluviaClientConnection>`

Starts the client and returns a connection object.

**Behavior:**
1. Validates `apiKey` (throws `MissingApiKeyError` if empty)
2. Initializes configuration via `ConfigManager.init()`:
   - If `connectionId` provided: `GET /account/connections/:id`
   - If omitted: `POST /account/connections` to create one
3. Then, based on mode:
   - **Client proxy mode**: starts polling, starts local proxy, returns connection
   - **Gateway mode**: returns connection with gateway settings (no proxy, no polling)

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
await client.updateTargetGeo('US');    // Set geo
await client.updateTargetGeo(null);    // Clear geo
```

---

## Connection Object

The `connection` object returned by `start()` contains proxy details and adapters.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `host` | `string` | Proxy host (`"127.0.0.1"` in client proxy mode). |
| `port` | `number` | Proxy port. |
| `url` | `string` | Proxy URL without credentials. |

### Methods

| Method | Description |
|--------|-------------|
| `getUrl()` | Proxy URL with embedded credentials. **Contains secrets in gateway mode.** |
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
- Stops the local proxy (client proxy mode)
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

**Returns:** `{ server: string, username?: string, password?: string }`

- Client proxy mode: `{ server: "http://127.0.0.1:54321" }` (no creds)
- Gateway mode: includes `username` and `password`

### Puppeteer

```ts
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  args: connection.asPuppeteer(),
});
```

**Returns:** `['--proxy-server=http://127.0.0.1:54321']`

**Note:** Puppeteer/Chromium requires separate proxy auth handling in gateway mode. Use client proxy mode (default) to avoid this.

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
await client.updateTargetGeo('CA');

// Target New York IPs
await client.updateTargetGeo('NY');

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
} from '@aluvia/sdk';
```

| Error | Thrown When |
|-------|-------------|
| `MissingApiKeyError` | `apiKey` is empty or missing in constructor. |
| `InvalidApiKeyError` | API returns 401/403 (invalid or expired token). |
| `ApiError` | Non-auth API failures, malformed responses, timeouts. |
| `ProxyStartError` | Local proxy fails to bind/listen (e.g., port in use). |

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

## Security

### Secrets

The following values are **secrets**—do not log or expose them:

1. **`apiKey`** — Your account API key
2. **Proxy credentials** — `proxy_username` and `proxy_password` from the API
3. **`connection.getUrl()`** — Contains credentials in gateway mode

### Client Proxy Mode Security

- Local proxy binds to **`127.0.0.1` only** (not `0.0.0.0`)
- `connection.url` and `connection.getUrl()` return the same safe URL
- Credentials never leave the SDK's internal state

### Gateway Mode Security

- `connection.getUrl()` contains embedded credentials
- Adapters like `asPlaywright()` include `username`/`password`
- **Never log** `connection.getUrl()` or pass it to process args

### Best Practice

```ts
// ✅ Safe to log
console.log('Proxy URL:', connection.url);

// ❌ Never log in gateway mode
console.log('Full URL:', connection.getUrl()); // Contains secrets!
```

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
    ├─► localProxy: true?
    │       │
    │       ├─► Yes (Client Proxy Mode):
    │       │       • Start polling (setInterval)
    │       │       • Start ProxyServer on 127.0.0.1
    │       │       • Return connection (local proxy URL)
    │       │
    │       └─► No (Gateway Mode):
    │               • Return connection (gateway URL + creds)
    │
    └─► Return AluviaClientConnection
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

