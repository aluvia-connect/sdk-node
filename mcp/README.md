# @aluvia/mcp

Aluvia MCP (Model Context Protocol) server — exposes browser session management, account operations, and geo-targeting as MCP tools for AI agents.

## Install

```bash
npm install @aluvia/mcp
```

## Setup

Set your API key:

```bash
export ALUVIA_API_KEY="your-api-key"
```

## Run

```bash
npx aluvia-mcp
```

The server runs on stdio and logs to stderr. For full tool reference and client configuration (Claude Desktop, Claude Code, etc.), see the [MCP Server Guide](https://github.com/aluvia-connect/sdk-node/blob/main/docs/mcp-server-guide.md) in the main SDK repo.

## Dependencies

- **@aluvia/sdk** — provides the CLI handlers and proxy logic used by the MCP tools. For programmatic use (e.g. `AluviaClient`, `connect()`), install the full SDK: `npm install @aluvia/sdk`.

## License

MIT
