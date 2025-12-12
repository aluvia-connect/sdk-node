## Aluvia Client (Node.js) — Architecture & “What It Can Do Today”

This document explains how the **Aluvia Client** works today (in this repository), what it currently supports, and where its limits are. It’s written for a founder or product leader who wants to make decisions about what to build next.

### Executive summary (one paragraph)

Aluvia Client is a **local HTTP proxy** you run alongside your automation/agent (Playwright, Puppeteer, Axios, fetch, etc.). Your tool talks to **one stable local proxy URL** (`http://127.0.0.1:<port>`). For every request, the client decides whether to send it **direct to the destination** or **through Aluvia’s gateway** based on **hostname routing rules** fetched from the Aluvia API (`GET /user`). While it’s running, it **polls for config changes** (using ETag) so you can change routing rules centrally and have running agents pick up those changes without restarts.

---

### What it can do today (capabilities)

- **Run a local proxy endpoint**: starts an HTTP proxy server bound to **loopback only** (`127.0.0.1`), on either a provided port or an auto-assigned free port.
- **Authenticate to Aluvia**: uses a **User API token** to fetch the user’s proxy credentials + routing rules from `GET /user`.
- **Selective routing (smart proxying)**: per request, routes traffic **direct** or **via Aluvia** based on **hostname-only** rules.
- **Live config updates without restarting the proxy**: polls `GET /user` every `pollIntervalMs` (default **5s**) and updates rules/credentials when the server changes.
- **Efficient polling**: uses **ETag / If-None-Match** so “no change” polls can return `304 Not Modified`.
- **Proxy URL adapters (developer ergonomics)**: the session returned from `start()` exposes helper methods that format proxy settings for common tooling (Playwright, Puppeteer, and Node HTTP clients) so developers don’t have to look up integration syntax.
- **Rule patterns and exclusions**:
  - Supports wildcard patterns like `*`, `*.example.com`, and `google.*`
  - Supports negative “exclude” rules like `-example.com`
  - Treats the literal rule `AUTO` as a placeholder and **ignores** it
- **Programmatic updates (write-back to Aluvia)**:
  - `client.updateRules(rules: string[])` sends a `PATCH /user` with `{ rules: [...] }`
  - `client.updateSessionId(sessionId: string)` sends a `PATCH /user` with `{ session_id: "..." }`
- **Simple operational controls**:
  - `logLevel`: `silent | info | debug`
  - `apiBaseUrl`, `pollIntervalMs`, `gatewayProtocol`, `gatewayPort`, `localPort`
- **Typed errors** to distinguish setup/config failures from proxy startup failures.

---

### What it does *not* do today (important limits)

These are not “bugs”; they are current product boundaries that matter for roadmap decisions.

- **No path-based / header-based routing**: routing decisions are based on **hostname only** (not URL path, not query params, not HTTP method, not headers).
- **No “AUTO rules” logic**: `AUTO` is explicitly ignored. There is no built-in “auto-discovery” list or adaptive routing.
- **No per-request override API**: the decision is purely based on hostname + current rules in memory.
- **No persistence**: the client stores config **only in memory**; restarting the process resets state.
- **No explicit timeouts / retries / backoff for API calls**: the control-plane `fetch()` calls do not set timeouts or retry logic (poll errors are logged and the last-known config is kept).
- **No metrics/telemetry**: only console logging (no counters, no traces, no health endpoint).
- **No first-class CLI**: it’s a library intended to be embedded in Node apps.
- **No support for multiple upstream gateways or multi-user multiplexing**: one client instance maps to one token/config (one “user/agent identity”).
- **No direct use of `session_id` / `target_geo` in routing decisions**: these are fetched and stored, but they do not influence which hosts are proxied; they are “targeting metadata” primarily for Aluvia’s backend.

---

### Glossary (plain English)

- **Local proxy**: a small server on your machine that other programs send their web traffic through.
- **Control plane**: configuration and syncing logic (fetching rules/credentials from Aluvia).
- **Data plane**: the proxy that actually forwards traffic.
- **User API token**: the secret your code uses to authenticate to Aluvia’s API.
- **Gateway**: Aluvia’s upstream proxy endpoint (`gateway.aluvia.io`) that forwards traffic onward using Aluvia’s network.
- **Routing rules**: a list of patterns used to decide which hostnames go through Aluvia.
- **ETag**: a server-provided “version hash” of config; lets the client ask “did anything change?” efficiently.

---

### System view (how traffic flows)

Think of this as “one local proxy in front of everything,” with a decision point per hostname:

```text
Your app / agent / browser
        |
        |  (configured to use)
        v
  Local Aluvia Client proxy  (http://127.0.0.1:<port>)
        |
        |  per request: decide direct vs Aluvia
        |
  +-----+----------------------------+
  |                                  |
  v                                  v
Direct to destination            Aluvia Gateway (gateway.aluvia.io)
  (no proxy)                        |
                                    v
                              Destination website/API
```

