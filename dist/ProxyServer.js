"use strict";
// ProxyServer - Local HTTP proxy using proxy-chain
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyServer = void 0;
const proxy_chain_1 = require("proxy-chain");
const logger_1 = require("./logger");
const errors_1 = require("./errors");
const rules_1 = require("./rules");
/**
 * ProxyServer manages the local HTTP(S) proxy that routes traffic
 * through Aluvia or directly based on rules.
 */
class ProxyServer {
    constructor(configManager, options) {
        this.server = null;
        this.configManager = configManager;
        this.logger = new logger_1.Logger(options?.logLevel ?? 'info');
    }
    /**
     * Start the local proxy server.
     *
     * @param port - Optional port to listen on. If not provided, OS assigns a free port.
     * @returns ProxyServerInfo with host, port, and url
     * @throws ProxyStartError if server fails to start
     */
    async start(port) {
        const listenPort = port ?? 0;
        try {
            this.server = new proxy_chain_1.Server({
                port: listenPort,
                prepareRequestFunction: this.handleRequest.bind(this),
            });
            await this.server.listen();
            // Get the actual port (especially important when port was 0)
            const address = this.server.server.address();
            const actualPort = address.port;
            const info = {
                host: '127.0.0.1',
                port: actualPort,
                url: `http://127.0.0.1:${actualPort}`,
            };
            this.logger.info(`Proxy server listening on ${info.url}`);
            return info;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new errors_1.ProxyStartError(`Failed to start proxy server: ${message}`);
        }
    }
    /**
     * Stop the local proxy server.
     */
    async stop() {
        if (!this.server) {
            return;
        }
        try {
            await this.server.close(true);
            this.logger.info('Proxy server stopped');
        }
        finally {
            this.server = null;
        }
    }
    /**
     * Handle incoming proxy requests.
     * Decides whether to route through Aluvia or direct.
     */
    handleRequest(params) {
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
        const useProxy = (0, rules_1.shouldProxy)(hostname, config.rules);
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
    extractHostname(params) {
        // For CONNECT requests (HTTPS), hostname is provided directly
        if (params.hostname) {
            return params.hostname;
        }
        // For HTTP requests, try to parse from URL
        if (params.request?.url) {
            try {
                const url = new URL(params.request.url);
                return url.hostname;
            }
            catch {
                // Invalid URL, return null
            }
        }
        return null;
    }
}
exports.ProxyServer = ProxyServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJveHlTZXJ2ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvUHJveHlTZXJ2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLG1EQUFtRDs7O0FBRW5ELDZDQUF5RDtBQUl6RCxxQ0FBa0M7QUFDbEMscUNBQTJDO0FBQzNDLG1DQUFzQztBQVd0Qzs7O0dBR0c7QUFDSCxNQUFhLFdBQVc7SUFLdEIsWUFDRSxhQUE0QixFQUM1QixPQUFpQztRQU4zQixXQUFNLEdBQTRCLElBQUksQ0FBQztRQVE3QyxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksZUFBTSxDQUFDLE9BQU8sRUFBRSxRQUFRLElBQUksTUFBTSxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBYTtRQUN2QixNQUFNLFVBQVUsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDO1FBRTdCLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxvQkFBZ0IsQ0FBQztnQkFDakMsSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLHNCQUFzQixFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQzthQUN0RCxDQUFDLENBQUM7WUFFSCxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7WUFFM0IsNkRBQTZEO1lBQzdELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBaUIsQ0FBQztZQUM1RCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO1lBRWhDLE1BQU0sSUFBSSxHQUFvQjtnQkFDNUIsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSxVQUFVO2dCQUNoQixHQUFHLEVBQUUsb0JBQW9CLFVBQVUsRUFBRTthQUN0QyxD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QUFPLEdBQUcsQ0FBQyxRQUFRLENBQUM7WUFDdEIsQ0FBQztZQUFDLE1BQU0sQ0FBQztnQkFDUCwyQkFBMkI7WUFDN0IsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQXZJRCxrQ0F1SUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBQcm94eVNlcnZlciAtIExvY2FsIEhUVFAgcHJveHkgdXNpbmcgcHJveHktY2hhaW5cblxuaW1wb3J0IHsgU2VydmVyIGFzIFByb3h5Q2hhaW5TZXJ2ZXIgfSBmcm9tICdwcm94eS1jaGFpbic7XG5pbXBvcnQgdHlwZSB7IEFkZHJlc3NJbmZvIH0gZnJvbSAnbmV0JztcbmltcG9ydCB0eXBlIHsgQ29uZmlnTWFuYWdlciB9IGZyb20gJy4vQ29uZmlnTWFuYWdlcic7XG5pbXBvcnQgdHlwZSB7IExvZ0xldmVsIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuL2xvZ2dlcic7XG5pbXBvcnQgeyBQcm94eVN0YXJ0RXJyb3IgfSBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgeyBzaG91bGRQcm94eSB9IGZyb20gJy4vcnVsZXMnO1xuXG4vKipcbiAqIFJlc3VsdCBvZiBzdGFydGluZyB0aGUgcHJveHkgc2VydmVyLlxuICovXG5leHBvcnQgdHlwZSBQcm94eVNlcnZlckluZm8gPSB7XG4gIGhvc3Q6IHN0cmluZztcbiAgcG9ydDogbnVtYmVyO1xuICB1cmw6IHN0cmluZztcbn07XG5cbi8qKlxuICogUHJveHlTZXJ2ZXIgbWFuYWdlcyB0aGUgbG9jYWwgSFRUUChTKSBwcm94eSB0aGF0IHJvdXRlcyB0cmFmZmljXG4gKiB0aHJvdWdoIEFsdXZpYSBvciBkaXJlY3RseSBiYXNlZCBvbiBydWxlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFByb3h5U2VydmVyIHtcbiAgcHJpdmF0ZSBzZXJ2ZXI6IFByb3h5Q2hhaW5TZXJ2ZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByZWFkb25seSBjb25maWdNYW5hZ2VyOiBDb25maWdNYW5hZ2VyO1xuICBwcml2YXRlIHJlYWRvbmx5IGxvZ2dlcjogTG9nZ2VyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbmZpZ01hbmFnZXI6IENvbmZpZ01hbmFnZXIsXG4gICAgb3B0aW9ucz86IHsgbG9nTGV2ZWw/OiBMb2dMZXZlbCB9XG4gICkge1xuICAgIHRoaXMuY29uZmlnTWFuYWdlciA9IGNvbmZpZ01hbmFnZXI7XG4gICAgdGhpcy5sb2dnZXIgPSBuZXcgTG9nZ2VyKG9wdGlvbnM/LmxvZ0xldmVsID8/ICdpbmZvJyk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgdGhlIGxvY2FsIHByb3h5IHNlcnZlci5cbiAgICpcbiAgICogQHBhcmFtIHBvcnQgLSBPcHRpb25hbCBwb3J0IHRvIGxpc3RlbiBvbi4gSWYgbm90IHByb3ZpZGVkLCBPUyBhc3NpZ25zIGEgZnJlZSBwb3J0LlxuICAgKiBAcmV0dXJucyBQcm94eVNlcnZlckluZm8gd2l0aCBob3N0LCBwb3J0LCBhbmQgdXJsXG4gICAqIEB0aHJvd3MgUHJveHlTdGFydEVycm9yIGlmIHNlcnZlciBmYWlscyB0byBzdGFydFxuICAgKi9cbiAgYXN5bmMgc3RhcnQocG9ydD86IG51bWJlcik6IFByb21pc2U8UHJveHlTZXJ2ZXJJbmZvPiB7XG4gICAgY29uc3QgbGlzdGVuUG9ydCA9IHBvcnQgPz8gMDtcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLnNlcnZlciA9IG5ldyBQcm94eUNoYWluU2VydmVyKHtcbiAgICAgICAgcG9ydDogbGlzdGVuUG9ydCxcbiAgICAgICAgcHJlcGFyZVJlcXVlc3RGdW5jdGlvbjogdGhpcy5oYW5kbGVSZXF1ZXN0LmJpbmQodGhpcyksXG4gICAgICB9KTtcblxuICAgICAgYXdhaXQgdGhpcy5zZXJ2ZXIubGlzdGVuKCk7XG5cbiAgICAgIC8vIEdldCB0aGUgYWN0dWFsIHBvcnQgKGVzcGVjaWFsbHkgaW1wb3J0YW50IHdoZW4gcG9ydCB3YXMgMClcbiAgICAgIGNvbnN0IGFkZHJlc3MgPSB0aGlzLnNlcnZlci5zZXJ2ZXIuYWRkcmVzcygpIGFzIEFkZHJlc3NJbmZvO1xuICAgICAgY29uc3QgYWN0dWFsUG9ydCA9IGFkZHJlc3MucG9ydDtcblxuICAgICAgY29uc3QgaW5mbzogUHJveHlTZXJ2ZXJJbmZvID0ge1xuICAgICAgICBob3N0OiAnMTI3LjAuMC4xJyxcbiAgICAgICAgcG9ydDogYWN0dWFsUG9ydCxcbiAgICAgICAgdXJsOiBgaHR0cDovLzEyNy4wLjAuMToke2FjdHVhbFBvcnR9YCxcbiAgICAgIH07XG5cbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oYFByb3h5IHNlcnZlciBsaXN0ZW5pbmcgb24gJHtpbmZvLnVybH1gKTtcbiAgICAgIHJldHVybiBpbmZvO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBtZXNzYWdlID1cbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcic7XG4gICAgICB0aHJvdyBuZXcgUHJveHlTdGFydEVycm9yKGBGYWlsZWQgdG8gc3RhcnQgcHJveHkgc2VydmVyOiAke21lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN0b3AgdGhlIGxvY2FsIHByb3h5IHNlcnZlci5cbiAgICovXG4gIGFzeW5jIHN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCF0aGlzLnNlcnZlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnNlcnZlci5jbG9zZSh0cnVlKTtcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ1Byb3h5IHNlcnZlciBzdG9wcGVkJyk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuc2VydmVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGluY29taW5nIHByb3h5IHJlcXVlc3RzLlxuICAgKiBEZWNpZGVzIHdoZXRoZXIgdG8gcm91dGUgdGhyb3VnaCBBbHV2aWEgb3IgZGlyZWN0LlxuICAgKi9cbiAgcHJpdmF0ZSBoYW5kbGVSZXF1ZXN0KHBhcmFtczoge1xuICAgIHJlcXVlc3Q6IHsgdXJsPzogc3RyaW5nIH07XG4gICAgaG9zdG5hbWU/OiBzdHJpbmc7XG4gICAgcG9ydD86IG51bWJlcjtcbiAgICBpc0h0dHA/OiBib29sZWFuO1xuICB9KTogeyB1cHN0cmVhbVByb3h5VXJsOiBzdHJpbmcgfSB8IHVuZGVmaW5lZCB7XG4gICAgLy8gR2V0IGN1cnJlbnQgY29uZmlnXG4gICAgY29uc3QgY29uZmlnID0gdGhpcy5jb25maWdNYW5hZ2VyLmdldENvbmZpZygpO1xuXG4gICAgaWYgKCFjb25maWcpIHtcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oJ05vIGNvbmZpZyBhdmFpbGFibGUsIGJ5cGFzc2luZyBwcm94eSAoZGlyZWN0KScpO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBFeHRyYWN0IGhvc3RuYW1lXG4gICAgY29uc3QgaG9zdG5hbWUgPSB0aGlzLmV4dHJhY3RIb3N0bmFtZShwYXJhbXMpO1xuXG4gICAgaWYgKCFob3N0bmFtZSkge1xuICAgICAgdGhpcy5sb2dnZXIuZGVidWcoJ0NvdWxkIG5vdCBleHRyYWN0IGhvc3RuYW1lLCBnb2luZyBkaXJlY3QnKTtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgd2Ugc2hvdWxkIHByb3h5IHRoaXMgaG9zdG5hbWVcbiAgICBjb25zdCB1c2VQcm94eSA9IHNob3VsZFByb3h5KGhvc3RuYW1lLCBjb25maWcucnVsZXMpO1xuXG4gICAgaWYgKCF1c2VQcm94eSkge1xuICAgICAgdGhpcy5sb2dnZXIuZGVidWcoYEhvc3RuYW1lICR7aG9zdG5hbWV9IGJ5cGFzc2luZyBwcm94eSAoZGlyZWN0KWApO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCB1cHN0cmVhbSBwcm94eSBVUkxcbiAgICBjb25zdCB7IHByb3RvY29sLCBob3N0LCBwb3J0LCB1c2VybmFtZSwgcGFzc3dvcmQgfSA9IGNvbmZpZy5yYXdQcm94eTtcbiAgICBjb25zdCB1cHN0cmVhbVByb3h5VXJsID0gYCR7cHJvdG9jb2x9Oi8vJHtlbmNvZGVVUklDb21wb25lbnQodXNlcm5hbWUpfToke2VuY29kZVVSSUNvbXBvbmVudChwYXNzd29yZCl9QCR7aG9zdH06JHtwb3J0fWA7XG5cbiAgICB0aGlzLmxvZ2dlci5kZWJ1ZyhgSG9zdG5hbWUgJHtob3N0bmFtZX0gcm91dGluZyB0aHJvdWdoIEFsdXZpYWApO1xuXG4gICAgcmV0dXJuIHsgdXBzdHJlYW1Qcm94eVVybCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgaG9zdG5hbWUgZnJvbSByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RIb3N0bmFtZShwYXJhbXM6IHtcbiAgICByZXF1ZXN0OiB7IHVybD86IHN0cmluZyB9O1xuICAgIGhvc3RuYW1lPzogc3RyaW5nO1xuICAgIHBvcnQ/OiBudW1iZXI7XG4gICAgaXNIdHRwPzogYm9vbGVhbjtcbiAgfSk6IHN0cmluZyB8IG51bGwge1xuICAgIC8vIEZvciBDT05ORUNUIHJlcXVlc3RzIChIVFRQUyksIGhvc3RuYW1lIGlzIHByb3ZpZGVkIGRpcmVjdGx5XG4gICAgaWYgKHBhcmFtcy5ob3N0bmFtZSkge1xuICAgICAgcmV0dXJuIHBhcmFtcy5ob3N0bmFtZTtcbiAgICB9XG5cbiAgICAvLyBGb3IgSFRUUCByZXF1ZXN0cywgdHJ5IHRvIHBhcnNlIGZyb20gVVJMXG4gICAgaWYgKHBhcmFtcy5yZXF1ZXN0Py51cmwpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocGFyYW1zLnJlcXVlc3QudXJsKTtcbiAgICAgICAgcmV0dXJuIHVybC5ob3N0bmFtZTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBJbnZhbGlkIFVSTCwgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4iXX0=