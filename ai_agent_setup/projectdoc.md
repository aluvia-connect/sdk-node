# Aluvia SDK (`@aluvia/sdk`) — Technical Project Doc (refactored)

This repository implements **`@aluvia/sdk`**, a small Node.js SDK for automation workloads (“agents”) that need outbound HTTP(S) traffic to go either:

- **Direct to the destination**, or
- **Via the Aluvia gateway proxy** (host is currently **hardcoded** to `gateway.aluvia.io`)

The SDK supports two operating modes:

- **Client proxy mode (default)** (`local_proxy: true`): starts a local proxy on `127.0.0.1` and does **per-request hostname routing** (direct vs gateway).
- **Gateway mode** (`local_proxy: false`): does **not** start a local proxy; instead it returns **gateway proxy settings** for you to plug into Playwright / Node HTTP clients.

This doc focuses on **what the code actually does today**. If you change public behavior, update this doc and `test/integration.test.ts` in the same PR.

---

## Table of contents

- What this package is (and is not)
- Quick mental model
- Public API surface
- Modes: client proxy vs gateway
- Control plane: config management (`ConfigManager`)
- Data plane: local proxy (`ProxyServer`)
- Rules engine (`src/client/rules.ts`)
- Adapter layer (`src/client/adapters.ts`)
- API wrapper (`AluviaApi`)
- Error model (`errors.ts`)
- Security and operational notes
- Development and tests

---

## What this package is (and is not)

- **It is**: a library to embed in Node 18+ programs (Playwright, Puppeteer, Axios/got, agent frameworks).
- **It is not**: a CLI, a daemon, or a multi-tenant proxy service.
- **It is not**: a full routing engine; routing is **hostname-only**.
- **It does not**: implement retries/backoff for API calls (timeouts exist).

---

## Quick mental model

There are two planes:

- **Control plane** (`ConfigManager`): talks to the Aluvia HTTP API to fetch connection config (proxy creds + rules) and optionally PATCH updates.
- **Data plane** (`ProxyServer`): an optional local proxy (powered by `proxy-chain`) that decides per request whether to go direct or use an upstream proxy.

`AluviaClient` wires these together and exposes the public API.

---

## Public API surface

Public exports live in `src/index.ts`:

- `AluviaClient` (main entry point)
- `AluviaApi` (API wrapper; also available as `client.api`)
- Error classes: `MissingApiKeyError`, `InvalidApiKeyError`, `ApiError`, `ProxyStartError`
- Public types: `AluviaClientOptions`, `AluviaClientConnection`, `LogLevel`, `GatewayProtocol`, etc.

### `new AluviaClient(options)`

Key options (`src/client/types.ts`):

- **`apiKey`** (required): used as `Authorization: Bearer <apiKey>`.
  - Important: this SDK uses **account endpoints** (`/account/...`), so the token must be an **account API token** (see `api-v1.yaml` for token types).
- **`connection_id`** (optional): if provided, config is fetched via `GET /account/connections/:id`.
  - If omitted, the SDK attempts `POST /account/connections` to create one.
- **`local_proxy`** (optional, default `true`): mode toggle.
- **`strict`** (optional, default `true`): fail fast if the SDK cannot load/create an initial config (prevents “silent direct routing”).
- **`apiBaseUrl`** (optional, default `https://api.aluvia.io/v1`)
- **`pollIntervalMs`** (optional, default `5000`)
- **`timeoutMs`** (optional, default `30000`) — **applies to `client.api` only** (see gotchas).
- **`gatewayProtocol`** (optional, default `http`)
- **`gatewayPort`** (optional; defaults to `8080` for http, `8443` for https)
- **`localPort`** (optional): local proxy port; if omitted, OS assigns a free port.
- **`logLevel`** (optional, default `info`)

### `await client.start(): Promise<AluviaClientConnection>`

`start()` is idempotent: if already started, it returns the existing connection object.

Startup does:

- `ConfigManager.init()` (loads initial config)
- then:
  - **client proxy mode**: starts polling (`ConfigManager.startPolling()`), starts local proxy, and returns connection pointing at it
  - **gateway mode**: returns connection pointing at gateway settings (**no local proxy, no continuous polling**)

