// ConfigManager - Control plane for connection configuration

import type { GatewayProtocol, LogLevel } from './types.js';
import { Logger } from './logger.js';
import { getConnection, setConnection } from './httpClient.js';
import { InvalidConnectionTokenError, ApiError } from './errors.js';

// Config types

/**
 * Raw proxy configuration derived from /connection response and client options.
 */
export type RawProxyConfig = {
  protocol: GatewayProtocol;
  host: 'gateway.aluvia.io';
  port: number;
  username: string;
  password: string;
};

/**
 * Complete connection network configuration including proxy, rules, and metadata.
 */
export type ConnectionNetworkConfig = {
  rawProxy: RawProxyConfig;
  rules: string[];
  sessionId: string | null;
  targetGeo: string | null;
};

/**
 * Options for ConfigManager constructor.
 */
export type ConfigManagerOptions = {
  token: string;
  apiBaseUrl: string;
  pollIntervalMs: number;
  gatewayProtocol: GatewayProtocol;
  gatewayPort: number;
  logLevel: LogLevel;
};

/**
 * ConfigManager handles fetching and maintaining connection configuration from the Aluvia API.
 *
 * Responsibilities:
 * - Initial fetch of /connection config
 * - Polling for updates using ETag
 * - Providing current config to ProxyServer
 */
export class ConfigManager {
  private config: ConnectionNetworkConfig | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly logger: Logger;
  private readonly options: ConfigManagerOptions;

  constructor(options: ConfigManagerOptions) {
    this.options = options;
    this.logger = new Logger(options.logLevel);
  }

  /**
   * Fetch initial configuration from /connection endpoint.
   * Must be called before starting the proxy.
   *
   * @throws InvalidConnectionTokenError if token is invalid (401/403)
   * @throws ApiError for other API errors
   */
  async init(): Promise<void> {
    this.logger.info('Fetching initial configuration from Aluvia API...');

    const result = await getConnection(this.options.apiBaseUrl, this.options.token);

    // Handle authentication errors
    if (result.status === 401 || result.status === 403) {
      throw new InvalidConnectionTokenError(
        `Authentication failed with status ${result.status}`
      );
    }

    // Handle successful response
    if (result.status === 200 && result.body) {
      this.config = this.buildConfig(result.body);
      this.logger.info('Configuration loaded successfully');
      this.logger.debug('Config:', this.config);
      return;
    }

    // Handle other errors
    throw new ApiError(
      `Failed to fetch connection config: HTTP ${result.status}`,
      result.status
    );
  }

  /**
   * Start polling for configuration updates.
   * Uses ETag for efficient conditional requests.
   */
  startPolling(): void {
    // Don't start if already polling
    if (this.timer) {
      this.logger.debug('Polling already active, skipping startPolling()');
      return;
    }

    this.logger.info(
      `Starting config polling every ${this.options.pollIntervalMs}ms`
    );

    this.timer = setInterval(async () => {
      await this.pollOnce();
    }, this.options.pollIntervalMs);
  }

  /**
   * Stop polling for configuration updates.
   */
  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('Config polling stopped');
    }
  }

  /**
   * Get the current configuration.
   * Returns null if init() hasn't been called or failed.
   */
  getConfig(): ConnectionNetworkConfig | null {
    return this.config;
  }

  async setConfig(body: Object): Promise<ConnectionNetworkConfig | null> {
    this.logger.debug(`Setting config: ${JSON.stringify(body)}`);
    try {
      const result = await setConnection(
        this.options.apiBaseUrl,
        this.options.token,
        body,
      );

      // 200 OK - config updated
      if (result.status === 200 && result.body) {
        this.config = this.buildConfig(result.body);
        this.logger.debug('Configuration updated from API');
        this.logger.debug('New config:', this.config);
        return this.config;
      }

      // Other status codes - log warning but keep old config
      this.logger.warn(`Poll returned unexpected status ${result.status}`);
    } catch (error) {
      // Network or other errors - log warning but keep old config
      this.logger.warn('Poll failed, keeping existing config:', error);
    }
    return this.config;
  }

  /**
   * Perform a single poll iteration.
   * Called by the polling timer.
   */
  private async pollOnce(): Promise<void> {
    // Skip if no config (shouldn't happen after init)
    if (!this.config) {
      this.logger.warn('No config available, skipping poll');
      return;
    }

    try {
      const result = await getConnection(
        this.options.apiBaseUrl,
        this.options.token,
      );

      // 304 Not Modified - config unchanged
      if (result.status === 304) {
        this.logger.debug('Config unchanged (304 Not Modified)');
        return;
      }

      // 200 OK - config updated
      if (result.status === 200 && result.body) {
        this.config = this.buildConfig(result.body);
        this.logger.debug('Configuration updated from API');
        this.logger.debug('New config:', this.config);
        return;
      }

      // Other status codes - log warning but keep old config
      this.logger.warn(`Poll returned unexpected status ${result.status}`);
    } catch (error) {
      // Network or other errors - log warning but keep old config
      this.logger.warn('Poll failed, keeping existing config:', error);
    }
  }

  /**
   * Build ConnectionNetworkConfig from API response.
   */
  private buildConfig(
    body: {
      data: {
        proxy_username: string;
        proxy_password: string;
        rules: string[];
        session_id: string | null;
        target_geo: string | null;
      }
  }
  ): ConnectionNetworkConfig {
    return {
      rawProxy: {
        protocol: this.options.gatewayProtocol,
        host: 'gateway.aluvia.io',
        port: this.options.gatewayPort,
        username: body.data.proxy_username,
        password: body.data.proxy_password,
      },
      rules: body.data.rules,
      sessionId: body.data.session_id,
      targetGeo: body.data.target_geo,
    };
  }
}

