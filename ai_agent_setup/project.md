



# Aluvia Agent Connect Client (Node.js)

_Local smart proxy for AI agents_

## 1. Purpose and role in the system

**Mission**

Give an AI agent (running on Node / Playwright / Puppeteer / HTTP clients) a **local proxy endpoint** that:

- Authenticates to Aluvia with a **User API token**.
    
- Fetches the user’s **proxy credentials, rules, geo, session ID** from the Aluvia API (`GET /user`).
    
- Applies hostname rules to decide which domains go through Aluvia vs direct.
    
- Keeps itself up to date by polling `/user` periodically using ETag.
    
- Applies changes (rules, targeting, session) **without requiring the agent to restart Playwright or the browser**.
    

This library is:

- A **Node.js package** (e.g. `@aluvia/agent-connect-node`).
    
- It runs entirely in Node (no Go binary, no cross-compilation).
    
- Internally, it runs a local HTTP(S) proxy server bound to `127.0.0.1:<port>`.
    


The **Agent Connect Client** itself focuses on:

- Connectivity (local proxy server).
    
- Control plane integration (`/user` polling, rule/geo/session sync).
    

---

## 2. Developer-facing API

### 2.1 Installation

```bash
npm install @aluvia/agent-connect-node
# or
yarn add @aluvia/agent-connect-node
# or
pnpm add @aluvia/agent-connect-node
```

### 2.2 Runtime usage


Basic example:

- Developer provides:
    
    - A **User API token** (required).
        
    - Optional **local proxy port** (e.g. `54321`) where the client will listen on `127.0.0.1:<localPort>`.
        
    - Optional **gateway protocol** (`http` or `https`).
        
        - If `gatewayProtocol === 'http'` → upstream gateway port defaults to `8080`.
            
        - If `gatewayProtocol === 'https'` → upstream gateway port defaults to `8443`.
            
        - `gatewayPort` can be overridden explicitly if needed.
            

```ts
import { AgentConnectClient } from '@aluvia/agent-connect-node';

const client = new AgentConnectClient({
  token: process.env.ALV_USER_TOKEN,   // required: user API token

  // OPTIONAL: where the local proxy listens (127.0.0.1:<localPort>)
  // If omitted, the client will pick a free port automatically.
  localPort: 54321,

  // OPTIONAL: how the client talks to the Aluvia gateway
  // If omitted, defaults to 'http'.
  gatewayProtocol: 'http',             // 'http' | 'https'

  // OPTIONAL: override upstream gateway port
  // If omitted:
  //   - 8080 is used when gatewayProtocol === 'http'
  //   - 8443 is used when gatewayProtocol === 'https'
  // gatewayPort: 8080,
});

const session = await client.start();

// session.host -> '127.0.0.1'
// session.port -> 54321        // or the auto-assigned port if localPort omitted
// session.url  -> 'http://127.0.0.1:54321'

// Developer wires session.url into Playwright, Puppeteer, Axios, etc.

// Example with Playwright:
const browser = await chromium.launch({
  proxy: { server: session.url },
});

// Example with Axios:
const axiosClient = axios.create({
  proxy: false, // disable Axios' own proxy handling
  httpsAgent: new HttpsProxyAgent(session.url),
});

// When done:
await session.stop();
await client.stop(); // optional global cleanup
```

### 2.3 Public types



