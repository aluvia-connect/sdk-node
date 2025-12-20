# Aluvia SDK (`@aluvia/aluvia-sdk-node`) — Technical Project Doc

This repository contains the implementation for **`@aluvia/aluvia-sdk-node`**, a Node.js SDK that helps automation workloads and “AI agents” route outbound network traffic either:

- **Direct to the destination**, or
- **Through Aluvia’s upstream proxy gateway** (typically `gateway.aluvia.io`)

It supports two operating modes:

- **Gateway mode (default)**: the SDK does **not** run a local proxy. Instead it returns **gateway proxy settings** for you to plug directly into Playwright / Node HTTP clients.
- **Client proxy mode** (`smart_routing: true`): the SDK starts a **local proxy on `127.0.0.1`**, and for each request decides **direct vs via Aluvia** using hostname routing rules.

This doc is written for senior engineers who need to understand the repo deeply, including runtime behavior, API contracts, and known mismatches between docs/tests and current code.

---

## What this package is (and what it is not)

- **It is**: a library intended to be embedded in Node 18+ programs (browser automation, HTTP clients, agent frameworks).
- **It is not**: a web app, a daemon with a CLI, or a multi-user proxy service.
- **It is not**: a full routing engine (routing is hostname-only; no path/method/header rules).

---

## High-level architecture: control plane vs data plane

The core design is intentionally small and splits responsibilities into two planes:

- **Control plane**: talks to the Aluvia API to fetch and refresh configuration (proxy credentials, routing rules, metadata). Implemented by `ConfigManager`.
- **API wrapper**: a thin HTTP facade for calling Aluvia’s API directly via `client.api` / `AluviaApi` (does not require starting the local proxy). Implemented by `src/api/*` and powered by `src/api/request.ts`.
- **Data plane**: optionally runs a local HTTP proxy and makes per-request routing decisions (direct vs via gateway). Implemented by `ProxyServer` (via `proxy-chain`).

`AluviaClient` is the public orchestration layer that wires the planes together and exposes a small public API.

---

## Repository layout and responsibilities

### Public surface

- `src/index.ts`
  - Re-exports:
    - `AluviaClient` (main entry point)
    - `AluviaApi` (API wrapper facade; also exposed as `client.api`)
    - error classes (`MissingApiKeyError`, `InvalidApiKeyError`, `ApiError`, `ProxyStartError`)
    - public types from `src/types.ts`
    - API wrapper schema/envelope types from `src/api/types.ts`

### Core runtime modules

- `src/AluviaClient.ts`
  - Public API + lifecycle orchestration.
  - Owns a `ConfigManager` and (optionally) a `ProxyServer`.
  - Creates the connection object returned from `start()`.

- `src/ConfigManager.ts`
  - Control plane implementation.
  - Fetches initial config and starts polling for updates using **ETag**.
  - Maintains the current config snapshot in memory.
  - Supports writing config back via PATCH to update rules/session_id.

- `src/ProxyServer.ts`
  - Data plane implementation (only used when `smart_routing: true`).
  - Starts a local proxy on `127.0.0.1`.
  - For each request, chooses:
    - **direct** (no upstream proxy), or
    - **upstream Aluvia gateway** (with per-user credentials)

### Supporting modules

- `src/api/request.ts`
  - Single HTTP request core used by both the control plane and API wrapper.
  - Responsibilities:
    - URL join + query serialization
    - auth header + standard JSON headers
    - `If-None-Match` support + ETag capture
    - timeout via `AbortController` (throws `ApiError` with statusCode `408` on timeout)
    - JSON parsing when response is JSON
- `src/api/AluviaApi.ts`
  - API wrapper facade exposed as `client.api`.
  - Provides grouped helpers (`client.api.account.*`, `client.api.geos.*`) and a low-level `client.api.request(...)` escape hatch.
- `src/api/account.ts` / `src/api/geos.ts`
  - Endpoint helpers for the in-scope control-plane endpoints only.