Key implication: your app only needs to know **one** proxy URL (the local one). All the “which sites should be proxied?” logic is centralized and changeable without redeploying the app.

---

### The architecture inside this repository

At a code level, the design is intentionally small and modular:

```text
src/
  index.ts            Public exports (AluviaClient, error classes, public types)
  AluviaClient.ts     Public API + lifecycle orchestration
  adapters.ts         Proxy URL adapter helpers (Playwright/Puppeteer/Node agent)
  ConfigManager.ts    Control plane: GET/PATCH /user + ETag polling + in-memory config
  ProxyServer.ts      Data plane: local proxy via proxy-chain + per-request routing decision
  rules.ts            Hostname matching + shouldProxy() decision logic
  httpClient.ts       Thin wrapper around fetch() for GET/PATCH /user
  errors.ts           Typed errors
  logger.ts           Console logger with log levels
  types.ts            Public TypeScript types
```

There are two “planes”:

- **Control plane (`ConfigManager`)**: keeps an up-to-date snapshot of user config from Aluvia.
- **Data plane (`ProxyServer`)**: uses that snapshot on every request to choose direct vs gateway.

---

### Control plane: configuration and syncing (ConfigManager)

The client needs three things from Aluvia before it can proxy via the gateway:

- **Proxy credentials** (`proxy_username`, `proxy_password`)
- **Routing rules** (hostname patterns)
- **Targeting metadata** (`session_id`, `target_geo`) — stored but not used for routing decisions

#### Initial configuration load (startup)

When you call `client.start()`:

- It calls the Aluvia API:
  - **GET** `/<apiBaseUrl>/user` (default `https://api.aluvia.io/v1/user`)
  - Header: `Authorization: Bearer <token>`
- If the API returns **401/403**, the client throws `InvalidUserTokenError` and does not start the proxy.
- If the API returns **200**, it stores the configuration in memory:
  - Builds an upstream gateway config that always targets:
    - **Host**: `gateway.aluvia.io`
    - **Protocol/port**: from client options (`gatewayProtocol` + `gatewayPort`)
    - **Username/password**: from the API response

#### Live updates (polling with ETag)

After startup succeeds, the client polls for changes:

- Interval: `pollIntervalMs` (default **5000ms**)
- It uses ETag:
  - Server returns `ETag: "..."` on a `200` response
  - Client sends `If-None-Match: "<etag>"` on subsequent polls
- Outcomes:
  - **304 Not Modified**: keep current in-memory config
  - **200 OK**: replace in-memory config (new rules and/or new credentials)
  - **Network errors / unexpected status**: log a warning and keep the last-known config

Practical meaning for product:

- If a founder/operator changes rules in Aluvia, running agents typically pick up the change within ~5 seconds (or whatever interval is configured).
- If Aluvia API is temporarily unavailable, the proxy can still operate using the **last-known-good** config.

#### Programmatic updates (PATCH /user)

The public `AluviaClient` exposes two “write-back” helpers:

- `updateRules(rules: string[])` → `PATCH /user` with `{ rules: [...] }`
- `updateSessionId(sessionId: string)` → `PATCH /user` with `{ session_id: "..." }`

This enables product patterns like:

- An agent run setting its own session identifier (for grouping/targeting on the backend).
- Dynamic rule changes driven by an app (though note: this affects the server-side config, not just local behavior).

---

### Data plane: the local proxy (ProxyServer)

The local proxy is implemented with the `proxy-chain` library, which handles:

- Standard HTTP proxy behavior
- HTTPS tunneling via CONNECT
- Passing traffic through an upstream proxy when you provide an `upstreamProxyUrl`

#### What the proxy listens on

- Host: **`127.0.0.1`** only (not accessible from other machines)
- Port:
  - If you provide `localPort`, it tries to bind to that port
  - Otherwise, it binds to `0` and the OS picks a free port
- It returns:
  - `session.url = http://127.0.0.1:<port>`

Important: the proxy URL you pass to tools is always an `http://` URL because it’s describing a local HTTP proxy endpoint; the proxy can still tunnel HTTPS traffic (CONNECT) for destination sites.

#### How a single request is routed (decision logic)

For each proxied request, the proxy:

- Gets the current config snapshot from `ConfigManager`
- Extracts the hostname
  - For HTTPS CONNECT requests, the hostname is provided by the proxy library
  - For HTTP requests, it attempts to parse the request URL
- Runs the hostname through the rule engine (`shouldProxy(hostname, rules)`)
- If **not** proxied:
  - It returns “no upstream proxy” → traffic goes **direct**
- If proxied:
  - It builds an upstream proxy URL to the Aluvia gateway:
    - `protocol://username:password@gateway.aluvia.io:port`
  - `proxy-chain` forwards the connection via the gateway

