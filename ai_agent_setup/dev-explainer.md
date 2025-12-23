### Aluvia SDK (`@aluvia/sdk`) — developer explainer

This package is a small Node.js SDK for automation workloads (Playwright/Puppeteer/Selenium, Axios/got, agent frameworks) that need outbound HTTP(S) to go either:

- **Direct to the destination**, or
- **Via the Aluvia gateway proxy**

The key value is that you get **one “connection” object** that:

- Starts a **safe local proxy** on `127.0.0.1` (recommended default), and dynamically decides **per request** whether to proxy or go direct based on hostname rules.
- Or, if you don’t want to run a local proxy, provides **gateway proxy settings** you can plug into your tooling.
- Provides **ready-to-use adapters** for common tools, so you don’t have to learn each library’s proxy configuration quirks.

---

### Why you’d want to use this (what it makes easier)

- **No proxy plumbing per library**: Browsers, Axios, got, undici/fetch all want proxy configuration in different shapes. The SDK gives you `connection.asPlaywright()`, `connection.asAxiosConfig()`, `connection.asUndiciFetch()`, etc.
- **Keeps secrets out of your app config (default mode)**: In the default “client proxy mode”, your tools point at `http://127.0.0.1:<port>` (no embedded credentials). The SDK holds the gateway credentials internally.
- **Selective proxying**: You can proxy only the hosts that need Aluvia (or proxy everything and carve out exceptions). This is useful for performance, cost control, and avoiding surprises.
- **Live updates**: In client proxy mode, the SDK polls for changes (ETag-based) and routing updates apply without restarting your browser or HTTP client process.
- **Safer operational behavior by default**: `strict: true` means `start()` fails fast if the SDK can’t load/create a usable config, preventing “silently routing direct” when you thought you were proxied.

---

### Mental model: two planes

The codebase is intentionally split into two independent “planes”:

- **Control plane (`ConfigManager`)**: Talks to Aluvia’s REST API (`/account/connections/...`) to fetch/create/patch the connection config (proxy credentials + rules). In client proxy mode it also polls for updates.
- **Data plane (`ProxyServer`)**: An optional local proxy (powered by `proxy-chain`) that handles browser/client proxy traffic and, per request, decides whether to forward direct or through the Aluvia gateway.

`AluviaClient` wires these together and exposes the public API.

---

### The public API you’ll actually use

You typically use three things:

- **`new AluviaClient({ apiKey, ...options })`**
- **`const connection = await client.start()`** (idempotent + concurrency-safe)
- **`await connection.close()`** (recommended cleanup)

The `connection` object contains:

- **`connection.url`**: proxy server URL without embedded credentials
- **`connection.getUrl()`**: proxy URL *with* embedded credentials (**contains secrets in gateway mode**)
- **Adapters**:
  - `asPlaywright()`
  - `asPuppeteer()`
  - `asSelenium()`
  - `asNodeAgents()`
  - `asAxiosConfig()`
  - `asGotOptions()`
  - `asUndiciDispatcher()`
  - `asUndiciFetch()`

It also exposes a secondary API wrapper:

- **`client.api`**: typed helpers for Aluvia REST endpoints (`/account`, `/account/connections`, `/geos`, …). This is useful when you want to manage connections without starting a proxy.

---

### Modes: client proxy mode vs gateway mode

#### Client proxy mode (default, recommended): `local_proxy: true`

- The SDK starts a local proxy on **loopback only**: `http://127.0.0.1:<port>`.
- Your browser/HTTP client points to the **local proxy** (no gateway credentials in your process args or config).
- For each request, the SDK decides:
  - **Direct** (no upstream proxy), or
  - **Via Aluvia gateway** (upstream proxy URL embeds credentials internally)
- The SDK polls config (`ETag` + `If-None-Match`) so rules can update at runtime.

In this mode:

- `connection.url === connection.getUrl() === "http://127.0.0.1:<port>"`

This is the best fit when:

- You’re using **Chromium-based tools** where proxy auth can be annoying (Puppeteer/Selenium).
- You want the safest default with minimal secret handling.

#### Gateway mode: `local_proxy: false`

- No local proxy is started.
- The connection describes the upstream gateway settings.
- You’re responsible for configuring proxy auth where your tooling requires it.

In this mode:

- `connection.url` is like `"http://gateway.aluvia.io:8080"` (**no creds**)
- `connection.getUrl()` is like `"http://<user>:<pass>@gateway.aluvia.io:8080"` (**contains secrets**)
- `connection.asPlaywright()` includes `{ username, password }` because Playwright supports it directly.

This is the best fit when:

- You don’t want a local listener/process and your stack can handle proxy auth cleanly.
- You only need Node HTTP clients (Axios/got/undici) and are OK with credentialed proxy URLs internally.

---

### How `start()` works (high-level)

When you call `await client.start()`:

