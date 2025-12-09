import type { GatewayProtocol, LogLevel } from './types';
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
export declare class ConfigManager {
    private config;
    private timer;
    private readonly logger;
    private readonly options;
    constructor(options: ConfigManagerOptions);
    /**
     * Fetch initial configuration from /user endpoint.
     * Must be called before starting the proxy.
     *
     * @throws InvalidUserTokenError if token is invalid (401/403)
     * @throws ApiError for other API errors
     */
    init(): Promise<void>;
    /**
     * Start polling for configuration updates.
     * Uses ETag for efficient conditional requests.
     */
    startPolling(): void;
    /**
     * Stop polling for configuration updates.
     */
    stopPolling(): void;
    /**
     * Get the current configuration.
     * Returns null if init() hasn't been called or failed.
     */
    getConfig(): UserNetworkConfig | null;
    /**
     * Perform a single poll iteration.
     * Called by the polling timer.
     */
    private pollOnce;
    /**
     * Build UserNetworkConfig from API response.
     */
    private buildConfig;
}
