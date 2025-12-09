// AgentConnectClient - Main public class for Aluvia Agent Connect

import type { AgentConnectClientOptions, AgentConnectSession, GatewayProtocol, LogLevel } from './types';
import { ConfigManager } from './ConfigManager';
import { ProxyServer } from './ProxyServer';
import { MissingUserTokenError } from './errors';

/**
 * AgentConnectClient is the main entry point for the Aluvia Agent Connect Node client.
 *
 * It manages the local proxy server and configuration polling.
 */
export class AgentConnectClient {
  private readonly options: AgentConnectClientOptions;
  private readonly configManager: ConfigManager;
  private readonly proxyServer: ProxyServer;
  private session: AgentConnectSession | null = null;
  private started = false;

  constructor(options: AgentConnectClientOptions) {
    // Validate token
    if (!options.token) {
      throw new MissingUserTokenError('Aluvia user token is required');
    }

    this.options = options;

    // Apply defaults
    const apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io';
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
   * Start the Agent Connect session:
   * - Fetch initial /user config from Aluvia.
   * - Start polling for config updates.
   * - Start a local HTTP(S) proxy on 127.0.0.1:<localPort or free port>.
   *
   * Returns the active session with host/port/url and a stop() method.
   */
  async start(): Promise<AgentConnectSession> {
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
}