- `src/api/types.ts`
  - Minimal handwritten types for envelopes and endpoint payloads (not OpenAPI-generated).

- `src/rules.ts`
  - Hostname pattern matcher (`matchPattern`)
  - Rule evaluator (`shouldProxy`)

- `src/adapters.ts`
  - Formatting helpers for proxy settings:
    - Playwright proxy object
    - Puppeteer args
    - Selenium arg string
    - Node `HttpsProxyAgent` factory for HTTP clients

- `src/errors.ts`
  - Typed errors used to differentiate missing credentials vs API failures vs proxy startup failures.

- `src/logger.ts`
  - Minimal log-level wrapper around console.

- `src/types.ts`
  - Public types: options, connection surface, log levels.

### Tests

- `test/integration.test.ts`
  - A single file combining multiple suites:
    - `AluviaClient` behavior tests
    - `requestCore` tests (ETag header behavior, JSON body behavior, timeout behavior)
    - `AluviaApi` helper tests (request shape, envelope unwrapping, error behavior)
    - `ConfigManager` polling tests (ETag/304 behavior, including 200→304→200 sequences)
    - `rules` tests (pattern matching and proxy decision semantics)
    - `Logger` and error-class tests (some stale expectations)

---

## Packaging, build outputs, and module format strategy

This package is shipped as **both ESM and CommonJS**, plus TypeScript types:

- `dist/esm/*` — ESM output
- `dist/cjs/*` — CJS output
- `dist/types/*` — `.d.ts` output

Key `package.json` fields:

- `"type": "module"` at the package root (ESM default)
- `"exports"` maps:
  - ESM import → `./dist/esm/index.js`
  - CJS require → `./dist/cjs/index.js`
  - types → `./dist/types/index.d.ts`

Build script:

- Runs `tsc` twice (once for ESM, once for CJS + declarations)
- Writes `dist/cjs/package.json` with `{ "type": "commonjs" }` so consumers can `require()` the CJS build safely even though the root package is ESM.

Runtime requirements:

- **Node >= 18** (relies on built-in `fetch`).

---

## The public API (what a consumer uses)

### `AluviaClient` constructor

```ts
new AluviaClient({
  apiKey: string,                 // required
  connection_id?: string,         // optional
  smart_routing?: boolean,        // optional, default false
  apiBaseUrl?: string,            // optional, default https://api.aluvia.io/v1
  pollIntervalMs?: number,        // optional, default 5000
  timeoutMs?: number,             // optional, default 30000 (API wrapper + control plane HTTP)
  gatewayProtocol?: 'http'|'https', // optional, default http
  gatewayPort?: number,           // optional, default 8080 or 8443 depending on protocol
  localPort?: number,             // optional; only relevant when smart_routing true
  logLevel?: 'silent'|'info'|'debug', // optional, default info
});
```

If `apiKey` is missing/empty, constructor throws `MissingApiKeyError`.

### `client.start(): Promise<AluviaClientConnection>`

`start()` is idempotent: calling it multiple times returns the same connection object while running.

`start()` always:

- Calls `ConfigManager.init()` (fetch initial config)
- Starts config polling (`ConfigManager.startPolling()`)

Then it branches based on `smart_routing`:

- If `smart_routing` is **false** (default):
  - **No local proxy is started**
  - The connection adapters use the **remote gateway** settings from config
- If `smart_routing` is **true**:
  - Starts a local proxy `http://127.0.0.1:<port>`
  - Connection adapters use the **local proxy URL**
  - The local proxy applies per-request hostname rules to decide which requests go via gateway

### `connection` interface

The connection returned by `start()` exposes a small, intentionally boring surface.

It is designed so that:

- In **client proxy mode** (`smart_routing: true`), you can hand a single **local proxy URL** to anything.
- In **gateway mode** (`smart_routing: false`), you can hand a **gateway proxy config** to tools that support proxy auth (Playwright) and still get a workable `--proxy-server=...` string for Chromium tools (Puppeteer/Selenium).

#### Connection fields