### `await connection.close()` / `await connection.stop()`

Both are aliases and:

- stop polling
- stop the local proxy (client proxy mode only)
- destroy the SDK’s cached Node proxy agents / undici dispatcher (if created via `asNodeAgents()` / `asUndiciDispatcher()`)

### `await client.stop()`

Stops polling and stops the local proxy if it may have been started.

Note: `client.stop()` does **not** have access to the connection’s cached proxy adapters (agents/dispatchers) because those caches live inside the connection object, so `connection.close()` is the best “full cleanup” API.

### `await client.updateRules(rules: string[])`

PATCHes the account connection via `ConfigManager.setConfig({ rules })`.

Important: this requires an account connection id. If the SDK created the connection but the create response did not include an id, this will throw `ApiError('No account connection ID available')`.

### `await client.updateSessionId(sessionId: string)`

PATCHes via `ConfigManager.setConfig({ session_id: sessionId })` with the same id requirement as `updateRules()`.

### `client.api` / `new AluviaApi(...)`

HTTP wrapper for Aluvia endpoints; does not require starting the proxy.

---

## Modes: client proxy vs gateway

### Client proxy mode (`local_proxy: true`)

- Starts a local proxy at `http://127.0.0.1:<port>`
- For each request, decides:
  - direct (no upstream proxy), or
  - upstream gateway proxy (credentialed)
- Your automation tooling is configured to use the **local proxy** (safe to share; no embedded credentials).

Connection fields:

- `connection.url`: `http://127.0.0.1:<port>`
- `connection.getUrl()`: same as `connection.url` (still safe; no creds)

### Gateway mode (`local_proxy: false`)

- No local proxy is started.
- The connection describes the upstream gateway settings.
- In this mode:
  - `connection.url` is the gateway server URL without embedded credentials
  - `connection.getUrl()` is credential-embedded and **contains secrets**

Connection fields:

- `connection.url`: `<protocol>://gateway.aluvia.io:<port>` (no creds)
- `connection.getUrl()`: `<protocol>://<username>:<password>@gateway.aluvia.io:<port>` (contains secrets)

Gateway-mode requirement:

- If config is missing after `init()`, `start()` throws `ApiError` (gateway mode cannot function without credentials).

---

## Control plane: config management (`ConfigManager`)

`ConfigManager` maintains an in-memory `ConnectionNetworkConfig`:

- `rawProxy`: protocol/host/port/username/password
- `rules`: routing rules array
- `sessionId`, `targetGeo`: metadata
- `etag`: response ETag (used for conditional polling)

### Endpoints used

All calls include `Authorization: Bearer <apiKey>` and `Accept: application/json`.

- `GET /account/connections/:id` (when `connection_id` is provided)
- `POST /account/connections` (when `connection_id` is omitted)
- `PATCH /account/connections/:id` (for `updateRules` / `updateSessionId`)

### How `init()` works

If `connection_id` is provided:

- GETs the config
- on 401/403: throws `InvalidApiKeyError`
- on non-200: throws `ApiError`
- on 200: parses config and stores it

If `connection_id` is omitted:

- POSTs to create a connection
- on 401/403: throws `InvalidApiKeyError`
- on 200/201: stores config and best-effort extracts `id` / `connection_id` for future polling/PATCH
- on any other status/error:
  - **strict (default)**: throws `ApiError` (fail fast)
  - **strict=false**: logs a warning and returns without config

### Polling behavior (ETag)

- Polling uses `setInterval` every `pollIntervalMs`.
- It never overlaps polls (an in-flight guard skips ticks).
- It uses `If-None-Match: <etag>` when available.
- `304` means “keep current config”.

Important behavior:

- Polling requires **both** `this.config` and `this.accountConnectionId`.
- If `init()` returned without config (only possible when `strict=false`), polling will log “No config available, skipping poll” and will not self-heal.
  - In client proxy mode with `strict=false`, you can still get a local proxy, but it will route **direct** forever until you restart with a valid config.

