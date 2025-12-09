import type { LogLevel } from './types';
/**
 * Simple logger that respects log levels.
 *
 * Log level hierarchy:
 * - 'silent': only error() logs
 * - 'info': info(), warn(), error() log
 * - 'debug': all methods log
 */
export declare class Logger {
    private readonly level;
    constructor(level: LogLevel);
    /**
     * Log informational messages.
     * Logs when level is 'info' or 'debug'.
     */
    info(...args: unknown[]): void;
    /**
     * Log debug messages.
     * Logs only when level is 'debug'.
     */
    debug(...args: unknown[]): void;
    /**
     * Log warning messages.
     * Logs when level is not 'silent'.
     */
    warn(...args: unknown[]): void;
    /**
     * Log error messages.
     * Always logs regardless of level.
     */
    error(...args: unknown[]): void;
}