- `host` / `port`
  - In **client proxy mode**: the local proxy bind address (`127.0.0.1`) and port.
  - In **gateway mode**: the upstream gateway host (typically `gateway.aluvia.io`) and port (typically `8080` or `8443`).
- `url`
  - In **client proxy mode**: `http://127.0.0.1:<port>`
  - In **gateway mode**: `<protocol>://gateway.aluvia.io:<port>` (no embedded credentials)

#### Connection helper methods

- `getUrl()`
  - In **client proxy mode**: returns the same value as `url` (a local proxy URL; no embedded credentials).
  - In **gateway mode**: returns a **credential-embedded** proxy URL (escape hatch), e.g. `http://<username>:<password>@gateway.aluvia.io:8080`.
  - Security note: `getUrl()` **contains secrets in gateway mode**. Avoid logging it or putting it into process args / crash reports / telemetry.
- `asPlaywright()`
  - In **client proxy mode**: `{ server: 'http://127.0.0.1:<port>' }`
  - In **gateway mode**: `{ server: '<protocol>://gateway.aluvia.io:<port>', username, password }`
- `asPuppeteer()`
  - Returns Chromium args: `['--proxy-server=<protocol>://<host>:<port>']` (no embedded credentials).
  - Important: Puppeteer/Chromium generally require **separate proxy auth handling** for credentialed proxies; this SDK does not currently provide a dedicated “authenticate to proxy” helper beyond exposing credentials via config / `getUrl()`.
- `asSelenium()`
  - Returns a Chromium arg string: `--proxy-server=<protocol>://<host>:<port>` (no embedded credentials).
  - Same auth caveat as Puppeteer.
- `asNodeAgent()`
  - Returns a cached `HttpsProxyAgent` instance.
  - In **client proxy mode**: the agent targets the local proxy.
  - In **gateway mode**: the agent targets the gateway and includes credentials (equivalent to using `getUrl()` as the agent URL).
- `stop()` and `close()` (aliases)
  - Stops config polling.
  - In **client proxy mode**, also stops the local proxy server.

#### Minimal usage examples

**Client proxy mode** (recommended when you want hostname-based smart routing):

```ts
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY!, smart_routing: true });
const connection = await client.start();

// Safe to pass broadly: local proxy only.
const proxyUrl = connection.url; // e.g. 'http://127.0.0.1:54321'

// Example (Playwright)
const playwrightProxy = connection.asPlaywright(); // { server: proxyUrl }

// ... later
await connection.close();
```

**Gateway mode** (recommended when you want a pure “config provider” with no local proxy):

```ts
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! }); // smart_routing defaults false
const connection = await client.start();

// Safe to pass to Chromium flags (no embedded credentials).
const gatewayServerUrl = connection.url; // e.g. 'http://gateway.aluvia.io:8080'

// Playwright supports explicit proxy auth (preferred).
const playwrightProxy = connection.asPlaywright();

// For Node HTTP clients that accept an Agent (Axios/got/node-fetch style).
const agent = connection.asNodeAgent();

// Escape hatch: auth-in-URL (contains secrets in gateway mode; do not log).
const credentialUrl = connection.getUrl();

await connection.close();
```

#### Important nuance: `connection.url` differs by mode

- In **client proxy mode**: `connection.url` is the local proxy URL (e.g., `http://127.0.0.1:54321`).
- In **gateway mode**: `connection.url` is the gateway server URL without embedding credentials (e.g., `http://gateway.aluvia.io:8080`); `getUrl()` returns a full credential-embedded proxy URL like:
  - `http://<username>:<password>@gateway.aluvia.io:8080`

This is a design choice in current code: `connection.url` is safe to pass to Chromium `--proxy-server` flags, while `getUrl()` is an escape hatch for libraries that require auth-in-URL. Senior integrators should prefer adapters rather than logging or broadly propagating credential-embedded proxy URLs.

### `client.stop()`

Stops polling; if client proxy mode is enabled it also stops the local proxy.

### `client.updateRules(rules: string[])` and `client.updateSessionId(sessionId: string)`

