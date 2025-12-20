// AluviaClient - Main public class for Aluvia Client

import type { AluviaClientConnection, AluviaClientOptions, GatewayProtocol, LogLevel } from './types.js';
import { ConfigManager } from './ConfigManager.js';
import { ProxyServer } from './ProxyServer.js';
import { ApiError, MissingApiKeyError } from './errors.js';
import { createNodeProxyAgent, toPlaywrightProxySettings, toPuppeteerArgs, toSeleniumArgs } from './adapters.js';
import { Logger } from './logger.js';
import { AluviaApi } from './api/AluviaApi.js';

/**
 * AluviaClient is the main entry point for the Aluvia Client.
 *
 * It manages the local proxy server and configuration polling.
 */
export class AluviaClient {
  private readonly options: AluviaClientOptions;
  private readonly configManager: ConfigManager;
  private readonly proxyServer: ProxyServer;
  private connection: AluviaClientConnection | null = null;
  private started = false;
  private readonly logger: Logger;
  public readonly api: AluviaApi;

  constructor(options: AluviaClientOptions) {
    // Validate apiKey
    if (!options.apiKey) {
      throw new MissingApiKeyError('Aluvia apiKey is required');
    }

    const smart_routing = options.smart_routing ?? false;
    this.options = { ...options, smart_routing };

    const connectionId = (() => {
      if (options.connection_id == null) return undefined;
      const trimmed = String(options.connection_id).trim();
      return trimmed.length > 0 ? trimmed : undefined;
    })();

    const apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io/v1';
    const pollIntervalMs = options.pollIntervalMs ?? 5000;
    const timeoutMs = options.timeoutMs;
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
      connectionId,
    });

    // Create ProxyServer
    this.proxyServer = new ProxyServer(this.configManager, { logLevel });

    this.api = new AluviaApi({
      apiKey: options.apiKey,
      apiBaseUrl,
      timeoutMs,
    });
  }

  /**
   * Start the Aluvia Client connection:
   * - Fetch initial account connection config from Aluvia.
   * - Start polling for config updates.
   * - Start a local HTTP(S) proxy on 127.0.0.1:<localPort or free port>.
   *
   * Returns the active connection with host/port/url and a stop() method.
   */
  async start(): Promise<AluviaClientConnection> {
    // Return existing connection if already started
    if (this.started && this.connection) {
      return this.connection;
    }

    const smartRoutingEnabled = this.options.smart_routing === true;

    // Fetch initial configuration (may throw InvalidApiKeyError or ApiError)
    await this.configManager.init();

    // Gateway mode cannot function without proxy credentials/config, so fail fast.
    if (!smartRoutingEnabled && !this.configManager.getConfig()) {
      throw new ApiError(
        'Failed to load account connection config; cannot start in gateway mode without proxy credentials',
        500,
      );
    }

    this.configManager.startPolling();

    if (!smartRoutingEnabled) {
      this.logger.debug('client proxy mode disabled — local proxy will not start');

      let nodeAgent: ReturnType<typeof createNodeProxyAgent> | null = null;

      const cfgAtStart = this.configManager.getConfig();
      const serverUrlAtStart = (() => {
        if (!cfgAtStart) return '';
        const { protocol, host, port } = cfgAtStart.rawProxy;
        return `${protocol}://${host}:${port}`;
      })();

      const stop = async () => {
        this.configManager.stopPolling();
        nodeAgent?.destroy?.();
        nodeAgent = null;
        this.connection = null;
        this.started = false;
      };

      // Build connection object
      const connection: AluviaClientConnection = {
        host: cfgAtStart?.rawProxy.host ?? '127.0.0.1',
        port: cfgAtStart?.rawProxy.port ?? 0,
        url: serverUrlAtStart,
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
          return {
            ...toPlaywrightProxySettings(`${protocol}://${host}:${port}`),
            username,
            password,
          };
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
              nodeAgent = createNodeProxyAgent('http://127.0.0.1');
            } else {
              const { protocol, host, port, username, password } = cfg.rawProxy;
              nodeAgent = createNodeProxyAgent(
                `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`,
              );
            }
          }
          return nodeAgent;
        },
        stop,
        close: stop,
      };

      this.connection = connection;
      this.started = true;
      return connection;
    }

    // smart_routing === true
    const { host, port, url } = await this.proxyServer.start(this.options.localPort);

    let nodeAgent: ReturnType<typeof createNodeProxyAgent> | null = null;

    const stop = async () => {
      await this.proxyServer.stop();
      this.configManager.stopPolling();
      nodeAgent?.destroy?.();
      nodeAgent = null;
      this.connection = null;
      this.started = false;
    };

    // Build connection object
    const connection: AluviaClientConnection = {
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

    this.connection = connection;
    this.started = true;

    return connection;
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
    this.connection = null;
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
   * Update the upstream session_id.
   * @param sessionId
   */
  async updateSessionId(sessionId: string): Promise<void> {
    await this.configManager.setConfig({session_id: sessionId});
  }
}
