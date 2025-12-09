Here is a granular, LLM-friendly implementation plan you can hand off as tickets.

Each task is:

* Very small and self-contained
* Has a clear start and end
* Focused on one concern

All tasks are derived from the current spec in **“Aluvia Client (Node.js)”**. 

---

# Implementation Plan: Aluvia Client (Node.js)

## Phase 0 – Repo + Project Scaffolding

### Task 0.1 – Initialize Node/TypeScript project

**Goal**: Create the basic project scaffold for `@aluvia/aluvia-node`.

**Steps**:

* Initialize npm package:

  * `npm init -y`
* Add dev dependencies:

  * `typescript`, `@types/node`, `ts-node` (or equivalent)
* Create `tsconfig.json` with:

  * `"rootDir": "src"`
  * `"outDir": "dist"`
  * Target modern Node (ES2020 or similar)
* Create folder structure:

  * `src/`
  * `src/index.ts`

**Acceptance criteria**:

* `npm run build` (using `tsc`) compiles without errors.
* `dist/` is generated and contains compiled JS.

---

### Task 0.2 – Define package metadata

**Goal**: Set up `package.json` for distribution as an npm package.

**Steps**:

* Set `"name"` to something like `"@aluvia/aluvia-node"`.
* Set `"main"` to `"dist/index.js"` and `"types"` to `"dist/index.d.ts"`.
* Add scripts:

  * `"build": "tsc"`
  * `"prepare": "npm run build"` (for pre-publish builds)
* Set `"engines"` to require Node 18+ (if using native `fetch`), or note polyfill plan.

**Acceptance criteria**:

* `npm pack` produces a tarball with `dist/` included (after build).
* No missing-field warnings from npm.

---

## Phase 1 – Core Types and Public API Surface

### Task 1.1 – Define public types and options

**Goal**: Implement the TypeScript public types in `src/types.ts` (or inline in `AluviaClient.ts`).

**Steps**:

* Implement:

  ```ts
  export type GatewayProtocol = 'http' | 'https';

  export type AluviaClientOptions = {
    token: string;
    apiBaseUrl?: string;
    pollIntervalMs?: number;
    gatewayProtocol?: GatewayProtocol;
    gatewayPort?: number;
    localPort?: number;
    logLevel?: 'silent' | 'info' | 'debug';
  };

  export type AluviaClientSession = {
    host: string;
    port: number;
    url: string;
    stop(): Promise<void>;
  };
  ```

**Acceptance criteria**:

* Type declarations compile.
* Types match the current spec (fields and defaults described in the doc).

---

### Task 1.2 – Implement `index.ts` export surface

**Goal**: Make `AluviaClient` the main export.

**Steps**:

* Create `src/index.ts`:

  * Export `AluviaClient`.
  * Export public types (`AluviaClientOptions`, `AluviaClientSession`, `GatewayProtocol`).

**Acceptance criteria**:

* `import { AluviaClient } from '@aluvia/aluvia-node'` resolves when built.
* Types are visible when importing from the package entry.

---

## Phase 2 – Error and Logging Infrastructure

### Task 2.1 – Implement error classes

**Goal**: Define custom error types in `src/errors.ts`.

**Steps**:

* Implement:

  ```ts
  export class MissingUserTokenError extends Error {}
  export class InvalidUserTokenError extends Error {}
  export class ApiError extends Error {
    constructor(message: string, public statusCode?: number) {
      super(message);
    }
  }
  export class ProxyStartError extends Error {}
  ```

**Acceptance criteria**:

* Errors are exported and can be imported in other modules.
* No circular dependency issues.

---

### Task 2.2 – Implement logging helper

**Goal**: Create a simple log abstraction that respects `logLevel`.

**Steps**:

