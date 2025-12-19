# @aluvia/aluvia-node

Local smart proxy for AI agents - Node.js client for Aluvia.

## Installation

```bash
npm install @aluvia/aluvia-node
# or
yarn add @aluvia/aluvia-node
# or
pnpm add @aluvia/aluvia-node
```

## Requirements

- Node.js 18 or higher

## Quick Start with Playwright

```typescript
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY, // Required: your Aluvia API key
});

const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

const page = await browser.newPage();
await page.goto('https://example.com');

// ... do your automation

await browser.close();
```

## Configuration Options

```typescript
const client = new AluviaClient({
  // Required: your Aluvia API key
  apiKey: process.env.ALV_CONNECTION_TOKEN,

  // Optional: specific connection ID to use
  connection_id: 123, 

  // Optional: enable smart routing (default: false)
  smart_routing: true, 

  // Optional: base URL for the Aluvia API
  // Default: 'https://api.aluvia.io/v1'
  apiBaseUrl: 'https://api.aluvia.io/v1',

  // Optional: polling interval for refreshing config
  // Default: 5000 (ms)
  pollIntervalMs: 5000,

  // Optional: protocol for connecting to Aluvia gateway
  // Default: 'http'
  gatewayProtocol: 'http', // or 'https'

  // Optional: port for Aluvia gateway
  // Default: 8080 for 'http', 8443 for 'https'
  gatewayPort: 8080,

  // Optional: local port for the proxy to listen on
  // Default: auto-assigned by OS
  localPort: 54321,

  // Optional: logging verbosity
  // Default: 'info'
  logLevel: 'silent', // 'silent' | 'info' | 'debug'
});
```