### Config parsing requirements

The SDK requires proxy credentials in:

- `data.proxy_username`
- `data.proxy_password`

If missing, it throws `ApiError` (control plane cannot build a usable config).

### Gateway host is fixed

Regardless of what the API returns, the upstream host is currently hardcoded to:

- `gateway.aluvia.io`

Only protocol and port are configurable via options.

---

## Data plane: local proxy (`ProxyServer`)

`ProxyServer` is used only in client proxy mode and is powered by `proxy-chain`.

Key properties:

- **Binds to loopback only**: `127.0.0.1` (safer than exposing a credentialed proxy)
- Local proxy URL is always `http://127.0.0.1:<port>`
- Supports HTTP proxying and HTTPS tunneling via CONNECT (handled by `proxy-chain`)

### Per-request decision flow

For each proxied request, `proxy-chain` calls `prepareRequestFunction`, which:

- reads current config via `ConfigManager.getConfig()`
  - if missing: routes direct
- extracts hostname:
  - prefers `params.hostname` (common for CONNECT)
  - otherwise tries `new URL(params.request.url).hostname`
  - if hostname cannot be extracted: routes direct
- evaluates `shouldProxy(hostname, rules)`
  - if false: routes direct
  - if true: routes via upstream proxy URL embedding credentials

Because config is read per request, routing updates apply without restarting the local proxy.

---

## Rules engine (`src/client/rules.ts`)

Routing is hostname-only. Supported patterns:

- `*` matches any hostname
- `example.com` exact match
- `*.example.com` matches any subdomain depth (but not `example.com` itself)
- `google.*` matches `google.com`, `google.co.uk`, etc.

Decision semantics (`shouldProxy(hostname, rules)`):

- Empty rules → proxy nothing
- Rule `AUTO` is ignored (placeholder)
- Rules prefixed with `-` are excludes and win over includes
- If positive rules include `*`, proxy everything not excluded
- Otherwise, proxy only if hostname matches at least one positive rule

---

## Adapter layer (`src/client/adapters.ts`)

The SDK provides formatters for common tooling shapes:

- `asPlaywright()` → `{ server, username?, password? }`
- `asPuppeteer()` → `['--proxy-server=<server>']` (no embedded creds)
- `asSelenium()` → `'--proxy-server=<server>'` (no embedded creds)
- `asNodeAgents()` → `{ http, https }` proxy agents (credentialed in gateway mode)
- `asAxiosConfig()` → `{ proxy: false, httpAgent, httpsAgent }`
- `asGotOptions()` → `{ agent: { http, https } }`
- `asUndiciDispatcher()` → `undici.Dispatcher` (proxy-aware dispatcher)
- `asUndiciFetch()` → `fetch` function powered by `undici` with per-request `dispatcher`

Important caveats:

- Chromium (Puppeteer/Selenium) often needs separate “proxy auth” handling when creds are required; this SDK only provides the server arg and does not implement browser-level auth flows.
- Node’s built-in `fetch()` does not accept Node `Agent` proxy configuration; use `asUndiciFetch()` / `asUndiciDispatcher()` for proxying fetch via `undici`.

---

## API wrapper (`AluviaApi`)

`AluviaApi` is a thin typed wrapper around `requestCore()` (`src/api/request.ts`). It is intended for calling Aluvia HTTP APIs without starting the local proxy.

### Request pipeline (`requestCore`)

For every API call, `requestCore()`:

- **Builds the URL** by joining `apiBaseUrl` + `path` and serializing `query` via `URLSearchParams`.
  - `null`/`undefined` query values are omitted.
  - arrays become repeated keys (e.g. `?k=a&k=b`).
- **Sets headers**:
  - `Authorization: Bearer <apiKey>`
  - `Accept: application/json`
  - `Content-Type: application/json` only when a non-null JSON body is provided.
  - `If-None-Match: <etag>` when provided (used by `account.connections.get()`).
- **Enforces a timeout** using `AbortController`.
  - Default is `30_000ms`.
  - In `AluviaApi`, `timeoutMs` is plumbed through and affects these calls.
  - On timeout, it throws `ApiError(..., 408)`.