* Create `src/logger.ts` with something like:

  ```ts
  export type LogLevel = 'silent' | 'info' | 'debug';

  export class Logger {
    constructor(private level: LogLevel) {}

    info(...args: unknown[]) {
      if (this.level === 'info' || this.level === 'debug') {
        console.log('[aluvia][info]', ...args);
      }
    }

    debug(...args: unknown[]) {
      if (this.level === 'debug') {
        console.debug('[aluvia][debug]', ...args);
      }
    }

    warn(...args: unknown[]) {
      if (this.level !== 'silent') {
        console.warn('[aluvia][warn]', ...args);
      }
    }

    error(...args: unknown[]) {
      console.error('[aluvia][error]', ...args);
    }
  }
  ```

**Acceptance criteria**:

* Logger can be instantiated with each level and behaves as expected:

  * `silent`: only `error` logs.
  * `info`: `info`, `warn`, `error`.
  * `debug`: all methods log.

---

## Phase 3 – HTTP Client Wrapper

### Task 3.1 – Implement HTTP client for `/user`

**Goal**: Implement a small HTTP client wrapper that calls `GET /user` with token and optional `If-None-Match`.

**Steps**:

* Create `src/httpClient.ts`.
* Decide: use native `fetch` (Node 18+) or `node-fetch`:

  * If using native `fetch`, no extra dep.
* Implement:

  ```ts
  export type UserApiResponse = {
    // minimal subset: proxy_username, proxy_password, rules, session_id, target_geo
    proxy_username: string;
    proxy_password: string;
    rules: string[];
    session_id: string | null;
    target_geo: string | null;
  };

  export async function getUser(
    apiBaseUrl: string,
    token: string,
    etag?: string
  ): Promise<{ status: number; etag: string | null; body: UserApiResponse | null }> {
    // Build URL: `${apiBaseUrl.replace(/\/$/, '')}/user`
    // Send headers:
    //   Authorization: Bearer <token>
    //   Accept: application/json
    //   If-None-Match: etag (if provided)
    // Parse response status, headers, JSON (if 200)
  }
  ```

**Acceptance criteria**:

* For a mocked fetch:

  * `200` → returns `{ status: 200, etag: '<etag>', body: {...} }`.
  * `304` → returns `{ status: 304, etag: '<etag-or-null>', body: null }`.
  * `401/403` → can be handled by caller; just returns status and no body.

---

## Phase 4 – Config Manager (Control Plane)

### Task 4.1 – Define `RawProxyConfig` and `UserNetworkConfig` types

**Goal**: Create config types for the control-plane state.

**Steps**:

* In `src/ConfigManager.ts` or separate types file:

  ```ts
  import type { GatewayProtocol } from './types'; // or from public types

  export type RawProxyConfig = {
    protocol: GatewayProtocol;
    host: 'gateway.aluvia.io';
    port: number;
    username: string;
    password: string;
  };

  export type UserNetworkConfig = {
    rawProxy: RawProxyConfig;
    rules: string[];
    sessionId: string | null;
    targetGeo: string | null;
    etag: string | null;
  };
  ```

**Acceptance criteria**:

* Types compile and can be imported by `ProxyServer` and `AluviaClient`.

---

### Task 4.2 – Implement `ConfigManager` constructor and state

**Goal**: Create the `ConfigManager` class skeleton with internal state.

**Steps**:

* In `src/ConfigManager.ts`:

  ```ts
  import { Logger } from './logger';
  import type { GatewayProtocol } from './types';
  import type { UserNetworkConfig } from './ConfigManager.types'; // or same file

  export class ConfigManager {
    private config: UserNetworkConfig | null = null;
    private timer: NodeJS.Timeout | null = null;
    private logger: Logger;

    constructor(private readonly options: {
      token: string;
      apiBaseUrl: string;
      pollIntervalMs: number;
      gatewayProtocol: GatewayProtocol;
      gatewayPort: number;
      logLevel: 'silent' | 'info' | 'debug';
    }) {
      this.logger = new Logger(options.logLevel);
    }

    // methods to implement later:
    init(): Promise<void> { /* stub */ }
    startPolling(): void { /* stub */ }
    stopPolling(): void { /* stub */ }
    getConfig(): UserNetworkConfig | null { /* stub */ }
  }
  ```

