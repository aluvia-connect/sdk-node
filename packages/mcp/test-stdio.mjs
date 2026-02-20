/**
 * Smoke test: run aluvia-mcp, send MCP initialize + tools/list, check response.
 *
 * Usage (from repo root):
 *   npm run build:all   # build SDK + MCP first
 *   npm run test:mcp   # or: node mcp/test-stdio.mjs
 *
 * Exits 0 if tools/list returns expected tools; 1 on failure or timeout.
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const bin = new URL("./dist/esm/mcp-server.js", import.meta.url);
const binPath = fileURLToPath(bin);
const child = spawn(process.execPath, [binPath], {
  stdio: ["pipe", "pipe", "pipe"],
});

const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}

let sentList = false;

rl.on("line", (line) => {
  const msg = line.trim();
  if (!msg) return;
  try {
    const obj = JSON.parse(msg);
    if (obj.result?.tools) {
      const names = obj.result.tools.map((t) => t.name);
      const expected = ["session_start", "session_list", "account_get", "geos_list"];
      const ok = expected.every((e) => names.includes(e));
      console.log(ok ? "OK: tools/list returned expected tools" : "FAIL: missing tools");
      console.log("Tools:", names.join(", "));
      child.kill();
      process.exit(ok ? 0 : 1);
    }
    if (obj.id === 1 && !sentList) {
      sentList = true;
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    }
  } catch (_) {}
});

child.stderr.on("data", (d) => process.stderr.write(d));

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0" },
  },
});

setTimeout(() => {
  console.error("Timeout waiting for tools/list response");
  child.kill();
  process.exit(1);
}, 5000);
