// ProxyServer - Local HTTP proxy using proxy-chain

import { Server as ProxyChainServer } from 'proxy-chain';
import type { AddressInfo } from 'net';
import type { ConfigManager } from './ConfigManager.js';
import type { LogLevel } from './types.js';
import { Logger } from './logger.js';
import { ProxyStartError } from './errors.js';
import { shouldProxy } from './rules.js';

/**
 * Result of starting the proxy server.
 */
export type ProxyServerInfo = {
  host: string;
  port: number;
  url: string;
};

/**
 * ProxyServer manages the local HTTP(S) proxy that routes traffic
 * through Aluvia or directly based on rules.
 */
export class ProxyServer {
  private server: ProxyChainServer | null = null;
  private readonly configManager: ConfigManager;
  private readonly logger: Logger;
  private readonly bindHost = '127.0.0.1';

  constructor(
    configManager: ConfigManager,
    options?: { logLevel?: LogLevel }
  ) {
    this.configManager = configManager;
    this.logger = new Logger(options?.logLevel ?? 'info');
  }

  /**
   * Start the local proxy server.
   *
   * @param port - Optional port to listen on. If not provided, OS assigns a free port.
   * @returns ProxyServerInfo with host, port, and url
   * @throws ProxyStartError if server fails to start
   */
  async start(port?: number): Promise<ProxyServerInfo> {
    const listenPort = port ?? 0;

    try {
      this.server = new ProxyChainServer({
        // Security: bind to loopback only (proxy-chain defaults to 0.0.0.0 if host is omitted)
        host: this.bindHost,
        port: listenPort,
        prepareRequestFunction: this.handleRequest.bind(this),
      });

      await this.server.listen();

      // Get the actual port (especially important when port was 0)
      const address = this.server.server.address() as AddressInfo;
      const actualPort = address.port;

      const info: ProxyServerInfo = {
        host: this.bindHost,
        port: actualPort,
        url: `http://${this.bindHost}:${actualPort}`,
      };

      this.logger.info(`Proxy server listening on ${info.url}`);
      return info;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ProxyStartError(`Failed to start proxy server: ${message}`);
    }
  }

  /**
   * Stop the local proxy server.
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    try {
      await this.server.close(true);
      this.logger.info('Proxy server stopped');
    } finally {
      this.server = null;
    }
  }

  /**
   * Handle incoming proxy requests.
   * Decides whether to route through Aluvia or direct.
   */
  private handleRequest(params: {
    request: { url?: string };
    hostname?: string;
    port?: number;
    isHttp?: boolean;
  }): { upstreamProxyUrl: string } | undefined {
    // Get current config
    const config = this.configManager.getConfig();

    if (!config) {
      this.logger.warn('No config available, bypassing proxy (direct)');
      return undefined;
    }

    // Extract hostname
    const hostname = this.extractHostname(params);

    if (!hostname) {
      this.logger.debug('Could not extract hostname, going direct');
      return undefined;
    }

    // Check if we should proxy this hostname
    const useProxy = shouldProxy(hostname, config.rules);

    if (!useProxy) {
      this.logger.debug(`Hostname ${hostname} bypassing proxy (direct)`);
      return undefined;
    }

    // Build upstream proxy URL
    const { protocol, host, port, username, password } = config.rawProxy;
    const upstreamProxyUrl = `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;

    this.logger.debug(`Hostname ${hostname} routing through Aluvia`);

    return { upstreamProxyUrl };
  }

  /**
   * Extract hostname from request parameters.
   */
  private extractHostname(params: {
    request: { url?: string };
    hostname?: string;
    port?: number;
    isHttp?: boolean;
  }): string | null {
    // For CONNECT requests (HTTPS), hostname is provided directly
    if (params.hostname) {
      return params.hostname;
    }

    // For HTTP requests, try to parse from URL
    if (params.request?.url) {
      try {
        const url = new URL(params.request.url);
        return url.hostname;
      } catch {
        // Invalid URL, return null
      }
    }

    return null;
  }
}

