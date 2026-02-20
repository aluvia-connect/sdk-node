/**
 * MCP output capture helpers.
 *
 * The CLI handlers call `output()` which normally does `console.log` + `process.exit()`.
 * In MCP mode, we switch `output()` to throw an MCPOutputCapture instead,
 * allowing us to catch and return the data without exiting the process.
 *
 * Uses AsyncLocalStorage so concurrent MCP tool calls don't interfere.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Thrown by output() when in capture mode.
 * Contains the JSON data and exit code that would have been written to stdout.
 */
export class MCPOutputCapture {
  constructor(
    public readonly data: Record<string, unknown>,
    public readonly exitCode: number,
  ) {}
}

const captureContext = new AsyncLocalStorage<boolean>();

export function isCapturing(): boolean {
  return captureContext.getStore() ?? false;
}

/**
 * Run a CLI handler function in capture mode.
 * Returns the data that output() would have written to stdout.
 * Safe for concurrent use — each call gets its own async context.
 */
export async function captureOutput(
  fn: () => Promise<void> | void,
): Promise<{ data: Record<string, unknown>; isError: boolean }> {
  return captureContext.run(true, async () => {
    try {
      await fn();
      // Handler completed without calling output() — shouldn't happen for CLI handlers
      return {
        data: { error: "Handler did not produce output" },
        isError: true,
      };
    } catch (err) {
      if (err instanceof MCPOutputCapture) {
        return {
          data: err.data,
          isError: err.exitCode !== 0,
        };
      }
      // Unexpected error (not from output())
      return {
        data: { error: err instanceof Error ? err.message : String(err) },
        isError: true,
      };
    }
  });
}
