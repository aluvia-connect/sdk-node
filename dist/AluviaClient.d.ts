import type { AluviaClientOptions, AluviaClientSession } from './types';
/**
 * AluviaClient is the main entry point for the Aluvia Client.
 *
 * It manages the local proxy server and configuration polling.
 */
export declare class AluviaClient {
    private readonly options;
    private readonly configManager;
    private readonly proxyServer;
    private session;
    private started;
    constructor(options: AluviaClientOptions);
    /**
     * Start the Aluvia Client session:
     * - Fetch initial /user config from Aluvia.
     * - Start polling for config updates.
     * - Start a local HTTP(S) proxy on 127.0.0.1:<localPort or free port>.
     *
     * Returns the active session with host/port/url and a stop() method.
     */
    start(): Promise<AluviaClientSession>;
    /**
     * Global cleanup:
     * - Stop the local proxy server (if running).
     * - Stop config polling.
     */
    stop(): Promise<void>;
}
