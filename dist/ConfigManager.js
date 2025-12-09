"use strict";
// ConfigManager - Control plane for user configuration
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const logger_1 = require("./logger");
const httpClient_1 = require("./httpClient");
const errors_1 = require("./errors");
/**
 * ConfigManager handles fetching and maintaining user configuration from the Aluvia API.
 *
 * Responsibilities:
 * - Initial fetch of /user config
 * - Polling for updates using ETag
 * - Providing current config to ProxyServer
 */
class ConfigManager {
    constructor(options) {
        this.config = null;
        this.timer = null;
        this.options = options;
        this.logger = new logger_1.Logger(options.logLevel);
    }
    /**
     * Fetch initial configuration from /user endpoint.
     * Must be called before starting the proxy.
     *
     * @throws InvalidUserTokenError if token is invalid (401/403)
     * @throws ApiError for other API errors
     */
    async init() {
        this.logger.info('Fetching initial configuration from Aluvia API...');
        const result = await (0, httpClient_1.getUser)(this.options.apiBaseUrl, this.options.token);
        // Handle authentication errors
        if (result.status === 401 || result.status === 403) {
            throw new errors_1.InvalidUserTokenError(`Authentication failed with status ${result.status}`);
        }
        // Handle successful response
        if (result.status === 200 && result.body) {
            this.config = this.buildConfig(result.body, result.etag);
            this.logger.info('Configuration loaded successfully');
            this.logger.debug('Config:', this.config);
            return;
        }
        // Handle other errors
        throw new errors_1.ApiError(`Failed to fetch user config: HTTP ${result.status}`, result.status);
    }
    /**
     * Start polling for configuration updates.
     * Uses ETag for efficient conditional requests.
     */
    startPolling() {
        // Don't start if already polling
        if (this.timer) {
            this.logger.debug('Polling already active, skipping startPolling()');
            return;
        }
        this.logger.info(`Starting config polling every ${this.options.pollIntervalMs}ms`);
        this.timer = setInterval(async () => {
            await this.pollOnce();
        }, this.options.pollIntervalMs);
    }
    /**
     * Stop polling for configuration updates.
     */
    stopPolling() {
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
    getConfig() {
        return this.config;
    }
    /**
     * Perform a single poll iteration.
     * Called by the polling timer.
     */
    async pollOnce() {
        // Skip if no config (shouldn't happen after init)
        if (!this.config) {
            this.logger.warn('No config available, skipping poll');
            return;
        }
        try {
            const result = await (0, httpClient_1.getUser)(this.options.apiBaseUrl, this.options.token, this.config.etag ?? undefined);
            // 304 Not Modified - config unchanged
            if (result.status === 304) {
                this.logger.debug('Config unchanged (304 Not Modified)');
                return;
            }
            // 200 OK - config updated
            if (result.status === 200 && result.body) {
                this.config = this.buildConfig(result.body, result.etag);
                this.logger.info('Configuration updated from API');
                this.logger.debug('New config:', this.config);
                return;
            }
            // Other status codes - log warning but keep old config
            this.logger.warn(`Poll returned unexpected status ${result.status}`);
        }
        catch (error) {
            // Network or other errors - log warning but keep old config
            this.logger.warn('Poll failed, keeping existing config:', error);
        }
    }
    /**
     * Build UserNetworkConfig from API response.
     */
    buildConfig(body, etag) {
        return {
            rawProxy: {
                protocol: this.options.gatewayProtocol,
                host: 'gateway.aluvia.io',
                port: this.options.gatewayPort,
                username: body.proxy_username,
                password: body.proxy_password,
            },
            rules: body.rules,
            sessionId: body.session_id,
            targetGeo: body.target_geo,
            etag,
        };
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29uZmlnTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db25maWdNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSx1REFBdUQ7OztBQUd2RCxxQ0FBa0M7QUFDbEMsNkNBQXVDO0FBQ3ZDLHFDQUEyRDtBQXNDM0Q7Ozs7Ozs7R0FPRztBQUNILE1BQWEsYUFBYTtJQU14QixZQUFZLE9BQTZCO1FBTGpDLFdBQU0sR0FBNkIsSUFBSSxDQUFDO1FBQ3hDLFVBQUssR0FBMEIsSUFBSSxDQUFDO1FBSzFDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxlQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxLQUFLLENBQUMsSUFBSTtRQUNSLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLG1EQUFtRCxDQUFDLENBQUM7UUFFdEUsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLG9CQUFPLEVBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUxRSwrQkFBK0I7UUFDL0IsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQ25ELE1BQU0sSUFBSSw4QkFBcUIsQ0FDN0IscUNBQXFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FDckQsQ0FBQztRQUNKLENBQUM7UUFFRCw2QkFBNkI7UUFDN0IsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDekMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFD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RUFBRSxDQUFDO1lBQ2YsNERBQTREO1lBQzVELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHVDQUF1QyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ25FLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxXQUFXLENBQ2pCLElBTUMsRUFDRCxJQUFtQjtRQUVuQixPQUFPO1lBQ0wsUUFBUSxFQUFFO2dCQUNSLFFBQVEsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWU7Z0JBQ3RDLElBQUksRUFBRSxtQkFBbUI7Z0JBQ3pCLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVc7Z0JBQzlCLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYztnQkFDN0IsUUFBUSxFQUFFLElBQUksQ0FBQyxjQUFjO2FBQzlCO1lBQ0QsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO1lBQ2pCLFNBQVMsRUFBRSxJQUFJLENBQUMsVUFBVTtZQUMxQixTQUFTLEVBQUUsSUFBSSxDQUFDLFVBQVU7WUFDMUIsSUFBSTtTQUNMLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF2SkQsc0NBdUpDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29uZmlnTWFuYWdlciAtIENvbnRyb2wgcGxhbmUgZm9yIHVzZXIgY29uZmlndXJhdGlvblxuXG5pbXBvcnQgdHlwZSB7IEdhdGV3YXlQcm90b2NvbCwgTG9nTGV2ZWwgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4vbG9nZ2VyJztcbmltcG9ydCB7IGdldFVzZXIgfSBmcm9tICcuL2h0dHBDbGllbnQnO1xuaW1wb3J0IHsgSW52YWxpZFVzZXJUb2tlbkVycm9yLCBBcGlFcnJvciB9IGZyb20gJy4vZXJyb3JzJztcblxuLy8gQ29uZmlnIHR5cGVzXG5cbi8qKlxuICogUmF3IHByb3h5IGNvbmZpZ3VyYXRpb24gZGVyaXZlZCBmcm9tIC91c2VyIHJlc3BvbnNlIGFuZCBjbGllbnQgb3B0aW9ucy5cbiAqL1xuZXhwb3J0IHR5cGUgUmF3UHJveHlDb25maWcgPSB7XG4gIHByb3RvY29sOiBHYXRld2F5UHJvdG9jb2w7XG4gIGhvc3Q6ICdnYXRld2F5LmFsdXZpYS5pbyc7XG4gIHBvcnQ6IG51bWJlcjtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgcGFzc3dvcmQ6IHN0cmluZztcbn07XG5cbi8qKlxuICogQ29tcGxldGUgdXNlciBuZXR3b3JrIGNvbmZpZ3VyYXRpb24gaW5jbHVkaW5nIHByb3h5LCBydWxlcywgYW5kIG1ldGFkYXRhLlxuICovXG5leHBvcnQgdHlwZSBVc2VyTmV0d29ya0NvbmZpZyA9IHtcbiAgcmF3UHJveHk6IFJhd1Byb3h5Q29uZmlnO1xuICBydWxlczogc3RyaW5nW107XG4gIHNlc3Npb25JZDogc3RyaW5nIHwgbnVsbDtcbiAgdGFyZ2V0R2VvOiBzdHJpbmcgfCBudWxsO1xuICBldGFnOiBzdHJpbmcgfCBudWxsO1xufTtcblxuLyoqXG4gKiBPcHRpb25zIGZvciBDb25maWdNYW5hZ2VyIGNvbnN0cnVjdG9yLlxuICovXG5leHBvcnQgdHlwZSBDb25maWdNYW5hZ2VyT3B0aW9ucyA9IHtcbiAgdG9rZW46IHN0cmluZztcbiAgYXBpQmFzZVVybDogc3RyaW5nO1xuICBwb2xsSW50ZXJ2YWxNczogbnVtYmVyO1xuICBnYXRld2F5UHJvdG9jb2w6IEdhdGV3YXlQcm90b2NvbDtcbiAgZ2F0ZXdheVBvcnQ6IG51bWJlcjtcbiAgbG9nTGV2ZWw6IExvZ0xldmVsO1xufTtcblxuLyoqXG4gKiBDb25maWdNYW5hZ2VyIGhhbmRsZXMgZmV0Y2hpbmcgYW5kIG1haW50YWluaW5nIHVzZXIgY29uZmlndXJhdGlvbiBmcm9tIHRoZSBBbHV2aWEgQVBJLlxuICpcbiAqIFJlc3BvbnNpYmlsaXRpZXM6XG4gKiAtIEluaXRpYWwgZmV0Y2ggb2YgL3VzZXIgY29uZmlnXG4gKiAtIFBvbGxpbmcgZm9yIHVwZGF0ZXMgdXNpbmcgRVRhZ1xuICogLSBQcm92aWRpbmcgY3VycmVudCBjb25maWcgdG8gUHJveHlTZXJ2ZXJcbiAqL1xuZXhwb3J0IGNsYXNzIENvbmZpZ01hbmFnZXIge1xuICBwcml2YXRlIGNvbmZpZzogVXNlck5ldHdvcmtDb25maWcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB0aW1lcjogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSByZWFkb25seSBsb2dnZXI6IExvZ2dlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBDb25maWdNYW5hZ2VyT3B0aW9ucztcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDb25maWdNYW5hZ2VyT3B0aW9ucykge1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5sb2dnZXIgPSBuZXcgTG9nZ2VyKG9wdGlvbnMubG9nTGV2ZWwpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZldGNoIGluaXRpYWwgY29uZmlndXJhdGlvbiBmcm9tIC91c2VyIGVuZHBvaW50LlxuICAgKiBNdXN0IGJlIGNhbGxlZCBiZWZvcmUgc3RhcnRpbmcgdGhlIHByb3h5LlxuICAgKlxuICAgKiBAdGhyb3dzIEludmFsaWRVc2VyVG9rZW5FcnJvciBpZiB0b2tlbiBpcyBpbnZhbGlkICg0MDEvNDAzKVxuICAgKiBAdGhyb3dzIEFwaUVycm9yIGZvciBvdGhlciBBUEkgZXJyb3JzXG4gICAqL1xuICBhc3luYyBpbml0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubG9nZ2VyLmluZm8oJ0ZldGNoaW5nIGluaXRpYWwgY29uZmlndXJhdGlvbiBmcm9tIEFsdXZpYSBBUEkuLi4nKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldFVzZXIodGhpcy5vcHRpb25zLmFwaUJhc2VVcmwsIHRoaXMub3B0aW9ucy50b2tlbik7XG5cbiAgICAvLyBIYW5kbGUgYXV0aGVudGljYXRpb24gZXJyb3JzXG4gICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IDQwMSB8fCByZXN1bHQuc3RhdHVzID09PSA0MDMpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkVXNlclRva2VuRXJyb3IoXG4gICAgICAgIGBBdXRoZW50aWNhdGlvbiBmYWlsZWQgd2l0aCBzdGF0dXMgJHtyZXN1bHQuc3RhdHVzfWBcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIHN1Y2Nlc3NmdWwgcmVzcG9uc2VcbiAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gMjAwICYmIHJlc3VsdC5ib2R5KSB7XG4gICAgICB0aGlzLmNvbmZpZyA9IHRoaXMuYnVpbGRDb25maWcocmVzdWx0LmJvZHksIHJlc3VsdC5ldGFnKTtcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0NvbmZpZ3VyYXRpb24gbG9hZGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgdGhpcy5sb2dnZXIuZGVidWcoJ0NvbmZpZzonLCB0aGlzLmNvbmZpZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIG90aGVyIGVycm9yc1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihcbiAgICAgIGBGYWlsZWQgdG8gZmV0Y2ggdXNlciBjb25maWc6IEhUVFAgJHtyZXN1bHQuc3RhdHVzfWAsXG4gICAgICByZXN1bHQuc3RhdHVzXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBwb2xsaW5nIGZvciBjb25maWd1cmF0aW9uIHVwZGF0ZXMuXG4gICAqIFVzZXMgRVRhZyBmb3IgZWZmaWNpZW50IGNvbmRpdGlvbmFsIHJlcXVlc3RzLlxuICAgKi9cbiAgc3RhcnRQb2xsaW5nKCk6IHZvaWQge1xuICAgIC8vIERvbid0IHN0YXJ0IGlmIGFscmVhZHkgcG9sbGluZ1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICB0aGlzLmxvZ2dlci5kZWJ1ZygnUG9sbGluZyBhbHJlYWR5IGFjdGl2ZSwgc2tpcHBpbmcgc3RhcnRQb2xsaW5nKCknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ2dlci5pbmZvKFxuICAgICAgYFN0YXJ0aW5nIGNvbmZpZyBwb2xsaW5nIGV2ZXJ5ICR7dGhpcy5vcHRpb25zLnBvbGxJbnRlcnZhbE1zfW1zYFxuICAgICk7XG5cbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwoYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgdGhpcy5wb2xsT25jZSgpO1xuICAgIH0sIHRoaXMub3B0aW9ucy5wb2xsSW50ZXJ2YWxNcyk7XG4gIH1cblxuICAvKipcbiAgICogU3RvcCBwb2xsaW5nIGZvciBjb25maWd1cmF0aW9uIHVwZGF0ZXMuXG4gICAqL1xuICBzdG9wUG9sbGluZygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgdGhpcy5sb2dnZXIuaW5mbygnQ29uZmlnIHBvbGxpbmcgc3RvcHBlZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGN1cnJlbnQgY29uZmlndXJhdGlvbi5cbiAgICogUmV0dXJucyBudWxsIGlmIGluaXQoKSBoYXNuJ3QgYmVlbiBjYWxsZWQgb3IgZmFpbGVkLlxuICAgKi9cbiAgZ2V0Q29uZmlnKCk6IFVzZXJOZXR3b3JrQ29uZmlnIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuY29uZmlnO1xuICB9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gYSBzaW5nbGUgcG9sbCBpdGVyYXRpb24uXG4gICAqIENhbGxlZCBieSB0aGUgcG9sbGluZyB0aW1lci5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcG9sbE9uY2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gU2tpcCBpZiBubyBjb25maWcgKHNob3VsZG4ndCBoYXBwZW4gYWZ0ZXIgaW5pdClcbiAgICBpZiAoIXRoaXMuY29uZmlnKSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKCdObyBjb25maWcgYXZhaWxhYmxlLCBza2lwcGluZyBwb2xsJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldFVzZXIoXG4gICAgICAgIHRoaXMub3B0aW9ucy5hcGlCYXNlVXJsLFxuICAgICAgICB0aGlzLm9wdGlvbnMudG9rZW4sXG4gICAgICAgIHRoaXMuY29uZmlnLmV0YWcgPz8gdW5kZWZpbmVkXG4gICAgICApO1xuXG4gICAgICAvLyAzMDQgTm90IE1vZGlmaWVkIC0gY29uZmlnIHVuY2hhbmdlZFxuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IDMwNCkge1xuICAgICAgICB0aGlzLmxvZ2dlci5kZWJ1ZygnQ29uZmlnIHVuY2hhbmdlZCAoMzA0IE5vdCBNb2RpZmllZCknKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyAyMDAgT0sgLSBjb25maWcgdXBkYXRlZFxuICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09IDIwMCAmJiByZXN1bHQuYm9keSkge1xuICAgICAgICB0aGlzLmNvbmZpZyA9IHRoaXMuYnVpbGRDb25maWcocmVzdWx0LmJvZHksIHJlc3VsdC5ldGFnKTtcbiAgICAgICAgdGhpcy5sb2dnZXIuaW5mbygnQ29uZmlndXJhdGlvbiB1cGRhdGVkIGZyb20gQVBJJyk7XG4gICAgICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdOZXcgY29uZmlnOicsIHRoaXMuY29uZmlnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBPdGhlciBzdGF0dXMgY29kZXMgLSBsb2cgd2FybmluZyBidXQga2VlcCBvbGQgY29uZmlnXG4gICAgICB0aGlzLmxvZ2dlci53YXJuKGBQb2xsIHJldHVybmVkIHVuZXhwZWN0ZWQgc3RhdHVzICR7cmVzdWx0LnN0YXR1c31gKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gTmV0d29yayBvciBvdGhlciBlcnJvcnMgLSBsb2cgd2FybmluZyBidXQga2VlcCBvbGQgY29uZmlnXG4gICAgICB0aGlzLmxvZ2dlci53YXJuKCdQb2xsIGZhaWxlZCwga2VlcGluZyBleGlzdGluZyBjb25maWc6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZCBVc2VyTmV0d29ya0NvbmZpZyBmcm9tIEFQSSByZXNwb25zZS5cbiAgICovXG4gIHByaXZhdGUgYnVpbGRDb25maWcoXG4gICAgYm9keToge1xuICAgICAgcHJveHlfdXNlcm5hbWU6IHN0cmluZztcbiAgICAgIHByb3h5X3Bhc3N3b3JkOiBzdHJpbmc7XG4gICAgICBydWxlczogc3RyaW5nW107XG4gICAgICBzZXNzaW9uX2lkOiBzdHJpbmcgfCBudWxsO1xuICAgICAgdGFyZ2V0X2dlbzogc3RyaW5nIHwgbnVsbDtcbiAgICB9LFxuICAgIGV0YWc6IHN0cmluZyB8IG51bGxcbiAgKTogVXNlck5ldHdvcmtDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICByYXdQcm94eToge1xuICAgICAgICBwcm90b2NvbDogdGhpcy5vcHRpb25zLmdhdGV3YXlQcm90b2NvbCxcbiAgICAgICAgaG9zdDogJ2dhdGV3YXkuYWx1dmlhLmlvJyxcbiAgICAgICAgcG9ydDogdGhpcy5vcHRpb25zLmdhdGV3YXlQb3J0LFxuICAgICAgICB1c2VybmFtZTogYm9keS5wcm94eV91c2VybmFtZSxcbiAgICAgICAgcGFzc3dvcmQ6IGJvZHkucHJveHlfcGFzc3dvcmQsXG4gICAgICB9LFxuICAgICAgcnVsZXM6IGJvZHkucnVsZXMsXG4gICAgICBzZXNzaW9uSWQ6IGJvZHkuc2Vzc2lvbl9pZCxcbiAgICAgIHRhcmdldEdlbzogYm9keS50YXJnZXRfZ2VvLFxuICAgICAgZXRhZyxcbiAgICB9O1xuICB9XG59XG5cbiJdfQ==