**Acceptance criteria**:

* Class compiles.
* No runtime behavior yet; methods can be placeholders.

---

### Task 4.3 – Implement `ConfigManager.init()`

**Goal**: Fetch initial `/user` config and populate `this.config`.

**Steps**:

* Use `getUser(apiBaseUrl, token)` from `httpClient`.
* Handle statuses:

  * `401/403` → throw `InvalidUserTokenError`.
  * `200` → map JSON to `UserNetworkConfig`.
  * Other 4xx/5xx → throw `ApiError`.
* Build `rawProxy` using:

  * `gatewayProtocol` from options.
  * `gatewayPort` from options.
  * `host = 'gateway.aluvia.io'`.
  * `username = proxy_username` from response.
  * `password = proxy_password` from response.
* Store `etag` from response headers.

**Acceptance criteria**:

* On valid mocked response, `init()` sets `this.config` and resolves.
* On 401/403, `init()` rejects with `InvalidUserTokenError`.
* On network/5xx simulation, `init()` rejects with `ApiError`.

---

### Task 4.4 – Implement `ConfigManager.getConfig()`

**Goal**: Provide read access to current config.

**Steps**:

* Simple method:

  ```ts
  getConfig(): UserNetworkConfig | null {
    return this.config;
  }
  ```

**Acceptance criteria**:

* Returns `null` before `init()` and a non-null config after a successful init (in tests).

---

### Task 4.5 – Implement `ConfigManager.startPolling()` and `stopPolling()`

**Goal**: Maintain configuration freshness using polling + ETag.

**Steps**:

* `startPolling()`:

  * Do nothing if a timer already exists.
  * Use `setInterval` with `pollIntervalMs`.
  * In each tick:

    * Get current `config` and `etag`.
    * Call `getUser(apiBaseUrl, token, etag)`.
    * Behaviors:

      * `304` → log debug, do nothing.
      * `200` → rebuild `UserNetworkConfig` and replace `this.config`.
      * `5xx/network` → log warn, keep old config.
* `stopPolling()`:

  * Clear the timer if present, set to `null`.

**Acceptance criteria**:

* With a mocked HTTP client:

  * After multiple ticks, config updates when a new `ETag` and body are returned.
  * `stopPolling()` stops further HTTP calls.

---

## Phase 5 – Rule Engine (`shouldProxy`)

### Task 5.1 – Implement wildcard rule matcher

**Goal**: Support hostname rules like `"*"`, `"*.example.com"`, `"google.*"`, `"-example.com"`.

**Steps**:

* Create `src/rules.ts`.

* Implement:

  ```ts
  export function matchPattern(hostname: string, pattern: string): boolean {
    // handle:
    // '*' -> always true
    // '*.example.com' -> subdomain match
    // 'example.com' -> exact
    // 'google.*' -> 'google.com', 'google.co.uk', etc.
  }
  ```

* Implement helper for negative rules:

  * Patterns starting with `"-"` mean “do not proxy this”.

**Acceptance criteria**:

* Unit tests for `matchPattern`:

  * `matchPattern('foo.google.com', '*.google.com') === true`
  * `matchPattern('google.com', 'google.*') === true`
  * `matchPattern('example.com', '*') === true`
  * `matchPattern('foo.com', 'example.com') === false`

---

### Task 5.2 – Implement `shouldProxy()` function

**Goal**: Implement final decision logic for “proxy vs direct” based on rules array.

**Steps**:

* In `src/rules.ts`:

  ```ts
  export function shouldProxy(hostname: string, rules: string[]): boolean {
    if (!rules.length) return false;

    // track if a catch-all '*' exists
    // handle negative rules '-example.com'
    // implement precedence:
    //   - If rules include '*', default is proxy unless excluded by a negative match.
    //   - If no '*', proxy if hostname matches any non-negative pattern.
  }
  ```