- **Captures response ETag** via `response.headers.get('etag')`.
- **Parses JSON bodies only when** `Content-Type` includes `application/json`.
  - For non-JSON responses, or empty bodies, it returns `body: null`.
  - For `204` and `304`, it returns `body: null` (no parsing).

### How helpers unwrap and throw

High-level helpers live in `src/api/account.ts` and `src/api/geos.ts`. They call `requestCore()` and then:

- **Unwrap success**:
  - Accepts either `{ success: true, data: T }` or `{ data: T }`.
  - If the response is 2xx but missing `data`, throws `ApiError('API response missing expected success envelope data', status)`.
- **Throw on non-2xx**:
  - For `401`/`403`: throws `InvalidApiKeyError` with a message that explicitly calls out “account API token required”.
  - Otherwise, if the body matches `{ success: false, error: { code, message, details? } }`, throws `ApiError` including code/message and a truncated JSON string of details.
  - Otherwise, throws a generic `ApiError('API request failed (HTTP <status>)', status)`.

### `.get(..., { etag })` and `304`

`client.api.account.connections.get(id, { etag })` is the only helper that exposes conditional requests:

- It forwards the `etag` into `If-None-Match`.
- If the server returns `304`, the helper returns `null` (rather than throwing).
- If the server returns `200`, it returns the unwrapped `AccountConnection`.

### Low-level escape hatch: `client.api.request(...)`

`client.api.request({ method, path, ... })` is a direct passthrough to `requestCore()`:

- It **does not** automatically throw on non-2xx.
- It returns `{ status, etag, body }`, where `body` is either parsed JSON or `null`.
- Use this when you need to handle non-2xx statuses yourself (including `304`) or when you want raw access to `etag`.

### Surface summary

- `client.api.account.get()` → `GET /account`
- `client.api.account.usage.get({ start?, end? })` → `GET /account/usage`
- `client.api.account.payments.list({ start?, end? })` → `GET /account/payments`
- `client.api.account.connections.list()` → `GET /account/connections`
- `client.api.account.connections.create(body)` → `POST /account/connections`
- `client.api.account.connections.get(id, { etag? })` → `GET /account/connections/:id` (`null` on `304`)
- `client.api.account.connections.patch(id, body)` → `PATCH /account/connections/:id`
- `client.api.account.connections.delete(id)` → `DELETE /account/connections/:id`
- `client.api.geos.list()` → `GET /geos`

---

## Error model (`errors.ts`)

- `MissingApiKeyError`: `apiKey` missing/empty in `new AluviaClient(...)`
- `InvalidApiKeyError`: 401/403 from API helpers / config fetch paths
- `ApiError`: non-auth API failures, timeouts (`statusCode=408`), malformed responses
- `ProxyStartError`: local proxy fails to bind/listen

---

## Security and operational notes

- **Secrets**:
  - `apiKey` is a secret.
  - Proxy username/password returned by the API are secrets.
  - In gateway mode, `connection.getUrl()` contains secrets; do not log it or place it into process args/telemetry.
- **Network exposure**:
  - Local proxy binds to `127.0.0.1` only.
- **Timeouts**:
  - `requestCore()` enforces timeouts via `AbortController`.
  - `timeoutMs` currently affects **`client.api` only**; config/control-plane calls use `requestCore()` defaults.
- **Reliability**:
  - Polling failures keep last-known config.
  - With `strict=false`, if `init()` cannot create a connection (when `connection_id` is omitted), polling will not recover because there is no initial snapshot and no id.

---

## Development and tests

Commands:

- `npm ci` (runs `prepare`, which runs the build)
- `npm run build` (produces `dist/esm`, `dist/cjs`, and `dist/types`)
- `npm test` (runs `node --import tsx --test test/integration.test.ts`)

The test suite covers:

- `AluviaClient` mode behavior
- `requestCore` ETag + timeout behaviors
- `ConfigManager` polling sequences (200 → 304 → 200)
- `AluviaApi` envelope unwrapping and error behavior
- rules engine semantics


