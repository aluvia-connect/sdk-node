// ConfigManager - Control plane for connection configuration

import type { GatewayProtocol, LogLevel } from './types.js';
import { Logger } from './logger.js';
import {
  getAccountConnection,
  createAccountConnection,
  patchAccountConnection,
} from './httpClient.js';
import { InvalidApiKeyError, ApiError } from './errors.js';

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
  /**
   * ETag returned by the API for this config snapshot (if present).
   * Used for efficient conditional GET /user polling via If-None-Match.
   */
  etag: string | null;
};

/**
 * Options for ConfigManager constructor.
 */
export type ConfigManagerOptions = {
  apiKey: string;
  apiBaseUrl: string;
  pollIntervalMs: number;
  gatewayProtocol: GatewayProtocol;
  gatewayPort: number;
  logLevel: LogLevel;

  /**
   * Optional: if provided, use /account/connections/:id.
   * If omitted, init() will attempt POST /account/connections (then may fall back to legacy /connection).
   */
  connectionId?: number;
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

  private accountConnectionId: number | null = null;

  constructor(options: ConfigManagerOptions) {
    this.options = options;
    this.logger = new Logger(options.logLevel);
  }

  /**
   * Fetch initial configuration from /connection endpoint.
   * Must be called before starting the proxy.
   *
   * @throws InvalidApiKeyError if apiKey is invalid (401/403)
   * @throws ApiError for other API errors
   */
  async init(): Promise<void> {
    // Prefer account-connections behavior (new SDK semantics), with legacy fallback for compatibility.
    const hasExplicitId = typeof this.options.connectionId === 'number';

    if (hasExplicitId) {
      this.accountConnectionId = this.options.connectionId ?? null;
      this.logger.info(`Using account connection API (connection id: ${this.accountConnectionId})`);
      const result = await getAccountConnection(
        this.options.apiBaseUrl,
        this.options.apiKey,
        this.accountConnectionId as number,
      );

      if (result.status === 401 || result.status === 403) {
        throw new InvalidApiKeyError(`Authentication failed with status ${result.status}`);
      }

      if (result.status === 200 && result.body) {
        this.config = this.buildConfigFromAny(result.body, result.etag);
        this.logger.info('Configuration loaded successfully');
        this.logger.debug('Config summary:', this.redactConfig(this.config));
        return;
      }

      throw new ApiError(`Failed to fetch account connection config: HTTP ${result.status}`, result.status);
    }

    // No connection_id: create an account connection (preferred)
    this.logger.info('No connection_id provided; creating account connection...');
    try {
      const created = await createAccountConnection(
        this.options.apiBaseUrl,
        this.options.apiKey,
        {},
      );

      if (created.status === 401 || created.status === 403) {
        throw new InvalidApiKeyError(`Authentication failed with status ${created.status}`);
      }

      if ((created.status === 200 || created.status === 201) && created.body) {
        // best-effort extract id for polling/patching
        const maybeId =
          (created.body as any)?.data?.id ??
          (created.body as any)?.data?.connection_id ??
          null;

        this.accountConnectionId = typeof maybeId === 'number' ? maybeId : null;

        if (this.accountConnectionId != null) {
          this.logger.info(`Account connection created (connection id: ${this.accountConnectionId})`);
        } else {
          this.logger.info('Account connection created (connection id unavailable in response)');
        }

        this.config = this.buildConfigFromAny(created.body, created.etag);
        this.logger.info('Configuration loaded successfully');
        this.logger.debug('Config summary:', this.redactConfig(this.config));
        return;
      }

      // If POST not supported, fall back below.
      this.logger.warn(`Create account connection returned HTTP ${created.status}`);
    } catch (e) {
      // If create failed due to network/5xx/etc, fall back to legacy for compatibility.
      this.logger.warn('Create account connection failed');
    }
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
    if (typeof this.accountConnectionId !== 'number') {
      throw new ApiError('No account connection ID available');
    }

    try {
      const result = await patchAccountConnection(
          this.options.apiBaseUrl,
          this.options.apiKey,
          this.accountConnectionId,
          body,
        );

      if (result.status === 200 && result.body) {
        this.config = this.buildConfigFromAny(result.body, result.etag);
        this.logger.debug('Configuration updated from API');
        this.logger.debug('New config summary:', this.redactConfig(this.config));
        return this.config;
      }

      this.logger.warn(`Poll returned unexpected status ${result.status}`);
    } catch (error) {
      this.logger.warn('Poll failed, keeping existing config:', error);
    }
    return this.config;
  }

  /**
   * Perform a single poll iteration.
   * Called by the polling timer.
   */
  private async pollOnce(): Promise<void> {
    if (!this.config) {
      this.logger.warn('No config available, skipping poll');
      return;
    }
    if (typeof this.accountConnectionId !== 'number') {
      this.logger.warn('No account connection ID available, skipping poll');
      return;
    }

    try {
      const result = await getAccountConnection(
        this.options.apiBaseUrl,
        this.options.apiKey,
        this.accountConnectionId,
        this.config.etag,
      );

      if (result.status === 304) {
        this.logger.debug('Config unchanged (304 Not Modified)');
        return;
      }

      if (result.status === 200 && result.body) {
        this.config = this.buildConfigFromAny(result.body, result.etag);
        this.logger.debug('Configuration updated from API');
        this.logger.debug('New config summary:', this.redactConfig(this.config));
        return;
      }

      this.logger.warn(`Poll returned unexpected status ${result.status}`);
    } catch (error) {
      this.logger.warn('Poll failed, keeping existing config:', error);
    }
  }

  /**
   * Build ConnectionNetworkConfig from API response.
   */
  private buildConfigFromAny(body: any, etag: string | null): ConnectionNetworkConfig {
    // Legacy shape: { data: { proxy_username, proxy_password, rules, session_id, target_geo } }
    const legacy = body?.data?.proxy_username && body?.data?.proxy_password;

    if (legacy) {
      return {
        rawProxy: {
          protocol: this.options.gatewayProtocol,
          host: 'gateway.aluvia.io',
          port: this.options.gatewayPort,
          username: body.data.proxy_username,
          password: body.data.proxy_password,
        },
        rules: body.data.rules ?? [],
        sessionId: body.data.session_id ?? null,
        targetGeo: body.data.target_geo ?? null,
        etag,
      };
    }

    // Account-connections: accept either explicit proxy creds OR a "playwright" object.
    const data = body?.data ?? {};

    const rules: string[] = data.rules ?? [];
    const sessionId: string | null = data.session_id ?? data.sessionId ?? null;
    const targetGeo: string | null = data.target_geo ?? data.targetGeo ?? null;

    // Prefer explicit proxy creds if present
    const username: string | null = data.proxy_username ?? data.proxyUsername ?? data.username ?? null;
    const password: string | null = data.proxy_password ?? data.proxyPassword ?? data.password ?? null;

    // Or accept playwright: { server, username, password }
    const playwright = data.playwright ?? null;

    const resolvedProtocol: GatewayProtocol = this.options.gatewayProtocol;
    let resolvedHost: 'gateway.aluvia.io' = 'gateway.aluvia.io';
    let resolvedPort: number = this.options.gatewayPort;
    let resolvedUser: string | null = username;
    let resolvedPass: string | null = password;

    if ((!resolvedUser || !resolvedPass) && playwright?.server) {
      try {
        const u = new URL(playwright.server);
        // host/port from server (credentials never logged)
        resolvedHost = 'gateway.aluvia.io'; // keep internal invariant for ProxyServer; URL host used only by adapters
        resolvedPort = u.port ? Number(u.port) : resolvedPort;
        resolvedUser = playwright.username ?? null;
        resolvedPass = playwright.password ?? null;
      } catch {
        // ignore; will fail below if creds missing
      }
    }

    if (!resolvedUser || !resolvedPass) {
      throw new ApiError(
        'Account connection response missing proxy credentials (proxy_username/proxy_password or playwright.username/password)',
        500,
      );
    }

    return {
      rawProxy: {
        protocol: resolvedProtocol,
        host: resolvedHost,
        port: resolvedPort,
        username: resolvedUser,
        password: resolvedPass,
      },
      rules,
      sessionId,
      targetGeo,
      etag,
    };
  }

  private redactConfig(config: ConnectionNetworkConfig | null): object | null {
    if (!config) return null;
    return {
      rulesCount: config.rules?.length ?? 0,
      sessionId: config.sessionId,
      targetGeo: config.targetGeo,
      etag: config.etag,
      rawProxy: {
        protocol: config.rawProxy.protocol,
        host: config.rawProxy.host,
        port: config.rawProxy.port,
        username: config.rawProxy.username ? '[set]' : '[missing]',
        password: config.rawProxy.password ? '[set]' : '[missing]',
      },
    };
  }
}
