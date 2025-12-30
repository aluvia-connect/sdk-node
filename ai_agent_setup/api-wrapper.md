## API wrapper docs: `AluviaApi` vs `AluviaClient`

This SDK gives you two different “entry points” depending on what you’re trying to do:

- **`AluviaApi`**: a typed HTTP wrapper for Aluvia’s REST API (no proxy, no polling).
- **`AluviaClient`**: a runtime that can start a **local proxy** and keep a connection config **fresh** via polling (and also exposes the API wrapper as `client.api`).

The biggest difference is: **`AluviaApi` calls the control plane only** (API requests), while **`AluviaClient` also runs the data plane** (proxying traffic).

---

## Mental model

### `AluviaApi` (API-only)

Use `AluviaApi` when you want to:

- List / create / update / delete **account connections**
- Fetch account metadata like usage/payments/geos
- Build your own tooling around Aluvia’s API

What it does **not** do:

- It does not start a local proxy.
- It does not route traffic.
- It does not poll for config changes.

### `AluviaClient` (proxy runtime + config manager)

Use `AluviaClient` when you want to:

- Start a connection and **get proxy settings** to plug into Playwright/Puppeteer/Selenium/Node HTTP clients.
- Optionally run a local proxy that does **hostname-based smart routing** (`localProxy: true`, default).

What it does in addition to API calls:

- It loads an account connection config and starts polling for changes.
- In client proxy mode, it runs a local proxy on `127.0.0.1`.

### How they relate

- `AluviaClient` exposes an API wrapper as `client.api`.
  - You can use `client.api.*` without calling `client.start()`.
- You can also use `AluviaApi` directly if you only want the HTTP wrapper and don’t want the proxy runtime concepts in your code.

---

## When to use which (decision guide)

Choose **`AluviaApi`** when:

- You do not need a proxy at all.
- You are building connection management tooling (CRUD connections, read usage, list geos).
- You already have your own proxy logic and only need Aluvia’s API data.

Choose **`AluviaClient`** when:

- You want a one-liner way to configure automation tooling with proxy settings (`connection.asPlaywright()`, etc.).
- You want hostname-based routing without building a routing layer yourself (client proxy mode).

Use **`AluviaClient` + `localProxy: false` (gateway mode)** when:

- You want the SDK to fetch proxy credentials/config, but you do not want to run a local proxy.

---

## What `AluviaApi` actually does under the hood

At a high level, the API wrapper:

- Sends `Authorization: Bearer <apiKey>` on every request.
- Parses JSON responses when `Content-Type` is `application/json`.
- Exposes `etag` from responses, and supports conditional GET (`If-None-Match`) for `account.connections.get(...)`.

Error behavior:

- High-level helpers (`api.account.*`, `api.geos.*`) throw:
  - `InvalidApiKeyError` on `401`/`403`
  - `ApiError` on other non-2xx responses (including structured `{ success: false, error: ... }` envelopes)
- The low-level `api.request(...)` method returns `{ status, etag, body }` and **does not throw based purely on status**.

---

## Examples

### API-only usage (no proxy)

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({
  apiKey: process.env.ALUVIA_API_KEY!,
});

const account = await api.account.get();
const geos = await api.geos.list();

// Create a new connection (example body shown; fields depend on API)
const connection = await api.account.connections.create({ target_geo: 'US' });

// Optional: conditional GET using ETag (returns null on 304)
const fresh = await api.account.connections.get(connection.id ?? '', { etag: '"previous-etag"' });
```

### Using the API wrapper from `AluviaClient` (still no proxy required)

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  timeoutMs: 10_000,
});

const connections = await client.api.account.connections.list();
```

### Proxy runtime usage (Playwright example)

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  localProxy: true, // default
});

const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

// ... run automation ...

await connection.close();
```

---

## Common pitfalls

- **Token type matters**: these helpers call `/account/...` endpoints, which require an **account API token** (not a per-connection token).
- **Secrets**: in gateway mode (`localProxy: false`), `connection.getUrl()` embeds proxy credentials; avoid logging it.
- **Browser proxy auth**: Puppeteer/Selenium helpers only provide `--proxy-server=...` and do not implement browser proxy authentication flows.


