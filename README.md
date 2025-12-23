## @aluvia/sdk

**Aluvia SDK** is a Node.js library for AI agents and automation workloads that need outbound HTTP(S) traffic to go either:

- **Direct to the destination**, or
- **Via the Aluvia gateway proxy**

The SDK’s main feature is **`AluviaClient`**: it can run a **local proxy** on `127.0.0.1` (recommended) and decide **per request** whether to route direct or through Aluvia based on hostname rules.

If you don’t want a local proxy process, the SDK also supports **gateway mode**, where it returns upstream gateway proxy settings directly.

### Requirements

- Node.js **18+**

### Install

```bash
npm install @aluvia/sdk
```

### Quick start (Playwright)

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
});

const connection = await client.start(); // idempotent

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

try {
  const page = await browser.newPage();
  await page.goto('https://example.com');
} finally {
  await browser.close();
  await connection.close(); // recommended cleanup
}
```

## Using `AluviaClient` (the main SDK)

### Mental model

`AluviaClient` has two planes:

- **Control plane**: loads an account connection from Aluvia (`/account/connections/...`) and optionally polls for updates.
- **Data plane**: (optional) runs a local proxy and routes requests **by hostname**.

### Modes

#### Client proxy mode (default, recommended)

Set `local_proxy: true` (or omit it).

- **Starts a local proxy** on `http://127.0.0.1:<port>` (binds to loopback only).
- Your tooling (Playwright/Puppeteer/Axios/etc.) points at the **local proxy** (safe to share; no embedded credentials).
- The SDK decides per request whether to go **direct** or through the Aluvia gateway based on hostname rules.
- The SDK **polls** for config changes; routing updates apply without restarting your browser/client.

In this mode:

- `connection.url` is always `http://127.0.0.1:<port>`
- `connection.getUrl()` is the same value (no secrets)

#### Gateway mode (no local proxy)

Set `local_proxy: false`.

- **Does not** start a local proxy.
- `connection.url` is the gateway server URL (no embedded credentials).
- `connection.getUrl()` embeds proxy credentials (**contains secrets**).

In this mode, some tools (notably Chromium via Puppeteer/Selenium) may require you to implement **proxy authentication** handling yourself.

## The `connection` object (adapters you plug into tools)

After `const connection = await client.start()`, you get a connection with:

- **`asPlaywright()`** → `{ server, username?, password? }`
- **`asPuppeteer()`** → `['--proxy-server=<server>']` (no embedded creds)
- **`asSelenium()`** → `'--proxy-server=<server>'` (no embedded creds)
- **`asNodeAgents()`** → `{ http, https }` Node agents (useful for Axios/got)
- **`asAxiosConfig()`** → `{ proxy: false, httpAgent, httpsAgent }`
- **`asGotOptions()`** → `{ agent: { http, https } }`
- **`asUndiciDispatcher()`** → `undici.Dispatcher`
- **`asUndiciFetch()`** → `fetch` (powered by `undici`)

### Proxying `fetch` (Node 18+)

Node’s built-in `fetch()` does not accept Node proxy agents; use the undici-powered adapter:

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

const fetch = connection.asUndiciFetch();

try {
  const res = await fetch('https://ipconfig.io/json');
  console.log(await res.json());
} finally {
  await connection.close();
}
```

### Proxying Axios

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

try {
  const res = await axios.get('https://ipconfig.io/json', connection.asAxiosConfig());
  console.log(res.data);
} finally {
  await connection.close();
}
```

## Routing rules (hostname-only)

Routing decisions are **hostname-based** (not full URL path).

Patterns supported:

- `*` matches any hostname
- `example.com` exact match
- `*.example.com` matches any subdomain depth (but not `example.com` itself)
- `google.*` matches `google.com`, `google.co.uk`, etc.

Rule semantics:

- Empty `[]` → proxy nothing
- Rules prefixed with `-` are excludes and win over includes
- If positive rules include `*`, proxy everything not excluded
- Rule `AUTO` is ignored (placeholder)

### Updating rules at runtime

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

// Proxy everything except example.com:
await client.updateRules(['*', '-example.com']);

await connection.close();
```

### Sticky sessions / IP rotation (session id)

```ts
await client.updateSessionId('my-session-id');
```

## Lifecycle and cleanup

- **`await client.start()`** is idempotent (and concurrency-safe).
- Prefer **`await connection.close()`** for full cleanup:
  - stops polling
  - stops the local proxy (client proxy mode only)
  - releases cached Node agents / undici dispatcher created by adapters
- **`await client.stop()`** stops polling + local proxy, but cannot release adapter caches if you’ve already created them (those caches live on the connection).

## Configuration

```ts
new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!, // required (Bearer token)

  connection_id: process.env.ALUVIA_CONNECTION_ID, // optional; otherwise the SDK POSTs /account/connections

  local_proxy: true, // optional, default true
  strict: true, // optional, default true

  apiBaseUrl: 'https://api.aluvia.io/v1', // optional
  pollIntervalMs: 5000, // optional (client proxy mode polling)
  timeoutMs: 30_000, // optional (affects client.api only)

  gatewayProtocol: 'http', // optional ('http' | 'https'), default 'http'
  gatewayPort: 8080, // optional (defaults to 8080 for http, 8443 for https)
  localPort: 0, // optional; local proxy port (0/undefined = OS picks)

  logLevel: 'info', // optional ('silent' | 'info' | 'debug')
});
```

### `strict` vs `strict=false`

- With **`strict: true`** (default), `start()` fails fast if the SDK can’t load/create initial connection config. This prevents “silent direct routing”.
- With **`strict: false`**, the SDK may still start a local proxy (client proxy mode), but if it has no config it will route **direct** and polling will not self-heal until restart.

## Errors and troubleshooting

- **`MissingApiKeyError`**: you passed an empty `apiKey`.
- **`InvalidApiKeyError`**: Aluvia API returned 401/403. These SDK calls use **`/account/...`** endpoints, so you must use an **account API token** (not a per-connection token).
- **`ProxyStartError`**: local proxy failed to bind/listen (e.g., port in use).
- **`ApiError`**: timeouts, non-2xx API responses, or malformed API payloads.

## Security notes

- Treat **`apiKey`** as a secret.
- In **gateway mode** (`local_proxy: false`), **`connection.getUrl()` contains credentials**. Don’t log it, don’t put it into process args, and don’t send it to telemetry.
- In client proxy mode, the local proxy binds to **`127.0.0.1`** only and does not expose gateway credentials to your tool.

## API wrapper (secondary): `client.api` / `AluviaApi`

You can call Aluvia’s REST API without starting the proxy:

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });

const account = await client.api.account.get();
const connections = await client.api.account.connections.list();

// Low-level escape hatch (returns status + etag + body; does not throw based on status)
const raw = await client.api.request({ method: 'GET', path: '/account' });
```

## More docs

- `docs/use-connection.md`
- `docs/configure-connection.md`
- `docs/api-wrapper.md`

## Development

```bash
npm ci
npm test
npm run build
```
