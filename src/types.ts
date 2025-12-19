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
   * and will fall back to legacy GET /connection if creation is not available.
   */
  connection_id?: number;

  /**
   * Optional: enable smart routing.
   *
   * If true: start the local proxy (127.0.0.1:<port>) and route traffic dynamically.
   * If false (default): do NOT start a local proxy; adapters return remote proxy settings
   * from the connection API response for direct use by Playwright/Axios/etc.
   */
  smart_routing?: boolean;
};

/**
 * Represents an active Aluvia Client session.
 */
export type AluviaClientSession = {
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
   * Convenience accessor for the local proxy URL.
   * This is always the same value as session.url.
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
   * Node HTTP(S) proxy agent adapter for Axios, got, and node-fetch.
   */
  asNodeAgent(): import('node:http').Agent;

  /**
   * Stop this proxy instance:
   * - Close the local proxy server.
   * - Stop using it for new connections.
   */
  stop(): Promise<void>;

  /**
   * Alias for stop().
   */
  close(): Promise<void>;
};