**Acceptance criteria**:

* Unit tests:

  * `rules = []` → always false.
  * `rules = ['*']` → always true.
  * `rules = ['example.com']` → only `example.com` proxied.
  * `rules = ['*', '-example.com']` → all except `example.com`.
  * `rules = ['AUTO', 'example.com']` → for now treat `'AUTO'` as a no-op or placeholder (document behavior).

---

## Phase 6 – Proxy Server Implementation

### Task 6.1 – Add and configure `proxy-chain` dependency

**Goal**: Bring in a proxy library to handle HTTP/HTTPS proxying.

**Steps**:

* Install `proxy-chain`:

  * `npm install proxy-chain`
* Add types if needed (ship your own or minimal declarations).

**Acceptance criteria**:

* `import { Server } from 'proxy-chain';` compiles.

---

### Task 6.2 – Implement `ProxyServer` skeleton

**Goal**: Create `ProxyServer` class with `start` and `stop` methods (no routing yet).

**Steps**:

* In `src/ProxyServer.ts`:

  ```ts
  import { Server as ProxyChainServer } from 'proxy-chain';
  import { ConfigManager } from './ConfigManager';
  import { Logger } from './logger';

  export class ProxyServer {
    private server: ProxyChainServer | null = null;
    private logger: Logger;

    constructor(
      private readonly configManager: ConfigManager,
      options?: { logLevel?: 'silent' | 'info' | 'debug' }
    ) {
      this.logger = new Logger(options?.logLevel ?? 'info');
    }

    async start(port?: number): Promise<{ host: string; port: number; url: string }> {
      // stub
    }

    async stop(): Promise<void> {
      // stub
    }
  }
  ```

**Acceptance criteria**:

* Compiles successfully.
* No runtime behavior yet.

---

### Task 6.3 – Implement `ProxyServer.start()`

**Goal**: Start the local HTTP proxy on `127.0.0.1:<port>`.

**Steps**:

* Default `listenPort`:

  * If provided `port` → use it.
  * Else → use `0` (OS assigns a free port).
* Create a new `ProxyChainServer` with:

  * `port: listenPort`
  * `prepareRequestFunction: (...) => routing decision` (stub for now).
* When server is listening, get the actual port:

  * `server.server.address()` → cast to `AddressInfo`.
* Return `{ host: '127.0.0.1', port: actualPort, url: 'http://127.0.0.1:<port>' }`.

**Acceptance criteria**:

* In an integration test, `start()` returns a usable port.
* You can connect to `127.0.0.1:<port>` and see that the TCP socket is open (even if no routing yet).

---

### Task 6.4 – Implement `ProxyServer.stop()`

**Goal**: Cleanly stop the local proxy server.

**Steps**:

* If `this.server` is null, do nothing.
* Call `await this.server.close();`.
* Set `this.server = null`.

**Acceptance criteria**:

* After `stop()`, port is no longer listening.
* Calling `stop()` twice is safe (no exceptions).

---

### Task 6.5 – Integrate `ConfigManager` and `shouldProxy` into `prepareRequestFunction`

**Goal**: Decide per-request whether to go through Aluvia or direct.

**Steps**:

