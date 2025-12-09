"use strict";
// Logger utility for Aluvia Client
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2xvZ2dlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsbUNBQW1DOzs7QUFJbkM7Ozs7Ozs7R0FPRztBQUNILE1BQWEsTUFBTTtJQUdqQixZQUFZLEtBQWU7UUFDekIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDckIsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksQ0FBQyxHQUFHLElBQWU7UUFDckIsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLE1BQU0sSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQ3BELE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUN6QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxHQUFHLElBQWU7UUFDdEIsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUM1QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksQ0FBQyxHQUFHLElBQWU7UUFDckIsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzVCLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUMxQyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxHQUFHLElBQWU7UUFDdEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUM7Q0FDRjtBQTVDRCx3QkE0Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBMb2dnZXIgdXRpbGl0eSBmb3IgQWx1dmlhIENsaWVudFxuXG5pbXBvcnQgdHlwZSB7IExvZ0xldmVsIH0gZnJvbSAnLi90eXBlcyc7XG5cbi8qKlxuICogU2ltcGxlIGxvZ2dlciB0aGF0IHJlc3BlY3RzIGxvZyBsZXZlbHMuXG4gKlxuICogTG9nIGxldmVsIGhpZXJhcmNoeTpcbiAqIC0gJ3NpbGVudCc6IG9ubHkgZXJyb3IoKSBsb2dzXG4gKiAtICdpbmZvJzogaW5mbygpLCB3YXJuKCksIGVycm9yKCkgbG9nXG4gKiAtICdkZWJ1Zyc6IGFsbCBtZXRob2RzIGxvZ1xuICovXG5leHBvcnQgY2xhc3MgTG9nZ2VyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBsZXZlbDogTG9nTGV2ZWw7XG5cbiAgY29uc3RydWN0b3IobGV2ZWw6IExvZ0xldmVsKSB7XG4gICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZyBpbmZvcm1hdGlvbmFsIG1lc3NhZ2VzLlxuICAgKiBMb2dzIHdoZW4gbGV2ZWwgaXMgJ2luZm8nIG9yICdkZWJ1ZycuXG4gICAqL1xuICBpbmZvKC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmxldmVsID09PSAnaW5mbycgfHwgdGhpcy5sZXZlbCA9PT0gJ2RlYnVnJykge1xuICAgICAgY29uc29sZS5sb2coJ1thbHV2aWFdW2luZm9dJywgLi4uYXJncyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvZyBkZWJ1ZyBtZXNzYWdlcy5cbiAgICogTG9ncyBvbmx5IHdoZW4gbGV2ZWwgaXMgJ2RlYnVnJy5cbiAgICovXG4gIGRlYnVnKC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmxldmVsID09PSAnZGVidWcnKSB7XG4gICAgICBjb25zb2xlLmRlYnVnKCdbYWx1dmlhXVtkZWJ1Z10nLCAuLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTG9nIHdhcm5pbmcgbWVzc2FnZXMuXG4gICAqIExvZ3Mgd2hlbiBsZXZlbCBpcyBub3QgJ3NpbGVudCcuXG4gICAqL1xuICB3YXJuKC4uLmFyZ3M6IHVua25vd25bXSk6IHZvaWQge1xuICAgIGlmICh0aGlzLmxldmVsICE9PSAnc2lsZW50Jykge1xuICAgICAgY29uc29sZS53YXJuKCdbYWx1dmlhXVt3YXJuXScsIC4uLmFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2cgZXJyb3IgbWVzc2FnZXMuXG4gICAqIEFsd2F5cyBsb2dzIHJlZ2FyZGxlc3Mgb2YgbGV2ZWwuXG4gICAqL1xuICBlcnJvciguLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcbiAgICBjb25zb2xlLmVycm9yKCdbYWx1dmlhXVtlcnJvcl0nLCAuLi5hcmdzKTtcbiAgfVxufVxuXG4iXX0=