These write back to the Aluvia API (PATCH) via the `ConfigManager`:

- `updateRules([...])` → PATCH with `{ rules: [...] }`
- `updateSessionId("...")` → PATCH with `{ session_id: "..." }`

These require the SDK to have a known `connection_id` (either provided explicitly or successfully extracted from the POST create response).

### `client.api`: API wrapper (no proxy required)

`AluviaClient` exposes an API wrapper under `client.api` that can be used without calling `start()` and without running a local proxy.

Surface:

- `client.api.account.get()` → `GET /account`
- `client.api.account.usage.get({ start?, end? })` → `GET /account/usage`
- `client.api.account.payments.list({ start?, end? })` → `GET /account/payments`
- `client.api.account.connections.list()` → `GET /account/connections`
- `client.api.account.connections.create(body)` → `POST /account/connections`
- `client.api.account.connections.get(connectionId, { etag? })` → `GET /account/connections/{connection_id}`
  - If `etag` is provided and the server returns `304`, this helper returns `null`.
- `client.api.account.connections.patch(connectionId, body)` → `PATCH /account/connections/{connection_id}`
- `client.api.account.connections.delete(connectionId)` → `DELETE /account/connections/{connection_id}`
- `client.api.geos.list()` → `GET /geos`
- `client.api.request({ method, path, query?, body?, headers? })` → `{ status, etag, body }`
  - Low-level escape hatch; does not throw purely based on HTTP status, so callers can handle `304` directly.

Explicitly not implemented by design:

- `GET /connection`
- `PATCH /connection`

---

## Runtime flow: what happens step-by-step

### Startup sequence

Conceptually:

1. Validate input (`apiKey` required).
2. Fetch initial config from Aluvia API (control plane).
3. Start polling for config changes (control plane).
4. Depending on mode:
   - Gateway mode: return connection adapters pointing at the upstream gateway.
   - Client proxy mode: start local proxy (data plane) and return connection pointing to it.

### Shutdown sequence

When `connection.close()` or `connection.stop()` is called:

- In gateway mode: stops polling and destroys any cached Node proxy agent.
- In client proxy mode: stops the local proxy server, stops polling, destroys any cached Node proxy agent.

---

## Control plane: configuration management in detail (`ConfigManager`)

### Config snapshot shape

`ConfigManager` maintains `ConnectionNetworkConfig | null`:

- `rawProxy`: protocol/host/port/username/password
- `rules`: hostname routing rules
- `sessionId`, `targetGeo`: metadata
- `etag`: response ETag (for conditional polling)

### API endpoints used (current code)

All calls include:

- `Authorization: Bearer <apiKey>`
- `Accept: application/json`

Endpoints:

- `GET /account/connections/:id`
  - Optional `If-None-Match` header when polling.
  - Interprets `304` as “no change.”

- `POST /account/connections`
  - Creates a connection when `connection_id` not provided.

- `PATCH /account/connections/:id`
  - Updates connection fields (used for rules/session_id updates).

### How initial config is loaded (`init()`)

`init()` has two code paths:

- If `connection_id` was provided:
  - Fetches config via GET
  - Throws on 401/403 (invalid key) or non-200 statuses

- If `connection_id` was not provided:
  - Attempts to create a connection via POST and uses that response as config
  - Best-effort extracts the created connection id from response JSON

#### Failure behavior to understand

When POST create fails, `ConfigManager.init()` logs a warning and returns without throwing, leaving `this.config` as `null`. However, **gateway mode** (`smart_routing: false`) now **fails fast** in `AluviaClient.start()` if config is still missing, because gateway mode cannot provide usable proxy settings without credentials.

Impact:

- In gateway mode, adapter methods may return empty/placeholder values until config exists.
- In client proxy mode, the local proxy will route **direct** when config is absent.

Senior engineers should evaluate whether this “soft failure” is desired for smart-routing semantics, or whether `init()` should be strict (fail fast) on create failure.

### Polling mechanics

Polling:

