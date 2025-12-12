## Installation

```bash
npm install @aluvia/aluvia-node
# or
yarn add @aluvia/aluvia-node
# or
pnpm add @aluvia/aluvia-node
```

### Requirements

- Node.js 18+

## Quick start

```ts
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({
  token: process.env.ALV_USER_TOKEN!,
});

const session = await client.start();

console.log(`Proxy listening on ${session.url}`);
// session.url -> 'http://127.0.0.1:<port>'

// ... configure your agent/browser/http client to use session.url as its proxy ...

await session.stop();
```


## Configuration options

```ts
const client = new AluviaClient({
  token: process.env.ALV_USER_TOKEN!,

  apiBaseUrl: 'https://api.aluvia.io/v1',
  pollIntervalMs: 5000,

  gatewayProtocol: 'http', // or 'https'
  gatewayPort: 8080,       // defaults to 8080 (http) or 8443 (https)

  localPort: 54321,        // optional, otherwise a free port is chosen

  logLevel: 'info',        // 'silent' | 'info' | 'debug'
});
```