```ts
export type GatewayProtocol = 'http' | 'https';

export type AgentConnectClientOptions = {
  /**
   * Required: user API token (Bearer).
   * This is the token for a single Aluvia user/agent.
   */
  token: string;

  /**
   * Optional: base URL for the Aluvia API.
   * Default: 'https://api.aluvia.io'
   */
  apiBaseUrl?: string;

  /**
   * Optional: polling interval for refreshing /user config.
   * Default: 5000 ms.
   */
  pollIntervalMs?: number;

  /**
   * Optional: how the client talks to the Aluvia gateway.
   *
   * - 'http'  -> gatewayPort defaults to 8080
   * - 'https' -> gatewayPort defaults to 8443
   *
   * Default: 'http'.
   */
  gatewayProtocol?: GatewayProtocol;

  /**
   * Optional: upstream Aluvia gateway port.
   *
   * If omitted:
   *   - 8080 is used when gatewayProtocol === 'http'
   *   - 8443 is used when gatewayProtocol === 'https'
   */
  gatewayPort?: number;

  /**
   * Optional: local port for the agent’s *local* proxy (127.0.0.1:<localPort>).
   *
   * If omitted, the client will pick a free port automatically by binding to port 0.
   */
  localPort?: number;

  /**
   * Optional: logging verbosity for the client.
   */
  logLevel?: 'silent' | 'info' | 'debug';
};

export type AgentConnectSession = {
  /**
   * Local host where the proxy listens.
   * Always '127.0.0.1' for MVP.
   */
  host: string;

  /**
   * Local port where the proxy listens.
   * Either the user-provided localPort, or the OS-assigned free port.
   */
  port: number;

  /**
   * Convenience URL for the local proxy.
   * Example: 'http://127.0.0.1:54321'
   *
   * (The local proxy itself is always HTTP; it may tunnel to an HTTP or HTTPS
   * gateway upstream based on gatewayProtocol/gatewayPort.)
   */
  url: string;

  /**
   * Stop this proxy instance:
   * - Close the local proxy server.
   * - Stop using it for new connections.
   */
  stop(): Promise<void>;
};

export class AgentConnectClient {
  constructor(options: AgentConnectClientOptions);

  /**
   * Start the Agent Connect session:
   * - Fetch initial /user config from Aluvia.
   * - Start polling for config updates.
   * - Start a local HTTP(S) proxy on 127.0.0.1:<localPort or free port>.
   *
   * Returns the active session with host/port/url and a stop() method.
   */
  start(): Promise<AgentConnectSession>;

  /**
   * Global cleanup:
   * - Stop the local proxy server (if running).
   * - Stop config polling.
   */
  stop(): Promise<void>;
}

```

---

## 3. High-level architecture

Conceptual modules:

```text
@aluvia/agent-connect-node
├── AgentConnectClient      (public API)
│    ├── ConfigManager      (control plane: /user + polling)
│    └── ProxyServer        (local HTTP(S) proxy on 127.0.0.1:<port>)
└── utils                   (rules, HTTP client, logging, errors, etc.)
```

Responsibilities:

1. **Config Manager**
    
    - Talks to `GET /user` on the Aluvia API (using the User API token).
        
    - Stores the current config in memory (proxy credentials, rules, geo, session).
        
    - Polls `/user` at a fixed interval, using ETag for efficient updates.
        
2. **Proxy Server**
    
    - Starts a local HTTP(S) proxy on `127.0.0.1:<port>`.
        
    - For each request, asks Config Manager:
        
        - “Should this host go through Aluvia or direct?”
            
    - If proxied, routes traffic through `gateway.aluvia.io` with user credentials.
        
3. **AgentConnectClient**
    
    - Validates input options and token.
        
    - Orchestrates Config Manager + Proxy Server.
        
    - Exposes `{ host, port, url, stop }` to the caller.
        

---

## 4. Control-plane: Config Manager

The Config Manager is responsible for talking to the Aluvia API (`GET /user`), holding the current network configuration in memory, and keeping that configuration fresh via polling and HTTP ETag.

It does **not** use the `proxy_urls` helper fields from the API; it derives the upstream gateway configuration from:

- The **user’s proxy credentials** returned by `/user`, and
    
- **Static client options**: `gatewayProtocol` (HTTP/HTTPS) and `gatewayPort` (8080/8443 by default).
    

### 4.1 What config we care about

From `GET /user` the client extracts:

- `proxy_username`
    
- `proxy_password`
    
- `rules: string[]` (e.g. `["AUTO", "*.example.com"]`)
    
- `session_id` (string or null)
    
- `target_geo` (e.g. `"us-ny"`)
    

The client should always connect to `gateway.aluvia.io` using the user’s credentials.  
The developer provides:

- A **User API token** (required),
    
- An optional **gateway protocol** (`'http' | 'https'`, default: `'http'`),

We model this as:

```ts
export type GatewayProtocol = 'http' | 'https';

export type RawProxyConfig = {
  protocol: GatewayProtocol;  // 'http' (default) or 'https'
  host: 'gateway.aluvia.io';  // fixed for now
  port: number;               // 8080 or 8443 (or override)
  username: string;           // proxy_username from /user
  password: string;           // proxy_password from /user
};

export type UserNetworkConfig = {
  rawProxy: RawProxyConfig;   // upstream gateway config
  rules: string[];            // ['AUTO', '*.example.com']
  sessionId: string | null;   // 'session-1234' or null
  targetGeo: string | null;   // 'us-ny' or null
  etag: string | null;        // from response header (for If-None-Match)
};
```

