// AluviaClient - Main public class for Aluvia Client

import type { AluviaClientConnection, AluviaClientOptions, GatewayProtocol, LogLevel } from './types.js';
import { ConfigManager } from './ConfigManager.js';
import { ProxyServer } from './ProxyServer.js';
import { ApiError, MissingApiKeyError } from '../errors.js';
import {
  createNodeProxyAgents,
  createUndiciDispatcher,
  createUndiciFetch,
  toAxiosConfig,
  toGotOptions,
  toPlaywrightProxySettings,
  toPuppeteerArgs,
  toSeleniumArgs,
} from './adapters.js';
import { Logger } from './logger.js';
import { AluviaApi } from '../api/AluviaApi.js';
import * as net from 'node:net';

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
  private startPromise: Promise<AluviaClientConnection> | null = null;
  private readonly logger: Logger;
  public readonly api: AluviaApi;

  constructor(options: AluviaClientOptions) {
    const apiKey = String(options.apiKey ?? '').trim();
    if (!apiKey) {
      throw new MissingApiKeyError('Aluvia apiKey is required');
    }

    const localProxy = options.localProxy ?? true;
    const strict = options.strict ?? true;
    this.options = { ...options, apiKey, localProxy, strict };

    const connectionId = Number(options.connectionId) ?? null;

    const apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io/v1';
    const pollIntervalMs = options.pollIntervalMs ?? 5000;
    const timeoutMs = options.timeoutMs;
    const gatewayProtocol: GatewayProtocol = options.gatewayProtocol ?? 'http';
    const gatewayPort = options.gatewayPort ?? (gatewayProtocol === 'https' ? 8443 : 8080);
    const logLevel: LogLevel = options.logLevel ?? 'info';

    this.logger = new Logger(logLevel);

    // Create ConfigManager
    this.configManager = new ConfigManager({
      apiKey,
      apiBaseUrl,
      pollIntervalMs,
      gatewayProtocol,
      gatewayPort,
      logLevel,
      connectionId,
      strict,
    });

    // Create ProxyServer
    this.proxyServer = new ProxyServer(this.configManager, { logLevel });

    this.api = new AluviaApi({
      apiKey,
      apiBaseUrl,
      timeoutMs,
    });
  }

  /**
   * Start the Aluvia Client connection:
   * - Fetch initial account connection config from Aluvia.
   * - Start polling for config updates.
   * - If localProxy is enabled (default): start a local HTTP proxy on 127.0.0.1:<localPort or free port>.
   * - If localProxy is disabled: do NOT start a local proxy; adapters use gateway proxy settings.
   *
   * Returns the active connection with host/port/url and a stop() method.
   */
  async start(): Promise<AluviaClientConnection> {
    // Return existing connection if already started
    if (this.started && this.connection) {
      return this.connection;
    }

    // If a start is already in-flight, await it.
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = (async () => {
      const localProxyEnabled = this.options.localProxy === true;

      // Fetch initial configuration (may throw InvalidApiKeyError or ApiError)
      await this.configManager.init();

      // Initialize Playwright if requested
      let browserInstance: any = undefined;
      if (this.options.startPlaywright) {
        try {
          // @ts-expect-error -- 'playwright' is an optional peer dependency and may not be installed at typecheck time
          const pw = await import('playwright');

          // We need to launch the browser after we have proxy configuration
          // Store the chromium module for now, will launch after proxy is ready
          browserInstance = pw.chromium;
        } catch (error: any) {
          throw new ApiError(
            `Failed to load Playwright. Make sure 'playwright' is installed: ${error.message}`,
            500,
          );
        }
      }

      // Gateway mode cannot function without proxy credentials/config, so fail fast.
      if (!localProxyEnabled && !this.configManager.getConfig()) {
        throw new ApiError(
          'Failed to load account connection config; cannot start in gateway mode without proxy credentials',
          500,
        );
      }

      if (!localProxyEnabled) {
        this.logger.debug('localProxy disabled — local proxy will not start');

        let nodeAgents: ReturnType<typeof createNodeProxyAgents> | null = null;
        let undiciDispatcher: ReturnType<typeof createUndiciDispatcher> | null = null;
        let undiciFetchFn: ReturnType<typeof createUndiciFetch> | null = null;

        const cfgAtStart = this.configManager.getConfig();
        const serverUrlAtStart = (() => {
          if (!cfgAtStart) return '';
          const { protocol, host, port } = cfgAtStart.rawProxy;
          return `${protocol}://${host}:${port}`;
        })();

        const getProxyUrlForHttpClients = () => {
          const cfg = this.configManager.getConfig();
          if (!cfg) return 'http://127.0.0.1';
          const { protocol, host, port, username, password } = cfg.rawProxy;
          return `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
        };

        const getNodeAgents = () => {
          if (!nodeAgents) {
            nodeAgents = createNodeProxyAgents(getProxyUrlForHttpClients());
          }
          return nodeAgents;
        };

        const getUndiciDispatcher = () => {
          if (!undiciDispatcher) {
            undiciDispatcher = createUndiciDispatcher(getProxyUrlForHttpClients());
          }
          return undiciDispatcher;
        };

        const closeUndiciDispatcher = async () => {
          const d: any = undiciDispatcher as any;
          if (!d) return;
          try {
            if (typeof d.close === 'function') {
              await d.close();
            } else if (typeof d.destroy === 'function') {
              d.destroy();
            }
          } finally {
            undiciDispatcher = null;
          }
        };

        const stop = async () => {
          this.configManager.stopPolling();
          nodeAgents?.http?.destroy?.();
          nodeAgents?.https?.destroy?.();
          nodeAgents = null;
          await closeUndiciDispatcher();
          undiciFetchFn = null;
          this.connection = null;
          this.started = false;
        };

        // Launch browser if Playwright was requested
        let launchedBrowser: any = undefined;
        let browserCdpUrl: string | undefined;
        if (browserInstance) {
          const cfg = this.configManager.getConfig();
          if (cfg) {
            const { protocol, host, port, username, password } = cfg.rawProxy;
            const proxySettings = {
              ...toPlaywrightProxySettings(`${protocol}://${host}:${port}`),
              username,
              password,
            };
            const cdpPort = await AluviaClient.findFreePort();
            launchedBrowser = await browserInstance.launch({
              proxy: proxySettings,
              headless: this.options.headless !== false,
              args: [`--remote-debugging-port=${cdpPort}`],
            });
            browserCdpUrl = `http://127.0.0.1:${cdpPort}`;
          }
        }

        const stopWithBrowser = async () => {
          if (launchedBrowser) await launchedBrowser.close();
          await stop();
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
          asNodeAgents: () => getNodeAgents(),
          asAxiosConfig: () => toAxiosConfig(getNodeAgents()),
          asGotOptions: () => toGotOptions(getNodeAgents()),
          asUndiciDispatcher: () => getUndiciDispatcher(),
          asUndiciFetch: () => {
            if (!undiciFetchFn) {
              undiciFetchFn = createUndiciFetch(getUndiciDispatcher());
            }
            return undiciFetchFn;
          },
          browser: launchedBrowser,
          cdpUrl: browserCdpUrl,
          stop: stopWithBrowser,
          close: stopWithBrowser,
        };

        this.connection = connection;
        this.started = true;
        return connection;
      }

      // In client proxy mode, keep config fresh so routing decisions update without restarting.
      this.configManager.startPolling();

      // localProxy === true
      const { host, port, url } = await this.proxyServer.start(this.options.localPort);

      let nodeAgents: ReturnType<typeof createNodeProxyAgents> | null = null;
      let undiciDispatcher: ReturnType<typeof createUndiciDispatcher> | null = null;
      let undiciFetchFn: ReturnType<typeof createUndiciFetch> | null = null;

      const getNodeAgents = () => {
        if (!nodeAgents) {
          nodeAgents = createNodeProxyAgents(url);
        }
        return nodeAgents;
      };

      const getUndiciDispatcher = () => {
        if (!undiciDispatcher) {
          undiciDispatcher = createUndiciDispatcher(url);
        }
        return undiciDispatcher;
      };

      const closeUndiciDispatcher = async () => {
        const d: any = undiciDispatcher as any;
        if (!d) return;
        try {
          if (typeof d.close === 'function') {
            await d.close();
          } else if (typeof d.destroy === 'function') {
            d.destroy();
          }
        } finally {
          undiciDispatcher = null;
        }
      };

      const stop = async () => {
        await this.proxyServer.stop();
        this.configManager.stopPolling();
        nodeAgents?.http?.destroy?.();
        nodeAgents?.https?.destroy?.();
        nodeAgents = null;
        await closeUndiciDispatcher();
        undiciFetchFn = null;
        this.connection = null;
        this.started = false;
      };

      // Launch browser if Playwright was requested
      let launchedBrowser: any = undefined;
      let browserCdpUrl: string | undefined;
      if (browserInstance) {
        const proxySettings = toPlaywrightProxySettings(url);
        const cdpPort = await AluviaClient.findFreePort();
        launchedBrowser = await browserInstance.launch({
          proxy: proxySettings,
          headless: this.options.headless !== false,
          args: [`--remote-debugging-port=${cdpPort}`],
        });
        browserCdpUrl = `http://127.0.0.1:${cdpPort}`;
      }

      const stopWithBrowser = async () => {
        if (launchedBrowser) await launchedBrowser.close();
        await stop();
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
        asNodeAgents: () => getNodeAgents(),
        asAxiosConfig: () => toAxiosConfig(getNodeAgents()),
        asGotOptions: () => toGotOptions(getNodeAgents()),
        asUndiciDispatcher: () => getUndiciDispatcher(),
        asUndiciFetch: () => {
          if (!undiciFetchFn) {
            undiciFetchFn = createUndiciFetch(getUndiciDispatcher());
          }
          return undiciFetchFn;
        },
        browser: launchedBrowser,
        cdpUrl: browserCdpUrl,
        stop: stopWithBrowser,
        close: stopWithBrowser,
      };

      this.connection = connection;
      this.started = true;

      return connection;
    })();

    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  /**
   * Global cleanup:
   * - Stop the local proxy server (if running).
   * - Stop config polling.
   */
  async stop(): Promise<void> {
    // If start is in-flight, wait for it to settle so we don't leave a running proxy behind.
    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // ignore startup errors; if startup failed there is nothing to stop
      }
    }

    if (!this.started) {
      return;
    }

    // Only stop proxy if it was potentially started.
    if (this.options.localProxy) {
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
    await this.configManager.setConfig({ rules: rules });
  }

  /**
   * Update the upstream session_id.
   * @param sessionId
   */
  async updateSessionId(sessionId: string): Promise<void> {
    await this.configManager.setConfig({ session_id: sessionId });
  }

  /**
   * Update the upstream target_geo (geo targeting).
   *
   * Pass null to clear geo targeting.
   */
  async updateTargetGeo(targetGeo: string | null): Promise<void> {
    if (targetGeo === null) {
      await this.configManager.setConfig({ target_geo: null });
      return;
    }

    const trimmed = targetGeo.trim();
    await this.configManager.setConfig({ target_geo: trimmed.length > 0 ? trimmed : null });
  }

  /**
   * Find a free TCP port by briefly binding to port 0.
   */
  private static findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  }
}
