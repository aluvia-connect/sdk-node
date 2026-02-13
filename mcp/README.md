# @aluvia/mcp

Aluvia MCP (Model Context Protocol) server — exposes browser session management, account operations, and geo-targeting as MCP tools for AI agents. Use it from Claude Desktop, Claude Code, Cursor, or any MCP-compatible client.

---

## Get an Aluvia API key

You need an API key to run the MCP server. Get one from the [Aluvia dashboard](https://dashboard.aluvia.io). Create or sign in to your account, then copy your API key from the dashboard.

---

## Install

```bash
npm install @aluvia/mcp
```

---

## Setup

Set your API key in the environment (required):

```bash
export ALUVIA_API_KEY="your-api-key"
```

Or use a `.env` file in your project (never commit it):

```bash
ALUVIA_API_KEY=your-api-key
```

---

## Run

```bash
npx aluvia-mcp
```

The server runs on **stdio** (stdin/stdout JSON-RPC) and logs to stderr. It does not open a network port. Your MCP client spawns this process and communicates over stdio.

**Startup log (stderr):**

```
Aluvia MCP server running on stdio
```

---

## Client configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aluvia": {
      "command": "npx",
      "args": ["aluvia-mcp"],
      "env": {
        "ALUVIA_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json` or project MCP config:

```json
{
  "mcpServers": {
    "aluvia": {
      "command": "npx",
      "args": ["aluvia-mcp"],
      "env": {
        "ALUVIA_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Configure MCP in Cursor settings (e.g. **Settings → MCP**) so the Aluvia server is spawned with `ALUVIA_API_KEY` in `env`.

### Other MCP clients

Spawn the server with `command: "npx"`, `args: ["aluvia-mcp"]`, and pass `ALUVIA_API_KEY` in the process environment.

For full client setup and a generic Node.js example, see the [MCP Server Guide](https://github.com/aluvia-connect/sdk-node/blob/main/docs/mcp-server-guide.md#client-configuration) in the main SDK repo.

---

## Available tools

All tools return JSON. On success, `isError` is `false`. On failure, `isError` is `true` and the payload includes an `error` field. Parameters and response shapes are documented in the [MCP Server Guide](https://github.com/aluvia-connect/sdk-node/blob/main/docs/mcp-server-guide.md#tool-reference).

### Session tools

| Tool | Description |
|------|-------------|
| `session_start` | Start a browser session with Aluvia smart proxy. Options: `url` (required), `connectionId`, `headful`, `browserSession`, `autoUnblock`, `disableBlockDetection`. |
| `session_close` | Close one or all running sessions. Options: `browserSession`, `all`. |
| `session_list` | List active browser sessions (PIDs, URLs, CDP URLs, connection IDs). |
| `session_get` | Full session details including block detection state and connection config. Options: `browserSession`. |
| `session_rotate_ip` | Rotate IP for a session (new session ID). Options: `browserSession`. |
| `session_set_geo` | Set or clear geo-targeting (e.g. `US`, `us_ca`). Options: `geo`, `clear`, `browserSession`. |
| `session_set_rules` | Append or remove proxy routing rules (comma-separated hostnames). Options: `rules`, `remove`, `browserSession`. |

### Account tools

| Tool | Description |
|------|-------------|
| `account_get` | Account info (balance, plan, connection count). |
| `account_usage` | Usage statistics for a date range. Options: `start`, `end` (ISO 8601). |

### Geo tools

| Tool | Description |
|------|-------------|
| `geos_list` | List available geo-targeting regions (e.g. `us`, `us_ny`, `us_ca`, `gb`). |

---

## Dependencies

- **@aluvia/sdk** — provides the CLI handlers and proxy logic used by the MCP tools. For programmatic use (e.g. `AluviaClient`, `connect()`), install the full SDK: `npm install @aluvia/sdk`.

---

## More information

- **Full tool reference** (parameters, response JSON, error handling): [MCP Server Guide](https://github.com/aluvia-connect/sdk-node/blob/main/docs/mcp-server-guide.md) in the main SDK repo.
- **SDK overview** (CLI, adapters, block detection, REST API): [Aluvia Node.js SDK README](https://github.com/aluvia-connect/sdk-node/blob/main/README.md).

---

## License

MIT
