# @aluvia/agent-connect-node

Local smart proxy for AI agents - Node.js client for Aluvia.

## Installation

```bash
npm install @aluvia/agent-connect-node
# or
yarn add @aluvia/agent-connect-node
# or
pnpm add @aluvia/agent-connect-node
```

## Requirements

- Node.js 18 or higher

## Quick Start

```typescript
import { AgentConnectClient } from '@aluvia/agent-connect-node';

const client = new AgentConnectClient({
  token: process.env.ALV_USER_TOKEN, // Required: your Aluvia user API token
});

const session = await client.start();

console.log(`Proxy listening on ${session.url}`);
// session.host -> '127.0.0.1'
// session.port -> 54321 (or auto-assigned port)
// session.url  -> 'http://127.0.0.1:54321'

// When done:
await session.stop();
```

## Usage with Playwright

```typescript
import { chromium } from 'playwright';
import { AgentConnectClient } from '@aluvia/agent-connect-node';

const client = new AgentConnectClient({
  token: process.env.ALV_USER_TOKEN,
});

const session = await client.start();

const browser = await chromium.launch({
  proxy: { server: session.url },
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
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AgentConnectClient } from '@aluvia/agent-connect-node';

const client = new AgentConnectClient({
  token: process.env.ALV_USER_TOKEN,
});

const session = await client.start();

const axiosClient = axios.create({
  proxy: false, // Disable Axios' own proxy handling
  httpsAgent: new HttpsProxyAgent(session.url),
});

const response = await axiosClient.get('https://api.example.com/data');

await session.stop();
```

## Configuration Options

```typescript
const client = new AgentConnectClient({
  // Required: your Aluvia user API token
  token: process.env.ALV_USER_TOKEN,

  // Optional: base URL for the Aluvia API
  // Default: 'https://api.aluvia.io'
  apiBaseUrl: 'https://api.aluvia.io',

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

### AgentConnectClient

#### `new AgentConnectClient(options)`

Creates a new client instance.

**Options:**
- `token` (required): Your Aluvia user API token
- `apiBaseUrl` (optional): Aluvia API base URL
- `pollIntervalMs` (optional): Config polling interval in milliseconds
- `gatewayProtocol` (optional): `'http'` or `'https'`
- `gatewayPort` (optional): Gateway port number
- `localPort` (optional): Local proxy port
- `logLevel` (optional): `'silent'` | `'info'` | `'debug'`

#### `client.start(): Promise<AgentConnectSession>`

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

### AgentConnectSession

#### `session.stop(): Promise<void>`

Stops this specific session, closing the proxy server and stopping config polling.

## Error Handling

```typescript
import { 
  AgentConnectClient,
  MissingUserTokenError,
  InvalidUserTokenError,
  ApiError,
  ProxyStartError 
} from '@aluvia/agent-connect-node';

try {
  const client = new AgentConnectClient({ token: '' });
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

## How It Works

1. **Authentication**: The client authenticates with Aluvia using your user API token
2. **Configuration**: Fetches proxy credentials, routing rules, and targeting settings from `/user`
3. **Local Proxy**: Starts a local HTTP proxy on `127.0.0.1`
4. **Smart Routing**: Routes requests through Aluvia or directly based on your rules
5. **Live Updates**: Polls for configuration changes using ETag for efficiency

## License

ISC

