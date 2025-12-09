"use strict";
// AluviaClient - Main public class for Aluvia Client
Object.defineProperty(exports, "__esModule", { value: true });
exports.AluviaClient = void 0;
const ConfigManager_1 = require("./ConfigManager");
const ProxyServer_1 = require("./ProxyServer");
const errors_1 = require("./errors");
/**
 * AluviaClient is the main entry point for the Aluvia Client.
 *
 * It manages the local proxy server and configuration polling.
 */
class AluviaClient {
    constructor(options) {
        this.session = null;
        this.started = false;
        // Validate token
        if (!options.token) {
            throw new errors_1.MissingUserTokenError('Aluvia user token is required');
        }
        this.options = options;
        // Apply defaults
        const apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io/v1';
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
     * Start the Aluvia Client session:
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
exports.AluviaClient = AluviaClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWx1dmlhQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0FsdXZpYUNsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEscURBQXFEOzs7QUFHckQsbURBQWdEO0FBQ2hELCtDQUE0QztBQUM1QyxxQ0FBaUQ7QUFFakQ7Ozs7R0FJRztBQUNILE1BQWEsWUFBWTtJQU92QixZQUFZLE9BQTRCO1FBSGhDLFlBQU8sR0FBK0IsSUFBSSxDQUFDO1FBQzNDLFlBQU8sR0FBRyxLQUFLLENBQUM7UUFHdEIsaUJBQWlCO1FBQ2pCLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDbkIsTUFBTSxJQUFJLDhCQUFxQixDQUFDLCtCQUErQixDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUVELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBRXZCLGlCQUFpQjtRQUNqQixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxJQUFJLHVCQUF1QixDQUFDO1FBQ2pFLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDO1FBQ3RELE1BQU0sZUFBZSxHQUFvQixPQUFPLENBQUMsZUFBZSxJQUFJLE1BQU0sQ0FBQztRQUMzRSxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxJQUFJLENBQUMsZUFBZSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RixNQUFNLFFBQVEsR0FBYSxPQUFPLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQztRQUV0RCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLDZCQUFhLENBQUM7WUFDckMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1lBQ3BCLFVBQVU7WUFDVixjQUFjO1lBQ2QsZUFBZTtZQUNmLFdBQVc7WUFDWCxRQUFRO1NBQ1QsQ0FBQyxDQUFDO1FBRUgscUJBQXFCO1FBQ3JCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsS0FBSyxDQUFDLEtBQUs7UUFDVCw2Q0FBNkM7UUFDN0MsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNqQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDdEIsQ0FBQztRQUVELDRFQUE0RTtRQUM1RSxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFaEMseUJBQXlCO1FBQ3pCLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVqRixtQ0FBbUM7UUFDbkMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUVsQyx1QkFBdUI7UUFDdkIsTUFBTSxPQUFPLEdBQXdCO1lBQ25DLElBQUk7WUFDSixJQUFJO1lBQ0osR0FBRztZQUNILElBQUksRUFBRSxLQUFLLElBQUksRUFBRTtnQkFDZixNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO2dCQUNwQixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztZQUN2QixDQUFDO1NBQ0YsQ0FBQztRQUVGLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBRXBCLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsS0FBSyxDQUFDLElBQUk7UUFDUixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2xCLE9BQU87UUFDVCxDQUFDO1FBRUQsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDakMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDcEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFDdkIsQ0FBQztDQUNGO0FBN0ZELG9DQTZGQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEFsdXZpYUNsaWVudCAtIE1haW4gcHVibGljIGNsYXNzIGZvciBBbHV2aWEgQ2xpZW50XG5cbmltcG9ydCB0eXBlIHsgQWx1dmlhQ2xpZW50T3B0aW9ucywgQWx1dmlhQ2xpZW50U2Vzc2lvbiwgR2F0ZXdheVByb3RvY29sLCBMb2dMZXZlbCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgQ29uZmlnTWFuYWdlciB9IGZyb20gJy4vQ29uZmlnTWFuYWdlcic7XG5pbXBvcnQgeyBQcm94eVNlcnZlciB9IGZyb20gJy4vUHJveHlTZXJ2ZXInO1xuaW1wb3J0IHsgTWlzc2luZ1VzZXJUb2tlbkVycm9yIH0gZnJvbSAnLi9lcnJvcnMnO1xuXG4vKipcbiAqIEFsdXZpYUNsaWVudCBpcyB0aGUgbWFpbiBlbnRyeSBwb2ludCBmb3IgdGhlIEFsdXZpYSBDbGllbnQuXG4gKlxuICogSXQgbWFuYWdlcyB0aGUgbG9jYWwgcHJveHkgc2VydmVyIGFuZCBjb25maWd1cmF0aW9uIHBvbGxpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBBbHV2aWFDbGllbnQge1xuICBwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IEFsdXZpYUNsaWVudE9wdGlvbnM7XG4gIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnTWFuYWdlcjogQ29uZmlnTWFuYWdlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBwcm94eVNlcnZlcjogUHJveHlTZXJ2ZXI7XG4gIHByaXZhdGUgc2Vzc2lvbjogQWx1dmlhQ2xpZW50U2Vzc2lvbiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXJ0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBBbHV2aWFDbGllbnRPcHRpb25zKSB7XG4gICAgLy8gVmFsaWRhdGUgdG9rZW5cbiAgICBpZiAoIW9wdGlvbnMudG9rZW4pIHtcbiAgICAgIHRocm93IG5ldyBNaXNzaW5nVXNlclRva2VuRXJyb3IoJ0FsdXZpYSB1c2VyIHRva2VuIGlzIHJlcXVpcmVkJyk7XG4gICAgfVxuXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblxuICAgIC8vIEFwcGx5IGRlZmF1bHRzXG4gICAgY29uc3QgYXBpQmFzZVVybCA9IG9wdGlvbnMuYXBpQmFzZVVybCA/PyAnaHR0cHM6Ly9hcGkuYWx1dmlhLmlvJztcbiAgICBjb25zdCBwb2xsSW50ZXJ2YWxNcyA9IG9wdGlvbnMucG9sbEludGVydmFsTXMgPz8gNTAwMDtcbiAgICBjb25zdCBnYXRld2F5UHJvdG9jb2w6IEdhdGV3YXlQcm90b2NvbCA9IG9wdGlvbnMuZ2F0ZXdheVByb3RvY29sID8/ICdodHRwJztcbiAgICBjb25zdCBnYXRld2F5UG9ydCA9IG9wdGlvbnMuZ2F0ZXdheVBvcnQgPz8gKGdhdGV3YXlQcm90b2NvbCA9PT0gJ2h0dHBzJyA/IDg0NDMgOiA4MDgwKTtcbiAgICBjb25zdCBsb2dMZXZlbDogTG9nTGV2ZWwgPSBvcHRpb25zLmxvZ0xldmVsID8/ICdpbmZvJztcblxuICAgIC8vIENyZWF0ZSBDb25maWdNYW5hZ2VyXG4gICAgdGhpcy5jb25maWdNYW5hZ2VyID0gbmV3IENvbmZpZ01hbmFnZXIoe1xuICAgICAgdG9rZW46IG9wdGlvbnMudG9rZW4sXG4gICAgICBhcGlCYXNlVXJsLFxuICAgICAgcG9sbEludGVydmFsTXMsXG4gICAgICBnYXRld2F5UHJvdG9jb2wsXG4gICAgICBnYXRld2F5UG9ydCxcbiAgICAgIGxvZ0xldmVsLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFByb3h5U2VydmVyXG4gICAgdGhpcy5wcm94eVNlcnZlciA9IG5ldyBQcm94eVNlcnZlcih0aGlzLmNvbmZpZ01hbmFnZXIsIHsgbG9nTGV2ZWwgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgdGhlIEFsdXZpYSBDbGllbnQgc2Vzc2lvbjpcbiAgICogLSBGZXRjaCBpbml0aWFsIC91c2VyIGNvbmZpZyBmcm9tIEFsdXZpYS5cbiAgICogLSBTdGFydCBwb2xsaW5nIGZvciBjb25maWcgdXBkYXRlcy5cbiAgICogLSBTdGFydCBhIGxvY2FsIEhUVFAoUykgcHJveHkgb24gMTI3LjAuMC4xOjxsb2NhbFBvcnQgb3IgZnJlZSBwb3J0Pi5cbiAgICpcbiAgICogUmV0dXJucyB0aGUgYWN0aXZlIHNlc3Npb24gd2l0aCBob3N0L3BvcnQvdXJsIGFuZCBhIHN0b3AoKSBtZXRob2QuXG4gICAqL1xuICBhc3luYyBzdGFydCgpOiBQcm9taXNlPEFsdXZpYUNsaWVudFNlc3Npb24+IHtcbiAgICAvLyBSZXR1cm4gZXhpc3Rpbmcgc2Vzc2lvbiBpZiBhbHJlYWR5IHN0YXJ0ZWRcbiAgICBpZiAodGhpcy5zdGFydGVkICYmIHRoaXMuc2Vzc2lvbikge1xuICAgICAgcmV0dXJuIHRoaXMuc2Vzc2lvbjtcbiAgICB9XG5cbiAgICAvLyBGZXRjaCBpbml0aWFsIGNvbmZpZ3VyYXRpb24gKG1heSB0aHJvdyBJbnZhbGlkVXNlclRva2VuRXJyb3Igb3IgQXBpRXJyb3IpXG4gICAgYXdhaXQgdGhpcy5jb25maWdNYW5hZ2VyLmluaXQoKTtcblxuICAgIC8vIFN0YXJ0IHRoZSBwcm94eSBzZXJ2ZXJcbiAgICBjb25zdCB7IGhvc3QsIHBvcnQsIHVybCB9ID0gYXdhaXQgdGhpcy5wcm94eVNlcnZlci5zdGFydCh0aGlzLm9wdGlvbnMubG9jYWxQb3J0KTtcblxuICAgIC8vIFN0YXJ0IHBvbGxpbmcgZm9yIGNvbmZpZyB1cGRhdGVzXG4gICAgdGhpcy5jb25maWdNYW5hZ2VyLnN0YXJ0UG9sbGluZygpO1xuXG4gICAgLy8gQnVpbGQgc2Vzc2lvbiBvYmplY3RcbiAgICBjb25zdCBzZXNzaW9uOiBBbHV2aWFDbGllbnRTZXNzaW9uID0ge1xuICAgICAgaG9zdCxcbiAgICAgIHBvcnQsXG4gICAgICB1cmwsXG4gICAgICBzdG9wOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMucHJveHlTZXJ2ZXIuc3RvcCgpO1xuICAgICAgICB0aGlzLmNvbmZpZ01hbmFnZXIuc3RvcFBvbGxpbmcoKTtcbiAgICAgICAgdGhpcy5zZXNzaW9uID0gbnVsbDtcbiAgICAgICAgdGhpcy5zdGFydGVkID0gZmFsc2U7XG4gICAgICB9LFxuICAgIH07XG5cbiAgICB0aGlzLnNlc3Npb24gPSBzZXNzaW9uO1xuICAgIHRoaXMuc3RhcnRlZCA9IHRydWU7XG5cbiAgICByZXR1cm4gc2Vzc2lvbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBHbG9iYWwgY2xlYW51cDpcbiAgICogLSBTdG9wIHRoZSBsb2NhbCBwcm94eSBzZXJ2ZXIgKGlmIHJ1bm5pbmcpLlxuICAgKiAtIFN0b3AgY29uZmlnIHBvbGxpbmcuXG4gICAqL1xuICBhc3luYyBzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5zdGFydGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5wcm94eVNlcnZlci5zdG9wKCk7XG4gICAgdGhpcy5jb25maWdNYW5hZ2VyLnN0b3BQb2xsaW5nKCk7XG4gICAgdGhpcy5zZXNzaW9uID0gbnVsbDtcbiAgICB0aGlzLnN0YXJ0ZWQgPSBmYWxzZTtcbiAgfVxufVxuIl19