# @aluvia/sdk

Core SDK for Aluvia - a local smart proxy for automation workloads and AI agents.

This package provides the programmatic API for integrating Aluvia with your Node.js applications.

## Installation

```bash
npm install @aluvia/sdk playwright
```

## Quick Start

```typescript
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY,
  rules: ['example.com']
});

await client.start();

// Use with Playwright
const browser = await playwright.chromium.launch({
  proxy: client.asPlaywright()
});
```

## What's Included

- `AluviaClient` - Core proxy client with automatic block detection
- `AluviaApi` - REST API wrapper for account and connection management
- `connect()` - Helper for connecting to running browser sessions
- Framework adapters - Playwright, Puppeteer, Selenium, Axios, etc.
- Type definitions for all public APIs

## CLI and MCP Server

For command-line usage, install `@aluvia/cli`:
```bash
npm install -g @aluvia/cli
```

For Model Context Protocol integration, install `@aluvia/mcp`:
```bash
npm install @aluvia/mcp
```

## Documentation

See the [main repository](https://github.com/aluvia-connect/sdk-node) for complete documentation.

## License

MIT
