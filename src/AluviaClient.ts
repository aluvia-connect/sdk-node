// AluviaClient - Main public class for Aluvia Client

import type { AluviaClientOptions, AluviaClientSession, GatewayProtocol, LogLevel } from './types.js';
import { ConfigManager } from './ConfigManager.js';
import { ProxyServer } from './ProxyServer.js';
import { MissingApiKeyError } from './errors.js';
import { createNodeProxyAgent, toPlaywrightProxySettings, toPuppeteerArgs, toSeleniumArgs } from './adapters.js';
import { Logger } from './logger.js';

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
  private readonly logger: Logger;

  constructor(options: AluviaClientOptions) {
    // Validate apiKey
    if (!options.apiKey) {
      throw new MissingApiKeyError('Aluvia apiKey is required');
    }

    const smart_routing = options.smart_routing ?? false;
    this.options = { ...options, smart_routing };

    const apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io/v1';
    const pollIntervalMs = options.pollIntervalMs ?? 5000;
    const gatewayProtocol: GatewayProtocol = options.gatewayProtocol ?? 'http';
    const gatewayPort = options.gatewayPort ?? (gatewayProtocol === 'https' ? 8443 : 8080);
    const logLevel: LogLevel = options.logLevel ?? 'info';

    this.logger = new Logger(logLevel);

    // Create ConfigManager
    this.configManager = new ConfigManager({
      apiKey: options.apiKey,
      apiBaseUrl,
      pollIntervalMs,
      gatewayProtocol,
      gatewayPort,
      logLevel,
      connectionId: options.connection_id,
    });

    // Create ProxyServer
    this.proxyServer = new ProxyServer(this.configManager, { logLevel });
  }

  /**
   * Start the Aluvia Client session:
   * - Fetch initial /connection config from Aluvia.
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

    // Fetch initial configuration (may throw InvalidConnectionTokenError or ApiError)
    await this.configManager.init();
    this.configManager.startPolling();

    const smartRoutingEnabled = this.options.smart_routing === true;

    if (!smartRoutingEnabled) {
      this.logger.debug('smart_routing disabled — local proxy will not start');

      let nodeAgent: ReturnType<typeof createNodeProxyAgent> | null = null;

      const stop = async () => {
        this.configManager.stopPolling();
        nodeAgent?.destroy?.();
        nodeAgent = null;
        this.session = null;
        this.started = false;
      };

      // Build session object
      const session: AluviaClientSession = {
        host: '127.0.0.1',
        port: 0,
        url: '',
        getUrl: () => {
          const cfg = this.configManager.getConfig();
          if (!cfg) return '';
          const { protocol, host, port, username, password } = cfg.rawProxy;
          return `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
        },
        asPlaywright: () => {
          const cfg = this.configManager.getConfig();
          if (!cfg) return { server: '' };
          const { protocol, host, port, username, password } = cfg.rawProxy;
          return toPlaywrightProxySettings({
            server: `${protocol}://${host}:${port}`,
            username,
            password,
          });
        },
        asPuppeteer: () => {
          const cfg = this.configManager.getConfig();
          if (!cfg) return [];
          const { protocol, host, port } = cfg.rawProxy;
          return toPuppeteerArgs(`${protocol}://${host}:${port}`);
        },
        asSelenium: () => {
          const cfg = this.configManager.getConfig();
          if (!cfg) return '';
          const { protocol, host, port } = cfg.rawProxy;
          return toSeleniumArgs(`${protocol}://${host}:${port}`);
        },
        asNodeAgent: () => {
          if (!nodeAgent) {
            const cfg = this.configManager.getConfig();
            if (!cfg) {
              nodeAgent = createNodeProxyAgent('http://127.0.0.1'); // unreachable fallback
            } else {
              const { protocol, host, port, username, password } = cfg.rawProxy;
              nodeAgent = createNodeProxyAgent({
                server: `${protocol}://${host}:${port}`,
                username,
                password,
              });
            }
          }
          return nodeAgent;
        },
        stop,
        close: stop,
      };

      this.session = session;
      this.started = true;
      return session;
    }

    // smart_routing === true
    const { host, port, url } = await this.proxyServer.start(this.options.localPort);

    let nodeAgent: ReturnType<typeof createNodeProxyAgent> | null = null;

    const stop = async () => {
      await this.proxyServer.stop();
      this.configManager.stopPolling();
      nodeAgent?.destroy?.();
      nodeAgent = null;
      this.session = null;
      this.started = false;
    };

    // Build session object
    const session: AluviaClientSession = {
      host,
      port,
      url,
      getUrl: () => url,
      asPlaywright: () => toPlaywrightProxySettings(url),
      asPuppeteer: () => toPuppeteerArgs(url),
      asSelenium: () => toSeleniumArgs(url),
      asNodeAgent: () => {
        if (!nodeAgent) {
          nodeAgent = createNodeProxyAgent(url);
        }
        return nodeAgent;
      },
      stop,
      close: stop,
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

    // Only stop proxy if it was potentially started.
    if (this.options.smart_routing) {
      await this.proxyServer.stop();
    }
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
