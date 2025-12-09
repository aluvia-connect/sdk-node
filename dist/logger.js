"use strict";
// Logger utility for Aluvia Agent Connect
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
/**
 * Simple logger that respects log levels.
 *
 * Log level hierarchy:
 * - 'silent': only error() logs
 * - 'info': info(), warn(), error() log
 * - 'debug': all methods log
 */
class Logger {
    constructor(level) {
        this.level = level;
    }
    /**
     * Log informational messages.
     * Logs when level is 'info' or 'debug'.
     */
    info(...args) {
        if (this.level === 'info' || this.level === 'debug') {
            console.log('[aluvia][info]', ...args);
        }
    }
    /**
     * Log debug messages.
     * Logs only when level is 'debug'.
     */
    debug(...args) {
        if (this.level === 'debug') {
            console.debug('[aluvia][debug]', ...args);
        }
    }
    /**
     * Log warning messages.
     * Logs when level is not 'silent'.
     */
    warn(...args) {
        if (this.level !== 'silent') {
            console.warn('[aluvia][warn]', ...args);
        }
    }
    /**
     * Log error messages.
     * Always logs regardless of level.
     */
    error(...args) {
        console.error('[aluvia][error]', ...args);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2xvZ2dlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsMENBQTBDOzs7QUFJMUM7Ozs7Ozs7R0FPRztBQUNILE1BQWEsTUFBTTtJQUdqQixZQUFZLEtBQWU7UUFDekIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDckIsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksQ0FBQyxHQUFHLElBQWU7UUFDckIsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLE1BQU0sSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQ3BELE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUN6QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxHQUFHLElBQWU7UUFDdEIsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUM1QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksQ0FBQyxHQUFHLElBQWU7UUFDckIsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzVCLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUMxQyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxHQUFHLElBQWU7UUFDdEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUM7Q0FDRjtBQTVDRCx3QkE0Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBMb2dnZXIgdXRpbGl0eSBmb3IgQWx1dmlhIEFnZW50IENvbm5lY3RcblxuaW1wb3J0IHR5cGUgeyBMb2dMZXZlbCB9IGZyb20gJy4vdHlwZXMnO1xuXG4vKipcbiAqIFNpbXBsZSBsb2dnZXIgdGhhdCByZXNwZWN0cyBsb2cgbGV2ZWxzLlxuICpcbiAqIExvZyBsZXZlbCBoaWVyYXJjaHk6XG4gKiAtICdzaWxlbnQnOiBvbmx5IGVycm9yKCkgbG9nc1xuICogLSAnaW5mbyc6IGluZm8oKSwgd2FybigpLCBlcnJvcigpIGxvZ1xuICogLSAnZGVidWcnOiBhbGwgbWV0aG9kcyBsb2dcbiAqL1xuZXhwb3J0IGNsYXNzIExvZ2dlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgbGV2ZWw6IExvZ0xldmVsO1xuXG4gIGNvbnN0cnVjdG9yKGxldmVsOiBMb2dMZXZlbCkge1xuICAgIHRoaXMubGV2ZWwgPSBsZXZlbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2cgaW5mb3JtYXRpb25hbCBtZXNzYWdlcy5cbiAgICogTG9ncyB3aGVuIGxldmVsIGlzICdpbmZvJyBvciAnZGVidWcnLlxuICAgKi9cbiAgaW5mbyguLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sZXZlbCA9PT0gJ2luZm8nIHx8IHRoaXMubGV2ZWwgPT09ICdkZWJ1ZycpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbYWx1dmlhXVtpbmZvXScsIC4uLmFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2cgZGVidWcgbWVzc2FnZXMuXG4gICAqIExvZ3Mgb25seSB3aGVuIGxldmVsIGlzICdkZWJ1ZycuXG4gICAqL1xuICBkZWJ1ZyguLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sZXZlbCA9PT0gJ2RlYnVnJykge1xuICAgICAgY29uc29sZS5kZWJ1ZygnW2FsdXZpYV1bZGVidWddJywgLi4uYXJncyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvZyB3YXJuaW5nIG1lc3NhZ2VzLlxuICAgKiBMb2dzIHdoZW4gbGV2ZWwgaXMgbm90ICdzaWxlbnQnLlxuICAgKi9cbiAgd2FybiguLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sZXZlbCAhPT0gJ3NpbGVudCcpIHtcbiAgICAgIGNvbnNvbGUud2FybignW2FsdXZpYV1bd2Fybl0nLCAuLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTG9nIGVycm9yIG1lc3NhZ2VzLlxuICAgKiBBbHdheXMgbG9ncyByZWdhcmRsZXNzIG9mIGxldmVsLlxuICAgKi9cbiAgZXJyb3IoLi4uYXJnczogdW5rbm93bltdKTogdm9pZCB7XG4gICAgY29uc29sZS5lcnJvcignW2FsdXZpYV1bZXJyb3JdJywgLi4uYXJncyk7XG4gIH1cbn1cblxuIl19