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

## Quick Start

```typescript
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({
  token: process.env.ALV_CONNECTION_TOKEN, // Required: your Aluvia connection API token
});

const session = await client.start();

console.log(`Proxy listening on ${session.url}`);
// session.host -> '127.0.0.1'
// session.port -> 54321 (or auto-assigned port)
// session.url  -> 'http://127.0.0.1:54321'

// When done:
await session.stop();
```

## How It Works

1. **Authentication**: The client authenticates with Aluvia using your connection API token
2. **Configuration**: Fetches proxy credentials, routing rules, and targeting settings from `/connection`
3. **Local Proxy**: Starts a local HTTP proxy on `127.0.0.1`
4. **Smart Routing**: Routes requests through Aluvia or directly based on your rules
5. **Live Updates**: Polls for configuration changes using ETag for efficiency

## Configuration Options

```typescript
const client = new AluviaClient({
  // Required: your Aluvia connection API token
  token: process.env.ALV_CONNECTION_TOKEN,

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

## API Reference

### AluviaClient

#### `new AluviaClient(options)`

Creates a new client instance.

**Options:**
- `token` (required): Your Aluvia connection API token
- `apiBaseUrl` (optional): Aluvia API base URL
- `pollIntervalMs` (optional): Config polling interval in milliseconds
- `gatewayProtocol` (optional): `'http'` or `'https'`
- `gatewayPort` (optional): Gateway port number
- `localPort` (optional): Local proxy port
- `logLevel` (optional): `'silent'` | `'info'` | `'debug'`

#### `client.start(): Promise<AluviaClientSession>`

Starts the proxy session:
1. Fetches initial configuration from Aluvia
2. Starts the local proxy server
3. Begins polling for configuration updates

Returns a session object with:
- `host`: Local host (`'127.0.0.1'`)
- `port`: Local port number
- `url`: Full proxy URL (`'http://127.0.0.1:<port>'`)
- `stop()`: Async function to stop this session

#### `client.stop(): Promise<void>`

Stops the proxy server and configuration polling.

### AluviaClientSession

#### `session.stop(): Promise<void>`

Stops this specific session, closing the proxy server and stopping config polling.

## Error Handling

```typescript
import { 
  AluviaClient,
  MissingUserTokenError,
  InvalidUserTokenError,
  ApiError,
  ProxyStartError 
} from '@aluvia/aluvia-node';

try {
  const client = new AluviaClient({ token: '' });
} catch (error) {
  if (error instanceof MissingUserTokenError) {
    console.error('Token is required');
  }
}

try {
  await client.start();
} catch (error) {
  if (error instanceof InvalidUserTokenError) {
    console.error('Invalid or expired token');
  } else if (error instanceof ApiError) {
    console.error(`API error: ${error.message} (status: ${error.statusCode})`);
  } else if (error instanceof ProxyStartError) {
    console.error('Failed to start proxy server');
  }
}
```

## Usage with Playwright

```typescript
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({
  token: process.env.ALV_CONNECTION_TOKEN,
});

const session = await client.start();

const browser = await chromium.launch({
  proxy: session.asPlaywright(),
});

const page = await browser.newPage();
await page.goto('https://example.com');

// ... do your automation

await browser.close();
await session.stop();
```

## Usage with Axios

```typescript
import axios from 'axios';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({
  token: process.env.ALV_CONNECTION_TOKEN,
});

const session = await client.start();

const agent = session.asNodeAgent();

const response = await axios.get('https://api.example.com/data', {
  proxy: false, // Disable Axios' own proxy handling
  httpAgent: agent,
  httpsAgent: agent,
});

await session.stop();
```

## Usage with got

```typescript
import got from 'got';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({
  token: process.env.ALV_CONNECTION_TOKEN,
});

const session = await client.start();

const agent = session.asNodeAgent();

const response = await got('https://api.example.com/data', {
  agent: {
    http: agent,
    https: agent,
  },
});

await session.stop();
```

## Usage with node-fetch

```typescript
import fetch from 'node-fetch';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({
  token: process.env.ALV_CONNECTION_TOKEN,
});

const session = await client.start();

const response = await fetch('https://api.example.com/data', {
  agent: session.asNodeAgent(),
});

await session.stop();
```

## Usage with Puppeteer

```typescript
import puppeteer from 'puppeteer';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({
  token: process.env.ALV_CONNECTION_TOKEN,
});

const session = await client.start();

const browser = await puppeteer.launch({
  args: session.asPuppeteer(),
});

// ... do your automation ...

await browser.close();
await session.stop();
```

## Generic URL

```typescript
const url = session.getUrl(); // 'http://127.0.0.1:<port>'
```

## License

ISC

