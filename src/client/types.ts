// Public types for Aluvia Client Node

/**
 * Protocol used to connect to the Aluvia gateway.
 */
export type GatewayProtocol = 'http' | 'https';

/**
 * Log level for the client.
 */
export type LogLevel = 'silent' | 'info' | 'debug';

export type PlaywrightProxySettings = {
  server: string;
  username?: string;
  password?: string;
};

/**
 * Options for creating an AluviaClient instance.
 */
export type AluviaClientOptions = {
  /**
   * Required: user API apiKey (Bearer).
   * This is the apiKey for a single Aluvia user/agent.
   */
  apiKey: string;

  /**
   * Optional: base URL for the Aluvia API.
   * Default: 'https://api.aluvia.io/v1'
   */
  apiBaseUrl?: string;

  /**
   * Optional: polling interval for refreshing account connection config.
   * Default: 5000 ms.
   */
  pollIntervalMs?: number;

  /**
   * Optional: request timeout for API calls made via `client.api`.
   * Default: 30000 ms.
   */
  timeoutMs?: number;

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
   * Optional: local port for the agent's *local* proxy (127.0.0.1:<localPort>).
   *
   * If omitted, the client will pick a free port automatically by binding to port 0.
   */
  localPort?: number;

  /**
   * Optional: logging verbosity for the client.
   */
  logLevel?: LogLevel;

  /**
   * Optional: use an existing account connection by ID.
   *
   * If provided, the client retrieves config via:
   *   GET /account/connections/:connection_id
   *
   * If omitted, the client will attempt to create a new account connection via:
   *   POST /account/connections
   */
  connectionId?: number;

  /**
   * Optional: enable local proxy mode (client proxy mode).
   *
   * If true (default): start the local proxy (127.0.0.1:<port>) and route traffic dynamically.
   * If false: do NOT start a local proxy; adapters return gateway proxy settings
   * from the account connection API response for direct use by Playwright/Axios/etc.
   */
  localProxy?: boolean;

  /**
   * Optional: strict startup behavior.
   *
   * If true (default): `client.start()` throws if the SDK cannot load/create
   * an account connection config (proxy credentials + rules). This prevents
   * "silent direct routing" where the local proxy starts but bypasses Aluvia.
   *
   * If false: in client proxy mode, the SDK may still start a local proxy and
   * route traffic directly when config is unavailable.
   */
  strict?: boolean;

  /**
   * Optional: automatically start Playwright and return the Playwright object.
   *
   * If true: the SDK will import and initialize Playwright, making it available
   * via `connection.playwright`. The Playwright instance is automatically configured
   * to use the Aluvia proxy.
   *
   * If false (default): Playwright is not initialized automatically.
   *
   * Note: Playwright must be installed as a dependency for this option to work.
   */
  startPlaywright?: boolean;
};

/**
 * Represents an active Aluvia Client connection.
 */
export type AluviaClientConnection = {
  /**
   * Proxy host to configure in your client.
   *
   * - In client proxy mode (localProxy: true): this is the local proxy host ('127.0.0.1').
   * - In gateway mode: this is the Aluvia gateway host (typically 'gateway.aluvia.io').
   */
  host: string;

  /**
   * Proxy port to configure in your client.
   *
   * - In client proxy mode (localProxy: true): this is the local proxy port.
   * - In gateway mode: this is the Aluvia gateway port (typically 8080 or 8443).
   */
  port: number;

  /**
   * Convenience URL for the proxy server endpoint (without embedding credentials).
   *
   * - In client proxy mode (localProxy: true): 'http://127.0.0.1:<port>'
   * - In gateway mode: '<protocol>://gateway.aluvia.io:<port>'
   *
   * (The local proxy itself is always HTTP; it may tunnel to an HTTP or HTTPS
   * gateway upstream based on gatewayProtocol/gatewayPort.)
   */
  url: string;

  /**
   * Returns a credential-embedded proxy URL intended for clients that require auth in the URL.
   *
   * Note: This value contains secrets (proxy username/password). Avoid logging it or putting it
   * in places that may be exposed (e.g., process args).
   */
  getUrl(): string;

  /**
   * Playwright adapter for chromium/firefox/webkit launch options.
   */
  asPlaywright(): PlaywrightProxySettings;

  /**
   * Puppeteer adapter for launch args.
   */
  asPuppeteer(): Array<string>;

  /**
   * Selenium adapter for launch args.
   */
  asSelenium(): string;

  /**
   * Node HTTP(S) proxy agents for libraries that accept per-protocol agents.
   *
   * Useful for: Axios, got, node-fetch (legacy).
   */
  asNodeAgents(): {
    http: import('node:http').Agent;
    https: import('node:http').Agent;
  };

  /**
   * Axios adapter config.
   *
   * Returns `{ proxy: false, httpAgent, httpsAgent }` so Axios uses the provided agents
   * instead of its built-in proxy option handling.
   */
  asAxiosConfig(): {
    proxy: false;
    httpAgent: import('node:http').Agent;
    httpsAgent: import('node:http').Agent;
  };

  /**
   * got adapter options.
   *
   * Returns `{ agent: { http, https } }`.
   */
  asGotOptions(): {
    agent: {
      http: import('node:http').Agent;
      https: import('node:http').Agent;
    };
  };

  /**
   * undici proxy dispatcher (for undici fetch / undici clients).
   */
  // @ts-ignore
  asUndiciDispatcher(): import('undici').Dispatcher;

  /**
   * Returns a `fetch` function powered by undici that uses the proxy dispatcher per request.
   *
   * Note: Node's built-in `fetch()` does not accept a Node `Agent`. Use this for proxying
   * fetch calls through Aluvia.
   */
  asUndiciFetch(): typeof fetch;

  /**
   * Playwright Chromium browser instance, automatically configured with Aluvia proxy.
   *
   * Only available if `startPlaywright: true` was passed to AluviaClientOptions.
   * Otherwise this property is undefined.
   *
   * The browser is already configured to use the Aluvia proxy, so you can use it directly.
   */
  browser?: any;

  /**
   * Chrome DevTools Protocol WebSocket URL.
   *
   * Only available if `startPlaywright: true` was passed to AluviaClientOptions.
   * Can be used to connect to the browser via CDP from external tools.
   */
  cdpUrl?: string;

  /**
   * Stop this proxy instance:
   * - Close the local proxy server.
   * - Close the browser (if started).
   * - Stop using it for new connections.
   */
  stop(): Promise<void>;

  /**
   * Alias for stop().
   */
  close(): Promise<void>;
};