- Uses `setInterval` at `pollIntervalMs` (default 5000ms).
- Includes an in-flight guard to prevent overlapping polls when a request takes longer than the interval.
- Uses conditional GET with ETag:
  - Sends `If-None-Match: <etag>` when available.
  - `304` means “keep current config.”
  - `200` means “replace config snapshot.”
- On network errors/unexpected statuses:
  - Logs a warning
  - Keeps last-known config

### Parsing API responses: `buildConfigFromAny(...)`

The SDK expects the account-connections response shape and requires explicit proxy credentials under:

- `body.data.proxy_username`
- `body.data.proxy_password`

If credentials are missing, it throws `ApiError`.

---

## Data plane: local proxy in detail (`ProxyServer`) — client proxy mode only

### Underlying proxy engine

The local proxy uses the `proxy-chain` library, which supports:

- Standard HTTP proxying
- HTTPS tunneling via CONNECT
- Selecting an upstream proxy per request via `prepareRequestFunction`

### Binding and security posture

The proxy binds **only to loopback**:

- host: `127.0.0.1`
- port: user-specified `localPort` or OS-assigned free port

This prevents accidental network exposure of a credentialed proxy port.

### Per-request routing decision

For each request, `proxy-chain` calls `prepareRequestFunction` and this implementation:

- Reads current config from `ConfigManager.getConfig()`
  - If missing, bypasses upstream proxy (direct).
- Extracts hostname:
  - Uses `params.hostname` if present (common for CONNECT)
  - Otherwise tries to parse `params.request.url` as a URL and take `.hostname`
- Runs `shouldProxy(hostname, rules)`
  - If false, route direct.
  - If true, route via upstream proxy URL embedding credentials:
    - `${protocol}://${username}:${password}@${host}:${port}`

This means routing is evaluated **on every request**, using the current in-memory config snapshot. Updates from polling take effect without restarting the proxy process.

---

## Routing rules engine (`rules.ts`)

Routing is **hostname-only**. No path/query/method/header logic exists.

### Patterns supported by `matchPattern`

- `*` matches any hostname
- `example.com` exact match
- `*.example.com` matches any subdomain depth (including `a.b.example.com`), but not `example.com` itself
- `google.*` matches `google.com`, `google.co.uk`, etc.

### `shouldProxy(hostname, rules)` semantics

- Empty rules → proxy nothing (`false`)
- The literal rule `AUTO` is filtered out (placeholder-only)
- Rules starting with `-` are negative excludes
  - If hostname matches any negative, the result is `false` regardless of positives
- If positives include `*`, proxy everything not excluded
- Otherwise, proxy only if hostname matches at least one positive pattern

This is simple and deterministic. It is not a DSL and does not implement precedence beyond “negative wins” and “catch-all * changes default behavior.”

---

## Adapter layer (`adapters.ts`): integrating with tools

This SDK intentionally exposes multiple integration “shapes” so consumers don’t have to remember each library’s proxy configuration format.

Implementation note: the adapter helpers in `src/adapters.ts` are **string-only formatters** (they accept a proxy server URL string). When credentials are required (remote gateway mode), `AluviaClient` constructs the credentialed URL or the `{ server, username, password }` object at the connection layer.

### Playwright

Returns a `proxy` object:

- In client proxy mode: `{ server: 'http://127.0.0.1:<port>' }`
- In gateway mode: `{ server: '<protocol>://gateway.aluvia.io:<port>', username, password }`

This is the cleanest integration because Playwright accepts proxy credentials explicitly.

### Puppeteer and Selenium

Returns only `--proxy-server=<server>` values (host/port) without embedding credentials.

Senior note: many Chromium-based workflows require additional auth handling for credentialed proxies; this SDK does not currently provide a dedicated “Puppeteer proxy auth” helper beyond the raw credentials available via config in gateway mode. In practice, Playwright is the “most supported” adapter here.

### Node HTTP clients (Axios/got/node-fetch style)

`asNodeAgent()` returns a cached `HttpsProxyAgent` instance.

