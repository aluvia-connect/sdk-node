"use strict";
// AgentConnectClient - Main public class for Aluvia Agent Connect
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentConnectClient = void 0;
const ConfigManager_1 = require("./ConfigManager");
const ProxyServer_1 = require("./ProxyServer");
const errors_1 = require("./errors");
/**
 * AgentConnectClient is the main entry point for the Aluvia Agent Connect Node client.
 *
 * It manages the local proxy server and configuration polling.
 */
class AgentConnectClient {
    constructor(options) {
        this.session = null;
        this.started = false;
        // Validate token
        if (!options.token) {
            throw new errors_1.MissingUserTokenError('Aluvia user token is required');
        }
        this.options = options;
        // Apply defaults
        const apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io';
        const pollIntervalMs = options.pollIntervalMs ?? 5000;
        const gatewayProtocol = options.gatewayProtocol ?? 'http';
        const gatewayPort = options.gatewayPort ?? (gatewayProtocol === 'https' ? 8443 : 8080);
        const logLevel = options.logLevel ?? 'info';
        // Create ConfigManager
        this.configManager = new ConfigManager_1.ConfigManager({
            token: options.token,
            apiBaseUrl,
            pollIntervalMs,
            gatewayProtocol,
            gatewayPort,
            logLevel,
        });
        // Create ProxyServer
        this.proxyServer = new ProxyServer_1.ProxyServer(this.configManager, { logLevel });
    }
    /**
     * Start the Agent Connect session:
     * - Fetch initial /user config from Aluvia.
     * - Start polling for config updates.
     * - Start a local HTTP(S) proxy on 127.0.0.1:<localPort or free port>.
     *
     * Returns the active session with host/port/url and a stop() method.
     */
    async start() {
        // Return existing session if already started
        if (this.started && this.session) {
            return this.session;
        }
        // Fetch initial configuration (may throw InvalidUserTokenError or ApiError)
        await this.configManager.init();
        // Start the proxy server
        const { host, port, url } = await this.proxyServer.start(this.options.localPort);
        // Start polling for config updates
        this.configManager.startPolling();
        // Build session object
        const session = {
            host,
            port,
            url,
            stop: async () => {
                await this.proxyServer.stop();
                this.configManager.stopPolling();
                this.session = null;
                this.started = false;
            },
        };
        this.session = session;
        this.started = true;
        return session;
    }
    /**
     * Global cleanup:
     * - Stop the local proxy server (if running).
     * - Stop config polling.
     */
    async stop() {
        if (!this.started) {
            return;
        }
        await this.proxyServer.stop();
        this.configManager.stopPolling();
        this.session = null;
        this.started = false;
    }
}
exports.AgentConnectClient = AgentConnectClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWdlbnRDb25uZWN0Q2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0FnZW50Q29ubmVjdENsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsa0VBQWtFOzs7QUFHbEUsbURBQWdEO0FBQ2hELCtDQUE0QztBQUM1QyxxQ0FBaUQ7QUFFakQ7Ozs7R0FJRztBQUNILE1BQWEsa0JBQWtCO0lBTzdCLFlBQVksT0FBa0M7UUFIdEMsWUFBTyxHQUErQixJQUFJLENBQUM7UUFDM0MsWUFBTyxHQUFHLEtBQUssQ0FBQztRQUd0QixpQkFBaUI7UUFDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNuQixNQUFNLElBQUksOEJBQXFCLENBQUMsK0JBQStCLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBRUQsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFFdkIsaUJBQWlCO1FBQ2pCLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLElBQUksdUJBQXVCLENBQUM7UUFDakUsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUM7UUFDdEQsTUFBTSxlQUFlLEdBQW9CLE9BQU8sQ0FBQyxlQUFlLElBQUksTUFBTSxDQUFDO1FBQzNFLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLElBQUksQ0FBQyxlQUFlLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZGLE1BQU0sUUFBUSxHQUFhLE9BQU8sQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDO1FBRXRELHVCQUF1QjtRQUN2QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksNkJBQWEsQ0FBQztZQUNyQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUs7WUFDcEIsVUFBVTtZQUNWLGNBQWM7WUFDZCxlQUFlO1lBQ2YsV0FBVztZQUNYLFFBQVE7U0FDVCxDQUFDLENBQUM7UUFFSCxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLHlCQUFXLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSCxLQUFLLENBQUMsS0FBSztRQUNULDZDQUE2QztRQUM3QyxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2pDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUN0QixDQUFDO1FBRUQsNEVBQTRFO1FBQzVFLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUVoQyx5QkFBeUI7UUFDekIsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRWpGLG1DQUFtQztRQUNuQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBRWxDLHVCQUF1QjtRQUN2QixNQUFNLE9BQU8sR0FBd0I7WUFDbkMsSUFBSTtZQUNKLElBQUk7WUFDSixHQUFHO1lBQ0gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUNmLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDOUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDakMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7Z0JBQ3BCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLENBQUM7U0FDRixDQUFDO1FBRUYsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFFcEIsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxLQUFLLENBQUMsSUFBSTtRQUNSLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEIsT0FBTztRQUNULENBQUM7UUFFRCxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDOUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNqQyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUNwQixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUN2QixDQUFDO0NBQ0Y7QUE3RkQsZ0RBNkZDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQWdlbnRDb25uZWN0Q2xpZW50IC0gTWFpbiBwdWJsaWMgY2xhc3MgZm9yIEFsdXZpYSBBZ2VudCBDb25uZWN0XG5cbmltcG9ydCB0eXBlIHsgQWdlbnRDb25uZWN0Q2xpZW50T3B0aW9ucywgQWdlbnRDb25uZWN0U2Vzc2lvbiwgR2F0ZXdheVByb3RvY29sLCBMb2dMZXZlbCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQ29uZmlnTWFuYWdlciB9IGZyb20gJy4vQ29uZmlnTWFuYWdlcic7XG5pbXBvcnQgeyBQcm94eVNlcnZlciB9IGZyb20gJy4vUHJveHlTZXJ2ZXInO1xuaW1wb3J0IHsgTWlzc2luZ1VzZXJUb2tlbkVycm9yIH0gZnJvbSAnLi9lcnJvcnMnO1xuXG4vKipcbiAqIEFnZW50Q29ubmVjdENsaWVudCBpcyB0aGUgbWFpbiBlbnRyeSBwb2ludCBmb3IgdGhlIEFsdXZpYSBBZ2VudCBDb25uZWN0IE5vZGUgY2xpZW50LlxuICpcbiAqIEl0IG1hbmFnZXMgdGhlIGxvY2FsIHByb3h5IHNlcnZlciBhbmQgY29uZmlndXJhdGlvbiBwb2xsaW5nLlxuICovXG5leHBvcnQgY2xhc3MgQWdlbnRDb25uZWN0Q2xpZW50IHtcbiAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBBZ2VudENvbm5lY3RDbGllbnRPcHRpb25zO1xuICBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ01hbmFnZXI6IENvbmZpZ01hbmFnZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgcHJveHlTZXJ2ZXI6IFByb3h5U2VydmVyO1xuICBwcml2YXRlIHNlc3Npb246IEFnZW50Q29ubmVjdFNlc3Npb24gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGFydGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9uczogQWdlbnRDb25uZWN0Q2xpZW50T3B0aW9ucykge1xuICAgIC8vIFZhbGlkYXRlIHRva2VuXG4gICAgaWYgKCFvcHRpb25zLnRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgTWlzc2luZ1VzZXJUb2tlbkVycm9yKCdBbHV2aWEgdXNlciB0b2tlbiBpcyByZXF1aXJlZCcpO1xuICAgIH1cblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAvLyBBcHBseSBkZWZhdWx0c1xuICAgIGNvbnN0IGFwaUJhc2VVcmwgPSBvcHRpb25zLmFwaUJhc2VVcmwgPz8gJ2h0dHBzOi8vYXBpLmFsdXZpYS5pbyc7XG4gICAgY29uc3QgcG9sbEludGVydmFsTXMgPSBvcHRpb25zLnBvbGxJbnRlcnZhbE1zID8/IDUwMDA7XG4gICAgY29uc3QgZ2F0ZXdheVByb3RvY29sOiBHYXRld2F5UHJvdG9jb2wgPSBvcHRpb25zLmdhdGV3YXlQcm90b2NvbCA/PyAnaHR0cCc7XG4gICAgY29uc3QgZ2F0ZXdheVBvcnQgPSBvcHRpb25zLmdhdGV3YXlQb3J0ID8/IChnYXRld2F5UHJvdG9jb2wgPT09ICdodHRwcycgPyA4NDQzIDogODA4MCk7XG4gICAgY29uc3QgbG9nTGV2ZWw6IExvZ0xldmVsID0gb3B0aW9ucy5sb2dMZXZlbCA/PyAnaW5mbyc7XG5cbiAgICAvLyBDcmVhdGUgQ29uZmlnTWFuYWdlclxuICAgIHRoaXMuY29uZmlnTWFuYWdlciA9IG5ldyBDb25maWdNYW5hZ2VyKHtcbiAgICAgIHRva2VuOiBvcHRpb25zLnRva2VuLFxuICAgICAgYXBpQmFzZVVybCxcbiAgICAgIHBvbGxJbnRlcnZhbE1zLFxuICAgICAgZ2F0ZXdheVByb3RvY29sLFxuICAgICAgZ2F0ZXdheVBvcnQsXG4gICAgICBsb2dMZXZlbCxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBQcm94eVNlcnZlclxuICAgIHRoaXMucHJveHlTZXJ2ZXIgPSBuZXcgUHJveHlTZXJ2ZXIodGhpcy5jb25maWdNYW5hZ2VyLCB7IGxvZ0xldmVsIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IHRoZSBBZ2VudCBDb25uZWN0IHNlc3Npb246XG4gICAqIC0gRmV0Y2ggaW5pdGlhbCAvdXNlciBjb25maWcgZnJvbSBBbHV2aWEuXG4gICAqIC0gU3RhcnQgcG9sbGluZyBmb3IgY29uZmlnIHVwZGF0ZXMuXG4gICAqIC0gU3RhcnQgYSBsb2NhbCBIVFRQKFMpIHByb3h5IG9uIDEyNy4wLjAuMTo8bG9jYWxQb3J0IG9yIGZyZWUgcG9ydD4uXG4gICAqXG4gICAqIFJldHVybnMgdGhlIGFjdGl2ZSBzZXNzaW9uIHdpdGggaG9zdC9wb3J0L3VybCBhbmQgYSBzdG9wKCkgbWV0aG9kLlxuICAgKi9cbiAgYXN5bmMgc3RhcnQoKTogUHJvbWlzZTxBZ2VudENvbm5lY3RTZXNzaW9uPiB7XG4gICAgLy8gUmV0dXJuIGV4aXN0aW5nIHNlc3Npb24gaWYgYWxyZWFkeSBzdGFydGVkXG4gICAgaWYgKHRoaXMuc3RhcnRlZCAmJiB0aGlzLnNlc3Npb24pIHtcbiAgICAgIHJldHVybiB0aGlzLnNlc3Npb247XG4gICAgfVxuXG4gICAgLy8gRmV0Y2ggaW5pdGlhbCBjb25maWd1cmF0aW9uIChtYXkgdGhyb3cgSW52YWxpZFVzZXJUb2tlbkVycm9yIG9yIEFwaUVycm9yKVxuICAgIGF3YWl0IHRoaXMuY29uZmlnTWFuYWdlci5pbml0KCk7XG5cbiAgICAvLyBTdGFydCB0aGUgcHJveHkgc2VydmVyXG4gICAgY29uc3QgeyBob3N0LCBwb3J0LCB1cmwgfSA9IGF3YWl0IHRoaXMucHJveHlTZXJ2ZXIuc3RhcnQodGhpcy5vcHRpb25zLmxvY2FsUG9ydCk7XG5cbiAgICAvLyBTdGFydCBwb2xsaW5nIGZvciBjb25maWcgdXBkYXRlc1xuICAgIHRoaXMuY29uZmlnTWFuYWdlci5zdGFydFBvbGxpbmcoKTtcblxuICAgIC8vIEJ1aWxkIHNlc3Npb24gb2JqZWN0XG4gICAgY29uc3Qgc2Vzc2lvbjogQWdlbnRDb25uZWN0U2Vzc2lvbiA9IHtcbiAgICAgIGhvc3QsXG4gICAgICBwb3J0LFxuICAgICAgdXJsLFxuICAgICAgc3RvcDogYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLnByb3h5U2VydmVyLnN0b3AoKTtcbiAgICAgICAgdGhpcy5jb25maWdNYW5hZ2VyLnN0b3BQb2xsaW5nKCk7XG4gICAgICAgIHRoaXMuc2Vzc2lvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuc3RhcnRlZCA9IGZhbHNlO1xuICAgICAgfSxcbiAgICB9O1xuXG4gICAgdGhpcy5zZXNzaW9uID0gc2Vzc2lvbjtcbiAgICB0aGlzLnN0YXJ0ZWQgPSB0cnVlO1xuXG4gICAgcmV0dXJuIHNlc3Npb247XG4gIH1cblxuICAvKipcbiAgICogR2xvYmFsIGNsZWFudXA6XG4gICAqIC0gU3RvcCB0aGUgbG9jYWwgcHJveHkgc2VydmVyIChpZiBydW5uaW5nKS5cbiAgICogLSBTdG9wIGNvbmZpZyBwb2xsaW5nLlxuICAgKi9cbiAgYXN5bmMgc3RvcCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuc3RhcnRlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMucHJveHlTZXJ2ZXIuc3RvcCgpO1xuICAgIHRoaXMuY29uZmlnTWFuYWdlci5zdG9wUG9sbGluZygpO1xuICAgIHRoaXMuc2Vzc2lvbiA9IG51bGw7XG4gICAgdGhpcy5zdGFydGVkID0gZmFsc2U7XG4gIH1cbn1cbiJdfQ==