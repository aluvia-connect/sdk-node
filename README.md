# @aluvia/aluvia-sdk-node

Local smart proxy for AI agents - Node.js client for Aluvia.

## Installation

```bash
npm install @aluvia/aluvia-sdk-node
# or
yarn add @aluvia/aluvia-sdk-node
# or
pnpm add @aluvia/aluvia-sdk-node
```

## Requirements

- Node.js 18 or higher

## Quick Start with Playwright

```typescript
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

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

## API wrapper

You can call the Aluvia HTTP API directly through the SDK without starting the proxy.

```ts
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
});

const account = await client.api.account.get();
const geos = await client.api.geos.list();
const connections = await client.api.account.connections.list();

// Low-level escape hatch (returns status + etag + body)
const raw = await client.api.request({ method: 'GET', path: '/account' });
```

## Configuration Options

```typescript
const client = new AluviaClient({
  // Required: your Aluvia API key
  apiKey: process.env.ALUVIA_API_KEY,

  // Optional: specific connection ID to use
  connection_id: '123',

  // Optional: enable local proxy mode (default: true)
  // Set to false to run in gateway mode (no local proxy).
  local_proxy: true,

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
