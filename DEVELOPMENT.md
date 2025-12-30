# Development Guide

This document covers the SDK architecture, module structure, and key implementation details for contributors.

## Architecture Overview

The SDK is organized into two planes:

```
┌─────────────────────────────────────────────────────────────┐
│                      AluviaClient                           │
│                   (src/client/AluviaClient.ts)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │    Control Plane    │    │      Data Plane         │    │
│  │   (ConfigManager)   │    │     (ProxyServer)       │    │
│  │                     │    │                         │    │
│  │  • API calls        │    │  • Local proxy on       │    │
│  │  • Config polling   │◄───│    127.0.0.1            │    │
│  │  • Rule updates     │    │  • Per-request routing  │    │
│  └─────────────────────┘    └─────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Aluvia Gateway │
                    │ gateway.aluvia.io│
                    └─────────────────┘
```

### Control Plane (`ConfigManager`)

**Location:** `src/client/ConfigManager.ts`

Responsibilities:
- Fetch connection config from Aluvia API (`GET /account/connections/:id`)
- Create new connections (`POST /account/connections`)
- Update rules/session/geo (`PATCH /account/connections/:id`)
- Poll for config changes (ETag-based, default 5s interval)

Key behaviors:
- Uses `If-None-Match` headers for efficient polling
- Maintains in-memory config: proxy credentials, rules, session_id, target_geo
- Config updates apply immediately (no restart required)

### Data Plane (`ProxyServer`)

**Location:** `src/client/ProxyServer.ts`

Responsibilities:
- Start local HTTP proxy on `127.0.0.1` (loopback only)
- Handle HTTP proxying and HTTPS CONNECT tunneling
- Make per-request routing decisions (direct vs gateway)

Key behaviors:
- Powered by `proxy-chain` library
- Reads config from `ConfigManager` on each request
- Default port: OS-assigned (or specify via `localPort` option)

## Module Structure

```
src/
├── index.ts                 # Public exports
├── errors.ts                # Error classes
├── proxy-chain.d.ts         # Type declarations for proxy-chain
│
├── client/
│   ├── AluviaClient.ts      # Main entry point
│   ├── ConfigManager.ts     # Control plane: API + polling
│   ├── ProxyServer.ts       # Data plane: local proxy
│   ├── rules.ts             # Hostname routing logic
│   ├── adapters.ts          # Tool-specific formatters
│   ├── logger.ts            # Internal logger
│   └── types.ts             # Client types
│
└── api/
    ├── AluviaApi.ts         # API wrapper entry point
    ├── request.ts           # Core HTTP request logic
    ├── account.ts           # /account/* endpoint helpers
    ├── geos.ts              # /geos endpoint helper
    └── types.ts             # API response types
```

## Key Modules

### Rules Engine (`src/client/rules.ts`)

Hostname-based routing decisions. Supported patterns:

| Pattern | Matches |
|---------|---------|
| `*` | All hostnames |
| `example.com` | Exact match |
| `*.example.com` | Subdomains (not apex) |
| `google.*` | Any TLD (`google.com`, `google.co.uk`) |
| `-example.com` | Exclude (takes precedence) |

**Important functions:**
- `matchPattern(hostname, pattern)` — single pattern match
- `shouldProxy(hostname, rules)` — full rules evaluation

### Adapter Layer (`src/client/adapters.ts`)

Converts proxy settings to tool-specific formats:

| Adapter | Output |
|---------|--------|
| `asPlaywright()` | `{ server, username?, password? }` |
| `asPuppeteer()` | `['--proxy-server=...']` |
| `asSelenium()` | `'--proxy-server=...'` |
| `asNodeAgents()` | `{ http: Agent, https: Agent }` |
| `asAxiosConfig()` | `{ proxy: false, httpAgent, httpsAgent }` |
| `asGotOptions()` | `{ agent: { http, https } }` |
| `asUndiciDispatcher()` | `undici.Dispatcher` |
| `asUndiciFetch()` | `fetch` function |

### API Wrapper (`src/api/`)

Typed HTTP client for Aluvia REST API:

```ts
const api = new AluviaApi({ apiKey: '...' });

// Account endpoints
await api.account.get();
await api.account.usage.get({ start: '2025-01-01' });
await api.account.connections.list();
await api.account.connections.create({ rules: ['*'] });
await api.account.connections.get(id, { etag: '...' });
await api.account.connections.patch(id, { rules: ['example.com'] });
await api.account.connections.delete(id);

// Geo endpoints
await api.geos.list();
```

## Default Configuration

| Option | Default | Notes |
|--------|---------|-------|
| `local_proxy` | `true` | Start local proxy |
| `strict` | `true` | Fail fast on config errors |
| `apiBaseUrl` | `https://api.aluvia.io/v1` | API endpoint |
| `pollIntervalMs` | `5000` | Config polling interval |
| `timeoutMs` | `30000` | API request timeout |
| `gatewayProtocol` | `http` | Gateway protocol |
| `gatewayPort` | `8080` (http) / `8443` (https) | Gateway port |
| `localPort` | OS-assigned | Local proxy port |
| `logLevel` | `info` | Logging verbosity |

## Operating Modes

### Client Proxy Mode (default)

```ts
const client = new AluviaClient({ apiKey: '...', local_proxy: true });
const connection = await client.start();
// connection.url = "http://127.0.0.1:<port>"
```

- Local proxy handles routing decisions
- No credentials exposed to tooling
- Config polling enabled

### Gateway Mode

```ts
const client = new AluviaClient({ apiKey: '...', local_proxy: false });
const connection = await client.start();
// connection.url = "http://gateway.aluvia.io:8080"
// connection.getUrl() contains credentials (secret!)
```

- No local proxy
- Credentials passed to tooling
- No config polling

## Error Classes

| Error | When |
|-------|------|
| `MissingApiKeyError` | `apiKey` not provided |
| `InvalidApiKeyError` | 401/403 from API |
| `ApiError` | Other API failures, timeouts |
| `ProxyStartError` | Local proxy fails to start |

## Build System

The SDK produces three outputs:

```bash
npm run build
```

- `dist/esm/` — ES Modules
- `dist/cjs/` — CommonJS
- `dist/types/` — TypeScript declarations

The `package.json` exports map handles resolution for both module systems.

## Adding New Features

1. **Update types** in `src/client/types.ts` or `src/api/types.ts`
2. **Implement logic** in the appropriate module
3. **Export publicly** from `src/index.ts` if needed
4. **Add tests** in `test/integration.test.ts`
5. **Update docs** in `ai_agent_setup/projectdoc.md`

## Debugging Tips

### Enable debug logging

```ts
const client = new AluviaClient({
  apiKey: '...',
  logLevel: 'debug',
});
```

### Inspect config state

```ts
// Access internal config (for debugging only)
const config = (client as any).configManager.getConfig();
console.log(config);
```

### Test routing rules

```ts
import { shouldProxy } from '@aluvia/sdk/client/rules';

console.log(shouldProxy('example.com', ['*', '-google.com'])); // true
console.log(shouldProxy('google.com', ['*', '-google.com']));  // false
```

