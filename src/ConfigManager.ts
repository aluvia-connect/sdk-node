// ConfigManager - Control plane for user configuration

import type { GatewayProtocol, LogLevel } from './types.js';
import { Logger } from './logger.js';
import { getUser } from './httpClient.js';
import { InvalidUserTokenError, ApiError } from './errors.js';

// Config types

/**
 * Raw proxy configuration derived from /user response and client options.
 */
export type RawProxyConfig = {
  protocol: GatewayProtocol;
  host: 'gateway.aluvia.io';
  port: number;
  username: string;
  password: string;
};

/**
 * Complete user network configuration including proxy, rules, and metadata.
 */
export type UserNetworkConfig = {
  rawProxy: RawProxyConfig;
  rules: string[];
  sessionId: string | null;
  targetGeo: string | null;
  etag: string | null;
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
 * ConfigManager handles fetching and maintaining user configuration from the Aluvia API.
 *
 * Responsibilities:
 * - Initial fetch of /user config
 * - Polling for updates using ETag
 * - Providing current config to ProxyServer
 */
export class ConfigManager {
  private config: UserNetworkConfig | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly logger: Logger;
  private readonly options: ConfigManagerOptions;

  constructor(options: ConfigManagerOptions) {
    this.options = options;
    this.logger = new Logger(options.logLevel);
  }

  /**
   * Fetch initial configuration from /user endpoint.
   * Must be called before starting the proxy.
   *
   * @throws InvalidUserTokenError if token is invalid (401/403)
   * @throws ApiError for other API errors
   */
  async init(): Promise<void> {
    this.logger.info('Fetching initial configuration from Aluvia API...');

    const result = await getUser(this.options.apiBaseUrl, this.options.token);

    // Handle authentication errors
    if (result.status === 401 || result.status === 403) {
      throw new InvalidUserTokenError(
        `Authentication failed with status ${result.status}`
      );
    }

    // Handle successful response
    if (result.status === 200 && result.body) {
      this.config = this.buildConfig(result.body, result.etag);
      this.logger.info('Configuration loaded successfully');
      this.logger.debug('Config:', this.config);
      return;
    }

    // Handle other errors
    throw new ApiError(
      `Failed to fetch user config: HTTP ${result.status}`,
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
  getConfig(): UserNetworkConfig | null {
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
      const result = await getUser(
        this.options.apiBaseUrl,
        this.options.token,
        this.config.etag ?? undefined
      );

      // 304 Not Modified - config unchanged
      if (result.status === 304) {
        this.logger.debug('Config unchanged (304 Not Modified)');
        return;
      }

      // 200 OK - config updated
      if (result.status === 200 && result.body) {
        this.config = this.buildConfig(result.body, result.etag);
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
   * Build UserNetworkConfig from API response.
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
  },
    etag: string | null
  ): UserNetworkConfig {
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
      etag,
    };
  }
}

