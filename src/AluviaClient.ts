// AluviaClient - Main public class for Aluvia Client

import type { AluviaClientOptions, AluviaClientSession, GatewayProtocol, LogLevel } from './types.js';
import { ConfigManager } from './ConfigManager.js';
import { ProxyServer } from './ProxyServer.js';
import { MissingUserTokenError } from './errors.js';

/**
 * AluviaClient is the main entry point for the Aluvia Client.
 *
 * It manages the local proxy server and configuration polling.
 */
export class AluviaClient {
  private readonly options: AluviaClientOptions;
  private readonly configManager: ConfigManager;
  private readonly proxyServer: ProxyServer;
  private session: AluviaClientSession | null = null;
  private started = false;

  constructor(options: AluviaClientOptions) {
    // Validate token
    if (!options.token) {
      throw new MissingUserTokenError('Aluvia user token is required');
    }

    this.options = options;

    // Apply defaults
    const apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io/v1';
    const pollIntervalMs = options.pollIntervalMs ?? 5000;
    const gatewayProtocol: GatewayProtocol = options.gatewayProtocol ?? 'http';
    const gatewayPort = options.gatewayPort ?? (gatewayProtocol === 'https' ? 8443 : 8080);
    const logLevel: LogLevel = options.logLevel ?? 'info';

    // Create ConfigManager
    this.configManager = new ConfigManager({
      token: options.token,
      apiBaseUrl,
      pollIntervalMs,
      gatewayProtocol,
      gatewayPort,
      logLevel,
    });

    // Create ProxyServer
    this.proxyServer = new ProxyServer(this.configManager, { logLevel });
  }

  /**
   * Start the Aluvia Client session:
   * - Fetch initial /user config from Aluvia.
   * - Start polling for config updates.
   * - Start a local HTTP(S) proxy on 127.0.0.1:<localPort or free port>.
   *
   * Returns the active session with host/port/url and a stop() method.
   */
  async start(): Promise<AluviaClientSession> {
    // Return existing session if already started
    if (this.started && this.session) {
      return this.session;
    }

    // Fetch initial configuration (may throw InvalidUserTokenError or ApiError)
    await this.configManager.init();

    // Start the proxy server
    const { host, port, url } = await this.proxyServer.start(this.options.localPort);

    // Start polling for config updates
    this.configManager.startPolling();

    // Build session object
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

    this.session = session;
    this.started = true;

    return session;
  }

  /**
   * Global cleanup:
   * - Stop the local proxy server (if running).
   * - Stop config polling.
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    await this.proxyServer.stop();
    this.configManager.stopPolling();
    this.session = null;
    this.started = false;
  }

  /**
   * Update the filtering rules used by the proxy.
   * @param rules
   */
  async updateRules(rules: Array<string>): Promise<void> {
    await this.configManager.setConfig({rules: rules});
  }

  /**
   * Update the session ID.
   * @param sessionId
   */
  async updateSessionId(sessionId: string): Promise<void> {
    await this.configManager.setConfig({session_id: sessionId});
  }
}