* In `start()`, implement `prepareRequestFunction`:

  ```ts
  prepareRequestFunction: async (params) => {
    const cfg = this.configManager.getConfig();
    if (!cfg) {
      this.logger.warn('No config available, bypassing proxy');
      return null; // direct
    }

    const hostname = params.hostname || extractHostnameFromParams(params);
    if (!hostname) {
      return null; // direct by default
    }

    const useProxy = shouldProxy(hostname, cfg.rules);

    if (!useProxy) {
      return null; // direct
    }

    const { host, port, username, password, protocol } = cfg.rawProxy;
    const upstreamProxyUrl =
      `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;

    return {
      upstreamProxyUrl,
    };
  }
  ```

* Implement a small `extractHostnameFromParams` helper if needed.

**Acceptance criteria**:

* When `rules = ['*']`, requests go via upstream proxy.
* When `rules = []`, requests go direct.
* No crashes when `cfg` is null; log a warning and go direct.

---

## Phase 7 – AluviaClient Orchestration

### Task 7.1 – Implement `AluviaClient` constructor

**Goal**: Wire options, defaults, and instantiate `ConfigManager` and `ProxyServer`.

**Steps**:

* In `src/AluviaClient.ts`:

  * Validate `options.token`:

    * If missing, throw `MissingUserTokenError`.
  * Compute defaults:

    * `apiBaseUrl` default: `'https://api.aluvia.io/v1'`.
    * `pollIntervalMs` default: `5000`.
    * `gatewayProtocol` default: `'http'`.
    * `gatewayPort` default: `8080` if `'http'`, `8443` if `'https'`.
    * `logLevel` default: `'info'`.
  * Instantiate `ConfigManager` and `ProxyServer`.

**Acceptance criteria**:

* Creating a new `AluviaClient({ token: '...' })` succeeds.
* Creating one without token throws `MissingUserTokenError`.

---

### Task 7.2 – Implement `AluviaClient.start()`

**Goal**: Start config, proxy server, polling, and return a session.

**Steps**:

* If already `started` and `session` exists, return existing session.

* Call `await configManager.init();` (may throw).

* Call `await proxyServer.start(options.localPort);`.

* Call `configManager.startPolling();`.

* Build `AluviaClientSession`:

  ```ts
  const session: AluviaClientSession = {
    host,
    port,
    url,
    stop: async () => {
      await this.proxyServer.stop();
      this.configManager.stopPolling();
      this.session = null;
      this.started = false;
    },
  };
  ```

* Save `this.session` and `this.started = true`.

**Acceptance criteria**:

* On valid config, `start()` resolves with a session.
* On invalid token, `start()` rejects with `InvalidUserTokenError`.
* After `start()`, the proxy is listening, and polling is active.

---

### Task 7.3 – Implement `AluviaClient.stop()`

**Goal**: Provide global cleanup.

**Steps**:

* If `!this.started`, return immediately.
* Call `proxyServer.stop()` and `configManager.stopPolling()`.
* Clear `this.session` and `this.started`.

**Acceptance criteria**:

* After `stop()`, port is closed and no further polling happens.
* Calling `stop()` twice is safe.

---

## Phase 8 – Basic Tests / Example Usage

### Task 8.1 – Add minimal integration smoke test

**Goal**: Validate happy-path wiring end-to-end with a mocked HTTP API and using a real proxy server.

**Steps**:

* Use a test runner (e.g. `jest`, `vitest`, or `node:test`).
* Mock `getUser()` to return a fixed config:

  * `proxy_username`, `proxy_password`, `rules: ['*']`, etc.
* Create `AluviaClient` with this mocked `ConfigManager`/`httpClient`.
* Call `start()`.
* Verify:

  * Session contains `host`, `port`, `url`.
  * `getUser` was called at least once.
* Optionally, perform a simple HTTP request through the local proxy to some test server (mocked upstream).

**Acceptance criteria**:

* Test passes reliably.
* No unhandled promise rejections.

---

### Task 8.2 – Document usage in README

**Goal**: Provide a simple developer-facing example.

**Steps**:

* Add `README.md` snippet showing:

  * Installation.
  * Simple usage with `AluviaClient`.
  * Example with Playwright and Axios (using `session.url`).

**Acceptance criteria**:

* README example matches the implemented public API.
* Example code compiles if copied into a simple project.

---

If you would like, I can now convert this plan into a JSON/YAML “task spec” format (e.g., each task as an object with `id`, `description`, `files`, `acceptanceCriteria`) directly optimized for your engineering LLM’s input format.