- Validates `apiKey` (empty → `MissingApiKeyError`)
- **Initializes config** via `ConfigManager.init()`:
  - If you passed `connection_id`, it does `GET /account/connections/:id`
  - Otherwise it does `POST /account/connections` to create one
  - It parses `proxy_username` / `proxy_password` and builds a gateway proxy config (the gateway host is currently fixed to `gateway.aluvia.io`)
- Then:
  - **Client proxy mode**: starts polling and starts the local proxy server
  - **Gateway mode**: returns connection adapters for the upstream gateway (no polling, no local proxy)

`start()` is **idempotent and concurrency-safe**: concurrent calls share the same in-flight startup and return the same connection object.

---

### How routing works (the “smart proxy” part)

In client proxy mode, the local proxy uses `proxy-chain`’s `prepareRequestFunction`.

For every proxied request:

- The proxy reads the **latest config** from `ConfigManager` (so updates apply live).
- It extracts the **hostname**:
  - Prefers `params.hostname` (common for HTTPS CONNECT)
  - Otherwise tries `new URL(params.request.url).hostname`
- It computes `shouldProxy(hostname, rules)`:
  - If **false** → route **direct**
  - If **true** → set `upstreamProxyUrl` to the gateway proxy URL embedding credentials

If the SDK doesn’t have config (possible only with `strict: false`), the proxy **bypasses** and routes direct.

---

### Routing rules (hostname-only)

Routing decisions are **hostname-based** (not full URL paths).

Supported patterns:

- `*` matches any hostname
- `example.com` exact match
- `*.example.com` matches any subdomain depth (but not `example.com` itself)
- `google.*` matches `google.com`, `google.co.uk`, etc.

Semantics:

- `[]` → proxy nothing
- Rules prefixed with `-` are **excludes** and win over includes
- If includes contain `*`, proxy everything not excluded
- Rule `AUTO` is ignored (placeholder)

You can update rules at runtime:

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

// Proxy everything except example.com:
await client.updateRules(['*', '-example.com']);

await connection.close();
```

Note: `updateRules()` / `updateSessionId()` require an **account connection id**. If the SDK created the connection but the create response didn’t include an id, these calls will throw `ApiError('No account connection ID available')`.

---

### Common usage patterns

#### Playwright (recommended default mode)

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start(); // local proxy by default

const browser = await chromium.launch({ proxy: connection.asPlaywright() });

try {
  const page = await browser.newPage();
  await page.goto('https://example.com');
} finally {
  await browser.close();
  await connection.close();
}
```

#### Axios / got

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

try {
  const res = await axios.get('https://example.com', connection.asAxiosConfig());
  console.log(res.status);
} finally {
  await connection.close();
}
```

#### Fetch (Node 18+): use the undici adapter

Node’s built-in `fetch()` does **not** accept Node proxy agents. Use:

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

const fetch = connection.asUndiciFetch();
try {
  const res = await fetch('https://example.com');
  console.log(res.status);
} finally {
  await connection.close();
}
```

---

### Updating “session” / rotation behavior

The SDK supports updating upstream connection attributes (e.g., `session_id`) via the account connection API:

- `await client.updateSessionId('my-session-id')`

Operationally, you typically want to create a **new browser context** after changing session settings so new connections pick up the new behavior cleanly.

---

### Error model and operational behavior

- **`MissingApiKeyError`**: `apiKey` missing/empty.
- **`InvalidApiKeyError`**:
  - Returned for `401/403` by API helper calls.
  - Message calls out that `/account/...` endpoints require an **account API token**.
- **`ApiError`**:
  - Non-2xx (non-auth) API failures and malformed responses.
  - Timeouts from `requestCore()` report `statusCode = 408`.
- **`ProxyStartError`**: local proxy failed to bind/listen (e.g., port in use).

Important defaults:

- **`strict: true` (default)**: `start()` fails fast if it can’t load/create config. This prevents “silent direct routing”.
- **`strict: false`**: the SDK may still start a local proxy, but if it has no config it routes direct and polling won’t self-heal until restart (because there’s no initial snapshot / connection id).

---

### Security notes (practical)

- Treat **`apiKey`** as a secret.
- Treat gateway **proxy username/password** as secrets.
- In **gateway mode**, **`connection.getUrl()` contains secrets**. Don’t log it and don’t put it into process args.
- In client proxy mode, the local proxy binds to **`127.0.0.1` only**, and your tools are configured with a **non-secret** local URL.

---

### Where things live in the code (for maintainers)

- **Public exports**: `src/index.ts`
- **Main class**: `src/client/AluviaClient.ts`
- **Control plane**: `src/client/ConfigManager.ts`
- **Data plane (local proxy)**: `src/client/ProxyServer.ts`
- **Rules engine**: `src/client/rules.ts`
- **Adapters**: `src/client/adapters.ts`
- **API wrapper**: `src/api/*` (entry point: `src/api/AluviaApi.ts`, core transport: `src/api/request.ts`)
- **Errors**: `src/errors.ts`


