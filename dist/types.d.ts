/**
 * Protocol used to connect to the Aluvia gateway.
 */
export type GatewayProtocol = 'http' | 'https';
/**
 * Log level for the client.
 */
export type LogLevel = 'silent' | 'info' | 'debug';
/**
 * Options for creating an AluviaClient instance.
 */
export type AluviaClientOptions = {
    /**
     * Required: user API token (Bearer).
     * This is the token for a single Aluvia user/agent.
     */
    token: string;
    /**
     * Optional: base URL for the Aluvia API.
     * Default: 'https://api.aluvia.io/v1'
     */
    apiBaseUrl?: string;
    /**
     * Optional: polling interval for refreshing /user config.
     * Default: 5000 ms.
     */
    pollIntervalMs?: number;
    /**
     * Optional: how the client talks to the Aluvia gateway.
     *
     * - 'http'  -> gatewayPort defaults to 8080
     * - 'https' -> gatewayPort defaults to 8443
     *
     * Default: 'http'.
     */
    gatewayProtocol?: GatewayProtocol;
    /**
     * Optional: upstream Aluvia gateway port.
     *
     * If omitted:
     *   - 8080 is used when gatewayProtocol === 'http'
     *   - 8443 is used when gatewayProtocol === 'https'
     */
    gatewayPort?: number;
    /**
     * Optional: local port for the agent's *local* proxy (127.0.0.1:<localPort>).
     *
     * If omitted, the client will pick a free port automatically by binding to port 0.
     */
    localPort?: number;
    /**
     * Optional: logging verbosity for the client.
     */
    logLevel?: LogLevel;
};
/**
 * Represents an active Aluvia Client session.
 */
export type AluviaClientSession = {
    /**
     * Local host where the proxy listens.
     * Always '127.0.0.1' for MVP.
     */
    host: string;
    /**
     * Local port where the proxy listens.
     * Either the user-provided localPort, or the OS-assigned free port.
     */
    port: number;
    /**
     * Convenience URL for the local proxy.
     * Example: 'http://127.0.0.1:54321'
     *
     * (The local proxy itself is always HTTP; it may tunnel to an HTTP or HTTPS
     * gateway upstream based on gatewayProtocol/gatewayPort.)
     */
    url: string;
    /**
     * Stop this proxy instance:
     * - Close the local proxy server.
     * - Stop using it for new connections.
     */
    stop(): Promise<void>;
};
