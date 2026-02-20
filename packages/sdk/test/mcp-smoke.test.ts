/**
 * MCP server smoke test: run stdio handshake and tools/list, assert expected tools.
 * Skipped if mcp/dist is not built (run npm run build:all first).
 */

import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mcpServerPath = path.join(root, "mcp", "dist", "esm", "mcp-server.js");
const stdioScript = path.join(root, "mcp", "test-stdio.mjs");

test(
  "MCP server responds to initialize + tools/list with expected tools",
  {
    skip: !fs.existsSync(mcpServerPath),
  },
  () => {
    const result = spawnSync(process.execPath, [stdioScript], {
      cwd: root,
      encoding: "utf-8",
      timeout: 10_000,
    });
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  },
);