The **Config Manager** owns a `UserNetworkConfig | null` and exposes:

```ts
export class ConfigManager {
  constructor(options: {
    token: string;                 // user API token
    apiBaseUrl: string;            // e.g. https://api.aluvia.io
    pollIntervalMs: number;        // e.g. 5000
    gatewayProtocol?: GatewayProtocol; // default 'http'
    gatewayPort?: number;          // default 8080 (or 8443 if https)
    logLevel?: 'silent' | 'info' | 'debug';
  });

  init(): Promise<void>;   // fetch initial config (/user), throw if invalid
  startPolling(): void;    // start periodic GET /user with If-None-Match
  stopPolling(): void;     // stop the polling timer

  getConfig(): UserNetworkConfig | null; // used by ProxyServer per request
}
```

### 4.2 Initial fetch (`init()`)

`init()` is responsible for fetching the initial configuration and failing fast if the token is invalid.

Steps:

1. Make an HTTP request:
    GET /user
    Authorization: Bearer <USER_API_TOKEN>
    Accept: application/json
     
2. If the response is `401` or `403`:
    
    - Throw a typed `InvalidUserTokenError`.
        
3. If the response is `200 OK`:
    
    - Parse the JSON and extract:
        
        - `proxy_username`
            
        - `proxy_password`
            
        - `rules`
            
        - `session_id`
            
        - `target_geo`
            
    - Build a `RawProxyConfig` using:
        
        - `protocol` from constructor options (default `'http'`).
            
        - `host = 'gateway.aluvia.io'`.
            
        - `port` from constructor options (default `8080` for `http`, `8443` for `https`).
            
        - `username = proxy_username`.
            
        - `password = proxy_password`.
            
    - Wrap into a `UserNetworkConfig`.
        
    - Read the `ETag` response header (if present) into `config.etag`.
        
4. Store this `UserNetworkConfig` in memory.
    

If this call fails (network error or 5xx) and there is **no** existing config in memory, `init()` rejects. The outer `AgentConnectClient.start()` then throws a clear error instead of starting a proxy with unknown credentials.

If `init()` succeeds once, the proxy can keep working off that configuration even if later polls temporarily fail.

### 4.3 Polling for updates (`startPolling()`)

After `init()` succeeds, the Config Manager keeps the configuration fresh via polling.

- `startPolling()` sets up a periodic timer (e.g. `setInterval`) every `pollIntervalMs`.
    

Each cycle:

1. If there is no current config yet (should not happen after `init()`), the manager can either:
    
    - Skip the cycle, or
        
    - Attempt `init()` again once.  
        For the MVP, skipping is acceptable.
        
2. Make a conditional request to `/user`:
    
    ```http
    GET /user
    Authorization: Bearer <USER_API_TOKEN>
    Accept: application/json
    If-None-Match: "<config.etag>"
    ```

1. Possible responses:
    
    - `304 Not Modified`
        
        - The server is telling us nothing changed.
            
        - Do nothing; keep the current `UserNetworkConfig`.
            
    - `200 OK`
        
        - Parse the JSON as in `init()`:
            
            - Extract `proxy_username`, `proxy_password`, `rules`, `session_id`, `target_geo`.
                
            - Rebuild `RawProxyConfig` using the configured `gatewayProtocol` and `gatewayPort`.
                
            - Construct a new `UserNetworkConfig`.
                
            - Read the new `ETag` header.
                
        - Replace the in-memory config **atomically** (simple assignment is enough in Node’s single-threaded model).
            
    - `5xx` or network error
        
        - Log a warning (depending on `logLevel`).
            
        - Keep the existing `UserNetworkConfig` in memory.
            
        - Do not crash the proxy; the data-plane continues using the last known-good configuration.
            

`stopPolling()` cancels the timer when the client is stopped, so no further API calls are made.

### 4.4 Why ETag matters

ETag is crucial for making this efficient and responsive:

- When nothing changes on the backend (rules, geo, session_id, credentials), `/user` responds with `304 Not Modified`.
    
    - No JSON body is sent.
        
    - The client avoids unnecessary parsing and allocations.
        