This is suitable for HTTP client libraries that accept Node agents. (Node’s built-in `fetch()` uses undici and has different agent semantics; consumers may need alternative integration patterns depending on their stack.)

---

## Error model (`errors.ts`)

Typed errors exist primarily to separate “developer setup mistakes” from “runtime environment problems”:

- `MissingApiKeyError`
  - thrown when `new AluviaClient({ apiKey: ... })` is missing a key

- `InvalidApiKeyError`
  - thrown when Aluvia API responds with 401/403 during some config fetch paths

- `ApiError`
  - thrown for non-auth API failures or malformed responses

- `ProxyStartError`
  - thrown when the local proxy fails to bind/start

---

## Logging (`logger.ts`)

`Logger` is a minimal wrapper:

- `silent`: logs only `error(...)`
- `info`: logs `info/warn/error`
- `debug`: logs everything including debug

Logging is currently console-based; there is no structured logging, no metrics, and no health endpoints.

---

## Testing and local development

### Commands

- `npm ci`
  - installs deps and runs `prepare`, which runs the build

- `npm run build`
  - produces `dist/` outputs (ESM/CJS/types)

- `npm test`
  - runs Node’s built-in test runner using `tsx` to execute the TypeScript test file

### Current status: tests/docs aligned with code

The integration tests and documentation in this repo are intended to match the implementation:

- `AluviaClient` uses `apiKey` and the account-connections API.
- Documentation reflects the two-mode behavior (`smart_routing` on/off).

If you change public API shape or endpoint semantics in code, update tests and docs in the same PR.

---

## Historical note: earlier docs/spec

Earlier iterations of this project used a `token` option name and a different API model. The current implementation and docs use `apiKey` and the account-connections API (`/account/connections`).

---

## Security and operational considerations

- **Secrets**:
  - `apiKey` is a secret (treat like a password).
  - Proxy credentials (username/password) returned by the API are also sensitive.

- **Network exposure**:
  - Local proxy binds to `127.0.0.1` only (good default).

- **Transport security**:
  - Upstream gateway can be configured as `http` (default) or `https`.
  - If traffic between your agent machine and the gateway must be encrypted, set `gatewayProtocol: 'https'`.

- **Resilience**:
  - Polling errors are logged and last-known config is retained.
  - All control-plane HTTP calls enforce a request timeout (default 30000ms) via `AbortController`.
  - There is no automatic retry/backoff policy today; callers should implement retries at a higher level if desired.

- **Performance**:
- Client proxy mode adds local proxy overhead but only routes selected hostnames through Aluvia.
- Gateway mode has zero local proxy overhead and relies entirely on the consumer to apply the returned proxy settings.

---

## Extension points (where future work naturally fits)

The architecture is intentionally “thin,” which makes the likely roadmap items clear:

- Improve control-plane reliability: timeouts, retries/backoff, stricter init behavior.
- Add richer routing: path/method/header rules, presets beyond `AUTO`, prioritization.
- Improve Puppeteer/Selenium ergonomics around credentialed proxy auth.
- Align tests + docs with the current `apiKey` + `/account/connections` model.
- Observability: request counters (direct vs proxied), health/status endpoints, structured logs.

---

## Quick integration recipes (pragmatic)

### Playwright (recommended)

Use the connection adapter and pass it as the `proxy` launch option.

### Client proxy mode

Enable `smart_routing: true` so you get a stable local proxy URL and hostname-based selection.

### Gateway mode

Keep `smart_routing` false and use `asPlaywright()` / `asNodeAgent()` directly.

---

## Maintainer notes

If you are modifying this library:

- Keep the control plane and data plane separation intact; it’s the core simplifying abstraction.
- Be explicit about the public API: `apiKey`, `connection_id`, and `smart_routing` are the current contract in code.
- Update tests/docs together when changing option names or endpoint semantics; the repo currently contains drift that can mislead new maintainers.
- Update tests/docs together when changing option names or endpoint semantics so maintainers don’t get misled.

