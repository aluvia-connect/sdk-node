import type { AgentConnectClientOptions, AgentConnectSession } from './types';
/**
 * AgentConnectClient is the main entry point for the Aluvia Agent Connect Node client.
 *
 * It manages the local proxy server and configuration polling.
 */
export declare class AgentConnectClient {
    private readonly options;
    private readonly configManager;
    private readonly proxyServer;
    private session;
    private started;
    constructor(options: AgentConnectClientOptions);
    /**
     * Start the Agent Connect session:
     * - Fetch initial /user config from Aluvia.
     * - Start polling for config updates.
     * - Start a local HTTP(S) proxy on 127.0.0.1:<localPort or free port>.
     *
     * Returns the active session with host/port/url and a stop() method.
     */
    start(): Promise<AgentConnectSession>;
    /**
     * Global cleanup:
     * - Stop the local proxy server (if running).
     * - Stop config polling.
     */
    stop(): Promise<void>;
}