- When you update **rules/targeting/session** via:
    
    - The dashboard, or
        
    - The account-level API (`PATCH /account/users/{user_id}`), or
        
    - The user-level API (`PATCH /user`),
        
    
    the backend changes the ETag. On the next poll:
    
    - The client sends the old ETag.
        
    - The server responds with `200 OK` + new config + new ETag.
        
    - The Config Manager swaps in the new `UserNetworkConfig`.
        

Because the proxy always consults `ConfigManager.getConfig()` when deciding how to route requests, these updates take effect **without restarting the agent or its browser**.

---
```

## 5. Data-plane: Proxy Server

The Proxy Server is the component that listens locally (`127.0.0.1:<port>`) and forwards traffic either:

- **Through Aluvia** (via `gateway.aluvia.io`), or
    
- **Directly to the origin** (no upstream proxy),
    

based on the current rules in `UserNetworkConfig`.



### 5.1 Implementation choice


1. Use a mature proxy library such as **`proxy-chain`**.
    
    - Handles HTTP and HTTPS (CONNECT) tunneling, connection lifecycle, etc.
        
    - Lets you plug in a `prepareRequestFunction` deciding per-request upstream behavior.
        


### 5.2 Internal ProxyServer API

This is an **internal** class; it is not exported from the package.

```ts
class ProxyServer {
  constructor(
    configManager: ConfigManager,
    options?: { logLevel?: 'silent' | 'info' | 'debug' }
  );

  start(port?: number): Promise<{ host: string; port: number; url: string }>;
  stop(): Promise<void>;
}
```

Behavior:

- `start(port?)`:
    
    - If `port` is provided, listen on that port.
        
    - Else, pass `0` to the underlying server and let the OS allocate a free port.
        
    - Resolve when the server is actually listening and you know the assigned port.
        
    - Return `{ host: '127.0.0.1', port, url: 'http://127.0.0.1:<port>' }`.
        
- `stop()`:
    
    - Close the underlying HTTP(S) proxy server.
        
    - Clean up any timers or resources it owns.
        

### 5.3 Routing logic per request

For each incoming request:

1. Retrieve current config:
    
    ```ts
    const cfg = configManager.getConfig();
    ```
    
    If `cfg` is `null` (should not happen after a successful `init()`), safest behavior for MVP is to **bypass** (direct connection) to avoid breaking agents.
    
2. Determine `hostname`:
    
    - For HTTP: from request URL or `Host` header.
        
    - For HTTPS (CONNECT): from `host:port` in the CONNECT line.
        
3. Decide whether to proxy:
    
    ```ts
    const useProxy = shouldProxy(hostname, cfg.rules, /* optionally cfg.targetGeo */);
    ```
    
4. If **not** proxied:
    
    - Return `null` from `prepareRequestFunction` (or equivalent) so the request goes **direct**.
        
5. If proxied:
    
    - Build upstream proxy URL from `cfg.rawProxy`:
        
        ```ts
        const { host, port, username, password, protocol } = cfg.rawProxy;
        const upstreamProxyUrl =
          `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
        ```
        
    - Return `{ upstreamProxyUrl }` to the proxy library, so traffic for this hostname is sent via Aluvia.
        

### 5.4 Rule semantics (MVP)

Implement a helper in `rules.ts`:

```ts
export function shouldProxy(
  hostname: string,
  rules: string[],
  opts?: { autoHostnames?: string[] }
): boolean;
```

Suggested semantics:

- `[]` → proxy nothing (all direct).
    
- `['*']` → proxy everything.
    
- `['example.com']` → proxy `example.com` only.
    
- `['*.google.com']` → proxy `foo.google.com`, `bar.google.com`, etc.
    
- `['google.*']` → proxy `google.com`, `google.co.uk`, etc.
    
- `['*', '-example.com']` → proxy everything **except** `example.com`.
    
- `['AUTO', ...]` → treat `AUTO` as a special preset; for the MVP:
    
    - Backend can return an `autoHostnames: string[]` list as part of `/user` (future extension).
        
    - `shouldProxy` checks `hostname` in `autoHostnames` when `rules` contains `'AUTO'`.
        

You do not need to over-engineer the rule engine initially, but the structure should allow adding:

- Additional presets,
    
- Per-geo rules,
    
- Per-service rules.
    

---

## 6. AgentConnectClient orchestration

This is the **public** class exposed by the package.

### 6.1 Class responsibilities

`AgentConnectClient`:

