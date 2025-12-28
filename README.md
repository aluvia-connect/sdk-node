## @aluvia/sdk

[![npm](https://img.shields.io/npm/v/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![downloads](https://img.shields.io/npm/dm/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![license](https://img.shields.io/npm/l/@aluvia/sdk.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@aluvia/sdk.svg)](./package.json)

**Make your agents finish workflows.** `@aluvia/sdk` is a small Node.js SDK that gives you a **single connection object** that works across your stack (Playwright, Puppeteer, Selenium, Axios, got, undici/fetch) and routes traffic **per hostname** either:

- **Direct to the destination**, or
- **Via the Aluvia gateway** (when a site is blocky / geo-gated / rate-limited)

The default (recommended) mode runs a **safe local proxy on `127.0.0.1`** so proxy credentials stay inside the SDK instead of getting sprayed across configs, args, and logs.

### Why this exists (the three recurring agent failure modes)

- **Reliability**: agents run in the cloud, sites see datacenter identity, you hit blocks/challenges/429/403 at the worst step (login/checkout/form submit) and the workflow fails.
- **Integration pain**: every tool wants proxy configuration in a different shape.
- **No runtime control**: when blocks appear mid-run, you need to change behavior live without restarting long-running fleets.

### What you get

- **Higher workflow completion rates**: route the hard hosts through Aluvia without proxying everything.
- **One integration surface**: one `connection` object adapts to every tool in your stack.
- **Live rules**: change routing behavior at runtime (no restarts).
- **Secure by default**: in the default mode, your code only ever sees `http://127.0.0.1:<port>` (no embedded creds).

### Requirements

- Node.js **18+**

### Install

```bash
npm install @aluvia/sdk
```

### Quick start (Playwright in ~60 seconds)

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
});

const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

try {
  const page = await browser.newPage();
  await page.goto('https://example.com');
} finally {
  await browser.close();
  await connection.close();
}
```

## The core idea: one connection, everywhere

After `await client.start()`, you get a `connection` with adapters you plug directly into your tools:

- **Playwright**: `connection.asPlaywright()` → `{ server, username?, password? }`
- **Puppeteer**: `connection.asPuppeteer()` → `['--proxy-server=<server>']`
- **Selenium**: `connection.asSelenium()` → `'--proxy-server=<server>'`
- **Axios**: `connection.asAxiosConfig()` → `{ proxy: false, httpAgent, httpsAgent }`
- **got**: `connection.asGotOptions()` → `{ agent: { http, https } }`
- **undici / fetch**: `connection.asUndiciDispatcher()` / `connection.asUndiciFetch()`

## Selective proxying (rules are hostname-only)

You can proxy only what needs it (lower cost + lower latency) and bypass everything else.

Patterns supported:

- `*` matches any hostname
- `example.com` exact match
- `*.example.com` matches subdomains (but not `example.com` itself)
- `google.*` matches `google.com`, `google.co.uk`, etc.

Rule semantics:

- Empty `[]` → proxy nothing
- Rules prefixed with `-` are excludes and win over includes
- If positive rules include `*`, proxy everything not excluded
- Rule `AUTO` is ignored (placeholder)

### Update rules live (no restart)

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

try {
  // Proxy everything except your own app:
  await client.updateRules(['*', '-example.com']);
} finally {
  await connection.close();
}
```

## Modes: local proxy (recommended) vs gateway mode

### Client proxy mode (default, recommended)

Set `local_proxy: true` (or omit it).

- Runs a local proxy on **loopback only**: `http://127.0.0.1:<port>`
- Your tools point at the local proxy (safe to share; **no embedded credentials**)
- The SDK decides per request whether to go direct or via Aluvia based on rules
- Rules updates apply live because routing reads the latest config per request

In this mode:

- `connection.url === connection.getUrl() === "http://127.0.0.1:<port>"`

### Gateway mode (no local proxy)

Set `local_proxy: false`.

- No local proxy is started
- `connection.url` is the gateway URL without embedded credentials
- `connection.getUrl()` embeds proxy credentials (**contains secrets**)

Gateway mode is best when your stack cleanly supports proxy auth and you prefer not to run a local listener.

## Common integrations

### Fetch (Node 18+)

Node’s built-in `fetch()` does not accept Node proxy agents. Use the undici-powered adapter:

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

### Axios

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

## Configuration

```ts
new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,

  connection_id: process.env.ALUVIA_CONNECTION_ID,

  local_proxy: true,
  strict: true,

  apiBaseUrl: 'https://api.aluvia.io/v1',
  pollIntervalMs: 5000,
  timeoutMs: 30_000,

  gatewayProtocol: 'http',
  gatewayPort: 8080,
  localPort: 0,

  logLevel: 'info',
});
```

### `strict` vs `strict=false`

- **`strict: true`** (default): `start()` fails fast if it can’t load/create config (prevents “silently routing direct”).
- **`strict: false`**: the SDK may still start a local proxy, but if config is unavailable it will route direct.

## Lifecycle and cleanup

- `await client.start()` is idempotent (and concurrency-safe).
- Prefer `await connection.close()` for full cleanup (stops polling, stops local proxy, releases adapter caches).
- `await client.stop()` stops polling + local proxy, but cannot release adapter caches created on the connection.

## Errors and troubleshooting

- **`MissingApiKeyError`**: empty/whitespace `apiKey`.
- **`InvalidApiKeyError`**: Aluvia API returned 401/403. This SDK uses **account endpoints** (`/account/...`), so you must use an **account API token**.
- **`ProxyStartError`**: local proxy failed to bind/listen (for example, port already in use).
- **`ApiError`**: timeouts, non-2xx API responses, or malformed payloads.

## Security notes

- Treat **`apiKey`** as a secret.
- In **gateway mode** (`local_proxy: false`), **`connection.getUrl()` contains credentials**. Do not log it or put it into process args.
- In **client proxy mode** (default), the local proxy binds to **`127.0.0.1`** only and does not expose gateway credentials to your tool configuration.

## API wrapper (secondary): `client.api`

If you want to manage connections or fetch account metadata without starting a proxy, use `client.api`:

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });

const account = await client.api.account.get();
const connections = await client.api.account.connections.list();

const raw = await client.api.request({ method: 'GET', path: '/account' });
```

## Development

```bash
npm ci
npm test
npm run build
```