Safety fallback:

- If no config is available (unexpected in normal `start()` usage), the proxy defaults to **direct** rather than breaking traffic.

---

### Routing rules: what patterns mean (rules.ts)

Rules are matched against **hostnames only** (case-insensitive). A rule list is a list of strings. There are two kinds:

- **Positive rules**: include hosts to proxy (e.g. `example.com`, `*.example.com`, `*`)
- **Negative rules**: exclude hosts from proxying (prefixed with `-`, e.g. `-example.com`)

#### Supported patterns

- **`*`**: match any hostname
- **`example.com`**: exact match
- **`*.example.com`**: match subdomains (e.g., `foo.example.com`, `a.b.example.com`), but not `example.com` itself
- **`google.*`**: match TLD variants (e.g., `google.com`, `google.co.uk`)

#### Precedence and semantics (how `shouldProxy()` works)

- If the rule list is empty: **proxy nothing**
- `AUTO` is ignored (placeholder only)
- Negative rules win:
  - If a hostname matches any negative pattern, it is **direct** even if other rules would proxy it
- If a positive catch-all `*` exists:
  - Default is “proxy everything” except excluded hosts
- If there is no `*`:
  - Only proxy hosts that match at least one positive pattern

Concrete examples:

- `['*']` → proxy everything
- `['*', '-example.com']` → proxy everything *except* `example.com`
- `['example.com']` → proxy only `example.com` (everything else direct)
- `['AUTO', 'example.com']` → effectively same as `['example.com']` today

---

### Public API surface (what a developer integrates with)

The public API is intentionally small:

- `new AluviaClient({ token, ...options })`
- `await client.start()` → returns `{ host, port, url, stop(), close(), ...adapters }`
- `await client.stop()`
- `await client.updateRules([...])` (optional)
- `await client.updateSessionId("...")` (optional)

The session returned from `start()` includes helper adapters:

- `session.getUrl()` → `'http://127.0.0.1:<port>'`
- `session.asPlaywright()` → `{ server: session.url }`
- `session.asPuppeteer()` → `['--proxy-server=' + session.url]`
- `session.asNodeAgent()` → Node `Agent` for Axios / got / node-fetch
- `await session.close()` → alias for `await session.stop()`

From a product perspective, this means:

- Integration is “set proxy once, then operate by changing rules”
- The proxy lifetime is tied to the lifecycle of the running agent process

---

### Error handling (what can fail, and how)

The library uses typed error classes:

- **`MissingUserTokenError`**: developer didn’t pass a token to the constructor
- **`InvalidUserTokenError`**: `GET /user` returned 401/403 during startup
- **`ApiError`**: `GET /user` returned a non-200 status during startup
- **`ProxyStartError`**: local proxy failed to bind/start (e.g., port in use)

Important operational behavior:

- Startup is strict: if it can’t fetch initial config, it fails fast (no proxy started).
- Polling is resilient: if a poll fails later, it keeps using the last config.

---

### Security model (today)

- **Loopback binding**: proxy binds to `127.0.0.1`, limiting access to processes on the same machine.
- **Secrets**:
  - The **User API token** must be treated like a password (environment variable / secret manager).
  - Proxy credentials from `/user` are also sensitive (they are effectively gateway credentials).
- **Gateway transport**:
  - Client supports `gatewayProtocol: 'http' | 'https'`.
  - Default today is `'http'` on port `8080`; if you want TLS between the client and the gateway, configure `'https'` (port `8443` by default).

---

### Operational characteristics (what happens in production-like usage)

- **Resource usage**: lightweight; one local server + one polling timer.
- **Latency**:
  - Direct traffic stays direct (lowest overhead).
  - Proxied traffic adds an extra hop (local proxy + gateway), but only for the domains you choose.
- **Change propagation**: rule changes propagate on poll boundaries (default within ~5 seconds).
- **Failure modes**:
  - If the API is down after startup, proxy continues using cached config.
  - If proxy credentials rotate on the backend and the client can’t poll, proxied requests may start failing until config refresh resumes.

---

### “Where should we invest next?” (high-leverage roadmap ideas)

Based on the current architecture, the most meaningful product/engineering expansions would be:

- **Richer routing rules**: path/method/header-based routing, percent rollouts, allowlists/denylists with priorities.
- **Better control plane reliability**: request timeouts, retries with backoff, and clearer handling of 401/403 during polling.
- **Faster updates**: replace polling with push (webhooks/WebSocket) or adaptive polling intervals.
- **Observability**: request counters (proxied vs direct), rule match logs, health endpoint, and structured logs.
- **Multi-profile / multi-session support**: multiple concurrent proxy identities, or easy switching between tokens/configs.
- **Security hardening defaults**: default `gatewayProtocol` to `https` if supported and add explicit guidance around token storage and least privilege.