- Validates constructor options (e.g. ensures `token` is provided).
    
- Instantiates a single `ConfigManager`.
    
- Instantiates a single `ProxyServer`.
    
- Manages lifecycle (`start` / `stop`) of both.
    
- Returns a simple `AgentConnectSession` object.
    

### 6.2 `AgentConnectClient` outline

```ts
export class AgentConnectClient {
  private readonly configManager: ConfigManager;
  private readonly proxyServer: ProxyServer;
  private session: AgentConnectSession | null = null;
  private started = false;

  constructor(private readonly options: AgentConnectClientOptions) {
    if (!options.token) {
      throw new MissingUserTokenError('Aluvia user token is required');
    }

    const apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io';
    const pollIntervalMs = options.pollIntervalMs ?? 5000;
    const gatewayProtocol = options.gatewayProtocol ?? 'http';
    const gatewayPort =
      options.gatewayPort ?? (gatewayProtocol === 'https' ? 8443 : 8080);

    this.configManager = new ConfigManager({
      token: options.token,
      apiBaseUrl,
      pollIntervalMs,
      gatewayProtocol,
      gatewayPort,
      logLevel: options.logLevel ?? 'info',
    });

    this.proxyServer = new ProxyServer(this.configManager, {
      logLevel: options.logLevel ?? 'info',
    });
  }

  async start(): Promise<AgentConnectSession> {
    if (this.started && this.session) return this.session;

    // 1. Fetch initial config
    await this.configManager.init(); // may throw InvalidUserTokenError, ApiError, etc.

    // 2. Start proxy
    const { host, port, url } = await this.proxyServer.start();

    // 3. Start polling control plane
    this.configManager.startPolling();

    // 4. Build session object
    const session: AgentConnectSession = {
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

    this.session = session;
    this.started = true;
    return session;
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.proxyServer.stop();
    this.configManager.stopPolling();
    this.session = null;
    this.started = false;
  }
}
```

This is illustrative; an engineer can refine details (e.g., idempotency, concurrent `start()` calls).

---

## 7. Error handling and logging

Define a small set of error classes in `errors.ts`:

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

Behavior:

- Constructor:
    
    - Throws `MissingUserTokenError` if `token` is not provided.
        
- `start()`:
    
    - Can throw:
        
        - `InvalidUserTokenError` if `/user` returns 401/403.
            
        - `ApiError` for other non-2xx from `/user`.
            
        - `ProxyStartError` if the local proxy cannot bind to a port.
            
- Polling failures:
    
    - Logged at `info` or `debug` level depending on `logLevel`.
        
    - Do **not** cause `start()` or the active session to fail.
        

Logging:

- Provide a simple logger wrapper (`logger.ts`) that respects `logLevel`:
    
    - `silent` → no logs.
        
    - `info` → high-level events (startup, config updates).
        
    - `debug` → detailed event logs (per poll, rule decisions, etc.).
        

---

## 8. Configuration options and defaults

Summarising defaults:

- `apiBaseUrl`: `https://api.aluvia.io`
    
- `pollIntervalMs`: `5000`
    
- `gatewayProtocol`: `'http'`
    
- `gatewayPort`:
    
    - If `gatewayProtocol === 'http'` → `8080`
        
    - If `gatewayProtocol === 'https'` → `8443`
        
- `logLevel`: `'info'`
    

Node requirements:

- Target Node 18+ (so you can use native `fetch` if desired), or
    
- Include a fetch polyfill (e.g. `node-fetch`) in `httpClient.ts`.
    

---

## 9. File and folder structure

Recommended TypeScript layout:

```text
agent-connect-node/
  package.json
  tsconfig.json
  src/
    index.ts               # export AgentConnectClient
    AgentConnectClient.ts  # public orchestration class
    ConfigManager.ts       # control-plane (/user + polling)
    ProxyServer.ts         # local HTTP(S) proxy implementation
    rules.ts               # shouldProxy + wildcard logic
    httpClient.ts          # fetch wrapper with auth headers, error handling
    errors.ts              # MissingUserTokenError, InvalidUserTokenError, etc.
    logger.ts              # logLevel-aware logger
```

`package.json` (core deps):

-use  `proxy-chain` (if we decide to use it).


Dev dependencies:

- `typescript`
    
- `@types/node`
    
- `ts-node` or similar (for local dev only).
    

---
