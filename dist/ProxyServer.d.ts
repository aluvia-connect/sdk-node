import type { ConfigManager } from './ConfigManager';
import type { LogLevel } from './types';
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
export declare class ProxyServer {
    private server;
    private readonly configManager;
    private readonly logger;
    constructor(configManager: ConfigManager, options?: {
        logLevel?: LogLevel;
    });
    /**
     * Start the local proxy server.
     *
     * @param port - Optional port to listen on. If not provided, OS assigns a free port.
     * @returns ProxyServerInfo with host, port, and url
     * @throws ProxyStartError if server fails to start
     */
    start(port?: number): Promise<ProxyServerInfo>;
    /**
     * Stop the local proxy server.
     */
    stop(): Promise<void>;
    /**
     * Handle incoming proxy requests.
     * Decides whether to route through Aluvia or direct.
     */
    private handleRequest;
    /**
     * Extract hostname from request parameters.
     */
    private extractHostname;
}
